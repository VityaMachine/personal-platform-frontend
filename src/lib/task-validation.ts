import { TASK_PRIORITIES, TASK_STATUSES, TASK_TIME_STATUSES, type Subtask, type Task, type TaskHistoryEvent, type TaskSummary } from "./task-types";

import { isAreaReference } from "./area-validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Date.toJSON() output from Prisma/Express, including millisecond precision.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

const nullableText = (value: unknown) => value === null || typeof value === "string";
const nullableTimestamp = (value: unknown) => value === null || isTimestamp(value);
const nullableSeconds = (value: unknown) => value === null
  || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

export function isTaskSummary(value: unknown): value is TaskSummary {
  if (!isRecord(value) || !isRecord(value.statusDurationsSeconds)) return false;
  const durations = value.statusDurationsSeconds;
  return isTimestamp(value.asOf)
    && nullableSeconds(value.ageSeconds)
    && nullableSeconds(value.inProgressSeconds)
    && nullableSeconds(value.timeToCompletionSeconds)
    && TASK_TIME_STATUSES.every((status) => nullableSeconds(durations[status]))
    && typeof value.historyIncomplete === "boolean"
    && Array.isArray(value.historyIssues) && value.historyIssues.every((issue: unknown) => typeof issue === "string");
}

function hasCommonFields(value: Record<string, unknown>): boolean {
  return typeof value.id === "string"
    && typeof value.title === "string"
    && TASK_STATUSES.some((status) => status === value.status)
    && typeof value.estimatedDurationMinutes === "number"
    && Number.isInteger(value.estimatedDurationMinutes)
    && value.estimatedDurationMinutes > 0
    && value.estimatedDurationMinutes <= 2_147_483_647
    && nullableText(value.cancellationNote)
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
    && nullableTimestamp(value.deletedAt);
}

export function isSubtask(value: unknown): value is Subtask {
  return isRecord(value) && hasCommonFields(value) && typeof value.taskId === "string";
}

export function isTask(value: unknown): value is Task {
  return isRecord(value) && hasCommonFields(value)
    && ((value.areaId === null && value.area === null)
      || (isAreaReference(value.area) && value.areaId === value.area.id))
    && nullableText(value.description)
    && TASK_PRIORITIES.some((priority) => priority === value.priority)
    && nullableTimestamp(value.plannedAt)
    && nullableTimestamp(value.dueAt)
    && nullableTimestamp(value.archivedAt)
    && typeof value.isCompleted === "boolean"
    && value.isCompleted === (value.status === "DONE")
    && isTaskSummary(value.summary)
    && Array.isArray(value.subtasks)
    && value.subtasks.every((subtask: unknown) => isSubtask(subtask) && subtask.taskId === value.id);
}

export const isTaskList = (value: unknown): value is Task[] => Array.isArray(value) && value.every(isTask);
export const isSubtaskList = (value: unknown): value is Subtask[] => Array.isArray(value) && value.every(isSubtask);

export function isTaskHistory(value: unknown): value is TaskHistoryEvent[] {
  return Array.isArray(value) && value.every((event: unknown) => isRecord(event)
    && typeof event.id === "string" && typeof event.taskId === "string"
    && typeof event.type === "string" && isTimestamp(event.timestamp));
}
