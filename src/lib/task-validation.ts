import { TASK_PRIORITIES, TASK_STATUSES, type Subtask, type Task } from "./task-types";

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
    && nullableText(value.description)
    && TASK_PRIORITIES.some((priority) => priority === value.priority)
    && nullableTimestamp(value.plannedAt)
    && nullableTimestamp(value.dueAt)
    && nullableTimestamp(value.archivedAt)
    && typeof value.isCompleted === "boolean"
    && value.isCompleted === (value.status === "DONE")
    && Array.isArray(value.subtasks)
    && value.subtasks.every((subtask: unknown) => isSubtask(subtask) && subtask.taskId === value.id);
}

export const isTaskList = (value: unknown): value is Task[] => Array.isArray(value) && value.every(isTask);
export const isSubtaskList = (value: unknown): value is Subtask[] => Array.isArray(value) && value.every(isSubtask);
