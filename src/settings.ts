import { App, PluginSettingTab, Setting } from 'obsidian';
import AgentDashboardPlugin from './main';
import { ExternalFeedCache, isExternalFeedCache } from './services/externalFeed';

export interface AgentDashboardSettings {
	githubRepository: string;
	externalFeedCache: ExternalFeedCache | null;
}

export const DEFAULT_SETTINGS: AgentDashboardSettings = {
	githubRepository: '230110900326/Obsidian-Dashboard',
	externalFeedCache: null,
};

export function readSettings(value: unknown): AgentDashboardSettings {
	const storedCache = isRecord(value) && isExternalFeedCache(value.externalFeedCache)
		? value.externalFeedCache
		: null;
	const cache = storedCache?.items.every(
		(item) => item.repo === DEFAULT_SETTINGS.githubRepository,
	) ? storedCache : null;
	return {
		githubRepository: DEFAULT_SETTINGS.githubRepository,
		externalFeedCache: cache,
	};
}

export class AgentDashboardSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: AgentDashboardPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub 公开仓库')
			.setDesc(`只在手动刷新时读取 ${this.plugin.settings.githubRepository}；不使用 Token，也不会上传笔记内容。`);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
