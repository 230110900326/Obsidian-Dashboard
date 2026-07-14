import { App, TFile } from 'obsidian';
import { DashboardMetric, DashboardTask, TaskState } from '../data/mockData';

export interface NoteActivityDay {
	date: string;
	count: number;
	isDemo: boolean;
}

export interface VaultDashboardData {
	metrics: DashboardMetric[];
	tasks: DashboardTask[];
	activity: NoteActivityDay[];
	activeDays: number;
	activityRange: string;
	totalNotes: number;
	syncedAt: Date;
}

interface TaskSummary {
	tasks: DashboardTask[];
	total: number;
	completed: number;
	overdue: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export async function loadVaultDashboardData(app: App): Promise<VaultDashboardData> {
	const files = app.vault.getMarkdownFiles();
	const today = startOfDay(new Date());
	const todayKey = toDateKey(today);
	const taskSummary = await collectTasks(app, files, todayKey);
	const activity = createActivity(files, today);
	const inboxFiles = files.filter((file) =>
		file.path.split('/').some((part) => part.toLocaleLowerCase() === 'inbox'),
	);
	const modifiedDays = new Set(
		files
			.filter((file) => today.getTime() - file.stat.mtime <= 30 * DAY_IN_MS)
			.map((file) => toDateKey(new Date(file.stat.mtime))),
	).size;
	const taskCompletion = taskSummary.total === 0
		? 0
		: Math.round((taskSummary.completed / taskSummary.total) * 100);
	return {
		metrics: [
			{
				label: 'Markdown 笔记总数',
				value: String(files.length),
				suffix: '篇',
				detail: `近 30 天有 ${modifiedDays} 天修改过笔记`,
				tone: 'cyan',
				icon: '◇',
				tooltip: '只统计当前仓库中的 Markdown 笔记。',
			},
			{
				label: '收件箱积压',
				value: String(inboxFiles.length),
				suffix: '篇',
				detail: describeInbox(inboxFiles, today),
				tone: 'amber',
				icon: '↓',
			},
			{
				label: '任务完成率',
				value: String(taskCompletion),
				suffix: '%',
				detail: taskSummary.total === 0
					? '未找到 Markdown 任务'
					: `已完成 ${taskSummary.completed}/${taskSummary.total} · 逾期 ${taskSummary.overdue}`,
				tone: 'violet',
				icon: '↗',
			},
		],
		tasks: taskSummary.tasks,
		activity,
		activeDays: activity.filter((day) => day.count > 0 && day.date <= todayKey).length,
		activityRange: formatActivityRange(activity, today),
		totalNotes: files.length,
		syncedAt: new Date(),
	};
}

async function collectTasks(
	app: App,
	files: TFile[],
	todayKey: string,
): Promise<TaskSummary> {
	let total = 0;
	let completed = 0;
	let overdue = 0;
	const todayTasks: Array<DashboardTask & { modified: number }> = [];

	for (const file of files) {
		const listItems = app.metadataCache
			.getFileCache(file)
			?.listItems
			?.filter((item) => typeof item.task === 'string');
		if (!listItems || listItems.length === 0) continue;

		const lines = (await app.vault.cachedRead(file)).split(/\r?\n/u);
		for (const item of listItems) {
			const taskMarker = item.task;
			if (typeof taskMarker !== 'string') continue;
			const line = lines[item.position.start.line] ?? '';
			const isComplete = taskMarker.toLocaleLowerCase() === 'x';
			const dueDate = extractDueDate(line);
			const isOverdue = !isComplete && dueDate !== null && dueDate < todayKey;
			const belongsToToday = fileNameMatchesDate(file.basename, todayKey) || dueDate === todayKey;

			total += 1;
			if (isComplete) completed += 1;
			if (isOverdue) overdue += 1;

			if (belongsToToday) {
				todayTasks.push({
					title: cleanTaskTitle(line),
					state: getTaskState(taskMarker, isOverdue),
					meta: file.path,
					modified: file.stat.mtime,
				});
			}
		}
	}

	return {
		tasks: todayTasks
			.sort((left, right) => right.modified - left.modified)
			.slice(0, 5)
			.map(({ title, state, meta }) => ({ title, state, meta })),
		total,
		completed,
		overdue,
	};
}

function createActivity(files: TFile[], today: Date): NoteActivityDay[] {
	const start = new Date(today);
	start.setDate(start.getDate() - start.getDay() - 52 * 7);
	const activity = Array.from({ length: 53 * 7 }, (_, index) => {
		const date = new Date(start);
		date.setDate(start.getDate() + index);
		return { date: toDateKey(date), count: 0, isDemo: false };
	});
	const byDate = new Map(activity.map((day) => [day.date, day]));

	for (const file of files) {
		const day = byDate.get(toDateKey(new Date(file.stat.ctime)));
		if (day) day.count += 1;
	}

	const todayKey = toDateKey(today);
	for (const [index, day] of activity.entries()) {
		if (day.date >= todayKey || day.count > 0) continue;
		day.count = getDemoActivityCount(index);
		day.isDemo = day.count > 0;
	}

	return activity;
}

function getDemoActivityCount(index: number): number {
	const week = Math.floor(index / 7);
	const weekday = index % 7;
	const signal = (week * 13 + weekday * 7 + (week % 5) * 3) % 23;
	const weekendPenalty = weekday === 0 || weekday === 6 ? 4 : 0;
	const adjusted = signal - weekendPenalty;
	if (adjusted < 8) return 0;
	if (adjusted < 14) return 1;
	if (adjusted < 18) return 2;
	if (adjusted < 21) return 3;
	return 4;
}

function describeInbox(files: TFile[], today: Date): string {
	if (files.length === 0) return 'Inbox 文件夹中没有笔记';
	const oldestCreated = Math.min(...files.map((file) => file.stat.ctime));
	const oldestDays = Math.max(0, Math.floor((today.getTime() - oldestCreated) / DAY_IN_MS));
	return `最早一篇已存放 ${oldestDays} 天`;
}

function extractDueDate(line: string): string | null {
	const match = line.match(/(?:📅|due::)?\s*(\d{4})-(\d{1,2})-(\d{1,2})\b/iu);
	return match ? normalizeDateParts(match[1], match[2], match[3]) : null;
}

function fileNameMatchesDate(fileName: string, expectedDate: string): boolean {
	const match = fileName.match(/(\d{4})-(\d{1,2})-(\d{1,2})/u);
	return match ? normalizeDateParts(match[1], match[2], match[3]) === expectedDate : false;
}

function normalizeDateParts(
	year: string | undefined,
	month: string | undefined,
	day: string | undefined,
): string | null {
	if (!year || !month || !day) return null;
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function cleanTaskTitle(line: string): string {
	const withoutCheckbox = line.replace(/^\s*(?:[-*+]|\d+\.)\s+\[[^\]]\]\s*/u, '');
	const withoutDueDate = withoutCheckbox.replace(
		/\s+(?:(?:📅|due::)\s*)?\d{4}-\d{1,2}-\d{1,2}.*$/iu,
		'',
	);
	return withoutDueDate.trim() || '未命名任务';
}

function getTaskState(marker: string, isOverdue: boolean): TaskState {
	if (isOverdue) return 'overdue';
	if (marker.toLocaleLowerCase() === 'x') return 'done';
	if (marker === '/' || marker === '-') return 'doing';
	return 'todo';
}

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date): string {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatActivityRange(activity: NoteActivityDay[], today: Date): string {
	const firstDate = activity[0]?.date;
	if (!firstDate) return '';
	const start = new Date(`${firstDate}T00:00:00`);
	const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'short', year: 'numeric' });
	return `${formatter.format(start)}至${formatter.format(today)}`;
}
