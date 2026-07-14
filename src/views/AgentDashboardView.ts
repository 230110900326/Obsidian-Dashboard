import { ItemView, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import { MOCK_ACTIONS, TaskState } from '../data/mockData';
import { ExternalFeedCache } from '../services/externalFeed';
import {
	loadVaultDashboardData,
	NoteActivityDay,
	VaultDashboardData,
} from '../services/dashboardData';

export const AGENT_DASHBOARD_VIEW_TYPE = 'agent-dashboard-view';

export interface DashboardExternalFeedController {
	getCachedFeed(): ExternalFeedCache | null;
	refreshFeed(): Promise<ExternalFeedCache>;
}

export class AgentDashboardView extends ItemView {
	private syncTimeEl: HTMLElement | null = null;
	private interactionEl: HTMLElement | null = null;
	private metricsEl: HTMLElement | null = null;
	private activityEl: HTMLElement | null = null;
	private tasksEl: HTMLElement | null = null;
	private githubEl: HTMLElement | null = null;
	private githubActionButtonEl: HTMLButtonElement | null = null;
	private refreshButtonEl: HTMLButtonElement | null = null;
	private isRefreshing = false;
	private isExternalRefreshing = false;
	private refreshQueued = false;
	private refreshTimer: number | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly externalFeed: DashboardExternalFeedController,
	) {
		super(leaf);
	}

	getViewType() {
		return AGENT_DASHBOARD_VIEW_TYPE;
	}

	getDisplayText() {
		return '我的 Obsidian 数据看板';
	}

	getIcon() {
		return 'layout-dashboard';
	}

	async onOpen() {
		this.renderShell();
		this.registerEvent(this.app.vault.on('create', (file) => this.scheduleRefreshForFile(file)));
		this.registerEvent(this.app.vault.on('delete', (file) => this.scheduleRefreshForFile(file)));
		this.registerEvent(this.app.vault.on('rename', (file) => this.scheduleRefreshForFile(file)));
		this.registerEvent(this.app.metadataCache.on('changed', (file) => this.scheduleRefreshForFile(file)));
		await this.refreshDashboard();
	}

	async onClose() {
		const viewWindow = this.containerEl.ownerDocument.defaultView;
		if (viewWindow && this.refreshTimer !== null) {
			viewWindow.clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = null;
		this.contentEl.empty();
		this.syncTimeEl = null;
		this.interactionEl = null;
		this.metricsEl = null;
		this.activityEl = null;
		this.tasksEl = null;
		this.githubEl = null;
		this.githubActionButtonEl = null;
		this.refreshButtonEl = null;
	}

	private scheduleRefreshForFile(file: TAbstractFile) {
		if (!(file instanceof TFile) || file.extension.toLocaleLowerCase() !== 'md') return;
		const viewWindow = this.containerEl.ownerDocument.defaultView;
		if (!viewWindow) return;
		if (this.refreshTimer !== null) viewWindow.clearTimeout(this.refreshTimer);
		this.refreshTimer = viewWindow.setTimeout(() => {
			this.refreshTimer = null;
			if (this.isRefreshing) {
				this.refreshQueued = true;
				return;
			}
			void this.refreshDashboard();
		}, 400);
	}

	private renderShell() {
		this.contentEl.empty();
		this.contentEl.addClass('agent-dashboard-view');
		const dashboard = this.contentEl.createDiv({ cls: 'agent-dashboard' });
		this.renderHeader(dashboard);
		this.renderActions(dashboard);
		this.metricsEl = dashboard.createDiv({ cls: 'agent-dashboard__metrics' });
		this.activityEl = dashboard.createDiv();
		const feedGrid = dashboard.createDiv({ cls: 'agent-dashboard__feed-grid' });
		this.tasksEl = feedGrid.createDiv({ cls: 'agent-dashboard__feed-column' });
		this.githubEl = feedGrid.createDiv({ cls: 'agent-dashboard__feed-column' });
		this.renderGitHubFeed(this.externalFeed.getCachedFeed());
		this.interactionEl = dashboard.createDiv({
			cls: 'agent-dashboard__interaction',
			attr: { 'aria-live': 'polite' },
		});
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createDiv({ cls: 'agent-dashboard__header' });
		const titles = header.createDiv();
		const eyebrow = titles.createEl('p', {
			cls: 'agent-dashboard__eyebrow',
			text: '智能笔记仓库',
		});
		eyebrow.prepend(
			titles.createSpan({
				cls: 'agent-dashboard__node',
				attr: { 'aria-hidden': 'true' },
			}),
		);
		titles.createEl('h1', { text: '我的 OBSIDIAN 数据看板' });

		const status = header.createDiv({ cls: 'agent-dashboard__header-status' });
		const live = status.createSpan({ cls: 'agent-dashboard__live', text: '本地' });
		live.prepend(
			status.createSpan({
				cls: 'agent-dashboard__live-dot',
				attr: { 'aria-hidden': 'true' },
			}),
		);
		this.syncTimeEl = status.createSpan({
			cls: 'agent-dashboard__sync-time',
			text: '正在等待本地数据',
		});
		this.refreshButtonEl = status.createEl('button', {
			cls: 'agent-dashboard__refresh',
			text: '刷新',
		});
		this.refreshButtonEl.setAttr('aria-label', '刷新本地数据和 GitHub 动态');
		this.registerDomEvent(this.refreshButtonEl, 'click', () => {
			void this.refreshAll();
		});
	}

	private renderActions(container: HTMLElement) {
		const strip = container.createDiv({
			cls: 'agent-dashboard__actions',
			attr: { 'aria-label': '数据看板演示操作' },
		});
		for (const action of MOCK_ACTIONS) {
			const button = strip.createEl('button', {
				cls: 'agent-dashboard__action',
				text: action,
			});
			if (action === 'GitHub 动态') {
				this.githubActionButtonEl = button;
				this.registerDomEvent(button, 'click', () => {
					void this.refreshExternalFeed();
				});
				continue;
			}
			this.registerDomEvent(button, 'click', () => {
				button.addClass('is-active');
				this.setInteraction(`${action} 仍是演示操作，没有修改任何笔记。`);
			});
		}
	}

	private async refreshDashboard() {
		if (this.isRefreshing) {
			this.refreshQueued = true;
			return;
		}
		this.isRefreshing = true;
		this.setInteraction('正在读取本地 Markdown 数据，不会修改任何笔记。');

		try {
			const data = await loadVaultDashboardData(this.app);
			this.renderStats(data);
			this.renderHeatmap(data);
			this.renderTasks(data);
			this.syncTimeEl?.setText(`上次同步 ${formatTime(data.syncedAt)}`);
			this.setInteraction(`已读取 ${data.totalNotes} 篇本地 Markdown 笔记；笔记变化时会自动刷新。`);
		} catch {
			this.setInteraction('无法读取本地数据；没有修改任何笔记。');
		} finally {
			this.isRefreshing = false;
			if (this.refreshQueued) {
				this.refreshQueued = false;
				this.scheduleRefresh();
			}
		}
	}

	private async refreshAll() {
		if (this.isRefreshing || this.isExternalRefreshing) return;
		this.refreshButtonEl?.setText('刷新中…');
		this.refreshButtonEl?.setAttr('disabled', 'true');
		try {
			await this.refreshDashboard();
			await this.refreshExternalFeed();
		} finally {
			this.refreshButtonEl?.setText('刷新');
			this.refreshButtonEl?.removeAttribute('disabled');
		}
	}

	private async refreshExternalFeed() {
		if (this.isExternalRefreshing) return;
		this.isExternalRefreshing = true;
		this.githubActionButtonEl?.setAttr('disabled', 'true');
		this.githubActionButtonEl?.addClass('is-active');
		this.renderGitHubFeed(this.externalFeed.getCachedFeed(), 'loading');
		this.setInteraction('正在读取已关注 GitHub 公开仓库的信息；不会发送任何笔记内容。');
		try {
			const cache = await this.externalFeed.refreshFeed();
			this.renderGitHubFeed(cache);
			this.setInteraction('GitHub 动态已更新并保存在插件本地缓存中。');
		} catch {
			this.renderGitHubFeed(this.externalFeed.getCachedFeed(), 'error');
			this.setInteraction('GitHub 暂时无法访问，已保留上一次缓存；稍后可再次手动刷新。');
		} finally {
			this.githubActionButtonEl?.removeAttribute('disabled');
			this.githubActionButtonEl?.removeClass('is-active');
			this.isExternalRefreshing = false;
		}
	}

	private scheduleRefresh() {
		const viewWindow = this.containerEl.ownerDocument.defaultView;
		if (!viewWindow) return;
		if (this.refreshTimer !== null) viewWindow.clearTimeout(this.refreshTimer);
		this.refreshTimer = viewWindow.setTimeout(() => {
			this.refreshTimer = null;
			void this.refreshDashboard();
		}, 400);
	}

	private renderStats(data: VaultDashboardData) {
		if (!this.metricsEl) return;
		this.metricsEl.empty();
		for (const metric of data.metrics) {
			const card = this.metricsEl.createDiv({
				cls: `agent-dashboard__metric metric--${metric.tone}`,
			});
			if (metric.tooltip) card.setAttr('title', metric.tooltip);
			card.createSpan({
				cls: 'agent-dashboard__metric-icon',
				text: metric.icon,
				attr: { 'aria-hidden': 'true' },
			});
			card.createEl('p', {
				cls: 'agent-dashboard__metric-label',
				text: metric.label,
			});
			const value = card.createEl('p', {
				cls: 'agent-dashboard__metric-value',
				text: metric.value,
			});
			value.createSpan({
				cls: 'agent-dashboard__metric-suffix',
				text: metric.suffix,
			});
			card.createEl('p', {
				cls: 'agent-dashboard__metric-detail',
				text: metric.detail,
			});
		}
	}

	private renderHeatmap(data: VaultDashboardData) {
		if (!this.activityEl) return;
		this.activityEl.empty();
		const panel = this.activityEl.createDiv({
			cls: 'agent-dashboard__panel agent-dashboard__activity-panel',
		});
		const header = panel.createDiv({ cls: 'agent-dashboard__panel-header' });
		this.createPanelTitle(header, '仓库信号 / 历史演示', '笔记创建热力图');
		header.createEl('p', {
			cls: 'agent-dashboard__activity-summary',
			text: `${data.activeDays} 个活跃日（含历史演示），${data.activityRange}`,
		});

		const scroll = panel.createDiv({
			cls: 'agent-dashboard__heatmap-scroll',
			attr: { 'aria-label': '本地每日笔记创建活跃度' },
		});
		const heatmap = scroll.createDiv({ cls: 'agent-dashboard__heatmap' });
		const monthRow = heatmap.createDiv({ cls: 'agent-dashboard__month-row' });
		const heatmapBody = heatmap.createDiv({ cls: 'agent-dashboard__heatmap-body' });
		const dayLabels = heatmapBody.createDiv({ cls: 'agent-dashboard__day-labels' });
		for (const label of ['', '周一', '', '周三', '', '周五', '']) {
			dayLabels.createSpan({ text: label });
		}
		const weeks = heatmapBody.createDiv({ cls: 'agent-dashboard__weeks' });
		let previousMonth = -1;
		for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
			const week = data.activity.slice(weekIndex * 7, weekIndex * 7 + 7);
			const firstDay = week[0];
			const firstDate = firstDay ? new Date(`${firstDay.date}T00:00:00`) : null;
			const month = firstDate?.getMonth() ?? previousMonth;
			monthRow.createSpan({
				text: month !== previousMonth && firstDate
					? firstDate.toLocaleDateString('zh-CN', { month: 'short' })
					: '',
			});
			previousMonth = month;
			const weekEl = weeks.createDiv({ cls: 'agent-dashboard__week' });
			for (const day of week) this.renderHeatCell(weekEl, day);
		}

		const footer = panel.createDiv({ cls: 'agent-dashboard__activity-footer' });
		footer.createSpan({ text: '历史空白日使用演示数据 · 真实创建数量优先显示' });
		const legend = footer.createDiv({
			cls: 'agent-dashboard__legend',
			attr: { 'aria-label': '笔记创建强度：从少到多' },
		});
		legend.createSpan({ text: '少' });
		for (let level = 0; level < 5; level += 1) {
			legend.createSpan({ cls: `agent-dashboard__legend-cell level-${level}` });
		}
		legend.createSpan({ text: '多' });
	}

	private renderHeatCell(container: HTMLElement, day: NoteActivityDay) {
		const level = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count === 2 ? 2 : day.count <= 4 ? 3 : 4;
		const label = day.isDemo
			? `${day.date}：${day.count} 篇（历史演示）`
			: `${day.date}：真实创建 ${day.count} 篇笔记`;
		container.createSpan({
			cls: `agent-dashboard__heat-cell level-${level}`,
			attr: { 'aria-label': label, title: label },
		});
	}

	private renderTasks(data: VaultDashboardData) {
		if (!this.tasksEl) return;
		this.tasksEl.empty();
		const panel = this.tasksEl.createDiv({
			cls: 'agent-dashboard__panel agent-dashboard__list-panel',
		});
		const header = panel.createDiv({ cls: 'agent-dashboard__panel-header' });
		this.createPanelTitle(header, '执行队列 / 本地', '今日任务');
		header.createSpan({
			cls: 'agent-dashboard__panel-count',
			text: `${data.tasks.length} 项`,
		});

		if (data.tasks.length === 0) {
			panel.createEl('p', {
				cls: 'agent-dashboard__empty',
				text: '今天的笔记和今天到期的任务中没有找到待办事项。',
			});
			return;
		}

		const list = panel.createEl('ol', { cls: 'agent-dashboard__task-list' });
		for (const task of data.tasks) {
			const item = list.createEl('li', { cls: 'agent-dashboard__task' });
			const copy = item.createDiv();
			copy.createEl('p', {
				cls: 'agent-dashboard__task-title',
				text: task.title,
			});
			copy.createEl('p', {
				cls: 'agent-dashboard__task-meta',
				text: task.meta,
			});
			item.createSpan({
				cls: `agent-dashboard__task-state state--${task.state}`,
				text: formatTaskState(task.state),
			});
		}
	}

	private renderGitHubFeed(
		cache: ExternalFeedCache | null,
		state: 'ready' | 'loading' | 'error' = 'ready',
	) {
		if (!this.githubEl) return;
		this.githubEl.empty();
		const panel = this.githubEl.createDiv({
			cls: 'agent-dashboard__panel agent-dashboard__list-panel',
		});
		const header = panel.createDiv({ cls: 'agent-dashboard__panel-header' });
		this.createPanelTitle(header, '外部动态 / 手动刷新', 'GitHub 动态');
		const statusText = state === 'loading'
			? '读取中'
			: state === 'error'
				? (cache ? '使用缓存' : '获取失败')
				: cache
					? `缓存 ${formatCacheTime(cache.updatedAt)}`
					: '尚未获取';
		header.createSpan({
			cls: 'agent-dashboard__github-mark',
			text: statusText,
			attr: { 'aria-label': `GitHub 动态状态：${statusText}` },
		});
		if (!cache || cache.items.length === 0) {
			panel.createEl('p', {
				cls: 'agent-dashboard__empty',
				text: state === 'loading'
					? '正在获取公开仓库信息…'
					: '尚未获取动态。点击“GitHub 动态”或右上角“刷新”。',
			});
			return;
		}
		const list = panel.createEl('ul', { cls: 'agent-dashboard__github-list' });
		for (const item of cache.items) {
			const row = list.createEl('li', { cls: 'agent-dashboard__github-item' });
			const copy = row.createDiv();
			copy.createEl('p', {
				cls: 'agent-dashboard__github-repo',
				text: item.repo,
			});
			copy.createEl('p', {
				cls: 'agent-dashboard__github-description',
				text: item.description,
			});
			row.createEl('p', {
				cls: 'agent-dashboard__github-meta',
				text: item.meta,
			});
		}
	}

	private createPanelTitle(container: HTMLElement, index: string, title: string) {
		const titleGroup = container.createDiv();
		titleGroup.createEl('p', {
			cls: 'agent-dashboard__panel-index',
			text: index,
		});
		titleGroup.createEl('h2', { text: title });
	}

	private setInteraction(message: string) {
		this.interactionEl?.setText(message);
	}
}

function formatTime(date: Date): string {
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCacheTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '时间未知';
	return formatTime(date);
}

function formatTaskState(state: TaskState): string {
	const labels: Record<TaskState, string> = {
		done: '已完成',
		doing: '进行中',
		todo: '待办',
		overdue: '已逾期',
	};
	return labels[state];
}
