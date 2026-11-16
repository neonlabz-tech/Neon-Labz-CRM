export const ISSUE_STATUSES = { open: "Open", "in-progress": "In progress", resolved: "Resolved", closed: "Closed" } as const;
export const ISSUE_PRIORITIES = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;
export const ISSUE_TYPES = { bug: "Bug", improvement: "Improvement", task: "Task" } as const;
export type IssueStatus = keyof typeof ISSUE_STATUSES;
export type IssuePriority = keyof typeof ISSUE_PRIORITIES;

export const PRIORITY_TONE = { critical: "danger", high: "warning", medium: "brand", low: "success" } as const;
export const STATUS_TONE = { open: "brand", "in-progress": "info", resolved: "success", closed: "warning" } as const;

export function isOverdue(issue: { dueDate: string; status: string }, today: string): boolean {
  return Boolean(issue.dueDate) && issue.status !== "resolved" && issue.status !== "closed" && issue.dueDate < today;
}
