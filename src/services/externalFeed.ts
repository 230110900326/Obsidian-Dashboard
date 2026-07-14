import { requestUrl } from 'obsidian';

export interface ExternalFeedItem {
	repo: string;
	description: string;
	meta: string;
}

export interface ExternalFeedCache {
	items: ExternalFeedItem[];
	updatedAt: string;
}

const GITHUB_API = 'https://api.github.com';

export async function loadGitHubFeed(repository: string): Promise<ExternalFeedCache> {
	const encodedRepository = repository
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
	const headers = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
	};

	const [repositoryResponse, commitsResponse] = await Promise.all([
		requestUrl({
			url: `${GITHUB_API}/repos/${encodedRepository}`,
			headers,
		}),
		requestUrl({
			url: `${GITHUB_API}/repos/${encodedRepository}/commits?per_page=5`,
			headers,
		}),
	]);

	const stars = readStars(repositoryResponse.json);
	const commits = readCommits(commitsResponse.json);
	if (commits.length === 0) {
		throw new Error('GitHub did not return any readable commits.');
	}

	return {
		items: commits.map((commit) => ({
			repo: repository,
			description: commit.message,
			meta: `${formatGitHubDate(commit.date)} · ${formatStars(stars)} ★`,
		})),
		updatedAt: new Date().toISOString(),
	};
}

export function isExternalFeedCache(value: unknown): value is ExternalFeedCache {
	if (!isRecord(value) || typeof value.updatedAt !== 'string' || !Array.isArray(value.items)) {
		return false;
	}
	return value.items.every((item) =>
		isRecord(item)
		&& typeof item.repo === 'string'
		&& typeof item.description === 'string'
		&& typeof item.meta === 'string',
	);
}

function readStars(value: unknown): number {
	if (!isRecord(value) || typeof value.stargazers_count !== 'number') {
		throw new Error('GitHub repository information was not readable.');
	}
	return value.stargazers_count;
}

function readCommits(value: unknown): Array<{ message: string; date: string }> {
	if (!Array.isArray(value)) return [];
	const commits: Array<{ message: string; date: string }> = [];
	for (const entry of value) {
		if (!isRecord(entry) || !isRecord(entry.commit)) continue;
		const message = entry.commit.message;
		const author = entry.commit.author;
		if (typeof message !== 'string' || !isRecord(author) || typeof author.date !== 'string') continue;
		const firstLine = message.split(/\r?\n/, 1)[0]?.trim();
		if (!firstLine) continue;
		commits.push({ message: firstLine, date: author.date });
	}
	return commits;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function formatGitHubDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '更新时间未知';
	return date.toLocaleString('zh-CN', {
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatStars(stars: number): string {
	if (stars < 1000) return String(stars);
	return `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
