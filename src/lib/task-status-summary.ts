import { TASK_STATUSES, type Task } from "./task-types";

export function summarizeTaskStatuses(tasks: readonly Pick<Task, "status">[]) {
  const statuses = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<Task["status"], number>;
  for (const task of tasks) statuses[task.status]++;
  return {
    total: tasks.length,
    todo: statuses.TODO,
    inProgress: statuses.IN_PROGRESS,
    inactive: statuses.CANCELED + statuses.PAUSED + statuses.POSTPONED,
    done: statuses.DONE,
    statuses,
  };
}
