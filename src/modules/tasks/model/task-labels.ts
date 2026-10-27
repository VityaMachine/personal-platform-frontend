import type { TaskPriority, TaskStatus } from "./task-types";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "До виконання",
  IN_PROGRESS: "У роботі",
  PAUSED: "Призупинено",
  POSTPONED: "Відкладено",
  DONE: "Завершено",
  CANCELED: "Скасовано",
  SKIPPED: "Пропущено",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Низький",
  MEDIUM: "Середній",
  HIGH: "Високий",
  CRITICAL: "Критичний",
};
