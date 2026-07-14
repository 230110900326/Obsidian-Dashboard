import { MarkdownView, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { AgentDashboardView, AGENT_DASHBOARD_VIEW_TYPE } from './views/AgentDashboardView';
import {
	AgentDashboardSettingTab,
	AgentDashboardSettings,
	readSettings,
} from './settings';
import { ExternalFeedCache, loadGitHubFeed } from './services/externalFeed';

export default class AgentDashboardPlugin extends Plugin {
	settings!: AgentDashboardSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			AGENT_DASHBOARD_VIEW_TYPE,
			(leaf) => new AgentDashboardView(leaf, {
				getCachedFeed: () => this.settings.externalFeedCache,
				refreshFeed: () => this.refreshExternalFeed(),
			}),
		);

		this.addRibbonIcon('dice', '打开我的 Obsidian 数据看板', () => {
			void this.activateDashboard();
		});

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('数据看板已就绪');

		this.addCommand({
			id: 'open-modal-simple',
			name: '打开数据看板',
			callback: () => {
				void this.activateDashboard();
			},
		});

		this.addCommand({
			id: 'replace-selected',
			name: '查看只读状态',
			callback: () => {
				new Notice('数据看板处于只读模式，没有修改任何笔记。');
			},
		});

		this.addCommand({
			id: 'open-modal-complex',
			name: '从笔记中打开数据看板',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!markdownView) return false;
				if (!checking) void this.activateDashboard();
				return true;
			},
		});

		this.addSettingTab(new AgentDashboardSettingTab(this.app, this));
	}

	async activateDashboard() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;

		const existingLeaf = workspace.getLeavesOfType(AGENT_DASHBOARD_VIEW_TYPE)[0];
		if (existingLeaf) {
			leaf = existingLeaf;
		} else {
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({ type: AGENT_DASHBOARD_VIEW_TYPE, active: true });
		}

		await workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = readSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async refreshExternalFeed(): Promise<ExternalFeedCache> {
		const cache = await loadGitHubFeed(this.settings.githubRepository);
		this.settings.externalFeedCache = cache;
		await this.saveSettings();
		return cache;
	}
}
