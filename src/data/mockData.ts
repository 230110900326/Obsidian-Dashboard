export type TaskState = 'done' | 'doing' | 'todo' | 'overdue';

export interface DashboardMetric {
	label: string;
	value: string;
	suffix: string;
	detail: string;
	tone: 'cyan' | 'amber' | 'violet';
	icon: string;
	tooltip?: string;
}

export interface DashboardTask {
	title: string;
	state: TaskState;
	meta: string;
}

export const MOCK_ACTIONS = [
	'新建日记',
	'深度研究',
	'拉取 RSS',
	'GitHub 动态',
	'整理收件箱',
	'检查仓库',
];
