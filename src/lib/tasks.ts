import { taskContextQuery, type TaskContext } from "./task-context";
import { jsonRequest, requestDelete, requestDto } from "./api";
import type { CreateSubtaskInput, CreateTaskInput, UpdateSubtaskInput, UpdateTaskInput, TaskHistoryEvent } from "./task-types";
import { isSubtask, isSubtaskList, isTask, isTaskList, isTaskHistory } from "./task-validation";

export type { Task, Subtask, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput, CreateSubtaskInput, UpdateSubtaskInput, TaskHistoryEvent } from "./task-types";

const withContext = (path: string, context?: TaskContext) => context ? `${path}${path.includes("?") ? "&" : "?"}${taskContextQuery(context)}` : path;

const taskPath = (id: string) => `/tasks/${encodeURIComponent(id)}`;
const subtasksPath = (taskId: string) => `${taskPath(taskId)}/subtasks`;
const subtaskPath = (taskId: string, id: string) => `${subtasksPath(taskId)}/${encodeURIComponent(id)}`;

// NEXT_PUBLIC_API_URL retains the existing configuration, including its /api prefix.
export function getTasks(signal?: AbortSignal, context?: TaskContext) {
  return requestDto(withContext("/tasks", context), isTaskList, { signal });
}

export function getArchivedTasks(signal?: AbortSignal, context?: TaskContext) {
  return requestDto(withContext("/tasks?archived=true", context), isTaskList, { signal });
}

export function getTask(id: string, signal?: AbortSignal, context?: TaskContext) {
  return requestDto(withContext(taskPath(id), context), isTask, { signal });
}

export function getTaskHistory(id: string, signal?: AbortSignal) {
  return requestDto(`${taskPath(id)}/history`,
    (value): value is TaskHistoryEvent[] => isTaskHistory(value) && value.every((event) => event.taskId === id),
    { signal });
}

export function createTask(input: CreateTaskInput, signal?: AbortSignal, context?: TaskContext) {
  return requestDto(withContext("/tasks", context), isTask, jsonRequest("POST", input, signal));
}

export function updateTask(id: string, input: UpdateTaskInput, signal?: AbortSignal, context?: TaskContext) {
  return requestDto(withContext(taskPath(id), context), isTask, jsonRequest("PATCH", input, signal));
}

export function archiveTask(id: string, signal?: AbortSignal, context?: TaskContext) {
  return updateTask(id, { archived: true }, signal, context);
}

export function unarchiveTask(id: string, signal?: AbortSignal, context?: TaskContext) {
  return updateTask(id, { archived: false }, signal, context);
}

/** Thin compatibility wrapper for the current page's Promise<void> action. */
export async function setTaskCompleted(id: string, isCompleted: boolean, signal?: AbortSignal, context?: TaskContext): Promise<void> {
  await updateTask(id, { isCompleted }, signal, context);
}

export function deleteTask(id: string, signal?: AbortSignal): Promise<void> {
  return requestDelete(taskPath(id), signal);
}

export function getSubtasks(taskId: string, signal?: AbortSignal) {
  return requestDto(subtasksPath(taskId), isSubtaskList, { signal });
}

export function createSubtask(taskId: string, input: CreateSubtaskInput, signal?: AbortSignal) {
  return requestDto(subtasksPath(taskId), isSubtask, jsonRequest("POST", input, signal));
}

export function updateSubtask(taskId: string, id: string, input: UpdateSubtaskInput, signal?: AbortSignal) {
  return requestDto(subtaskPath(taskId, id), isSubtask, jsonRequest("PATCH", input, signal));
}

export function deleteSubtask(taskId: string, id: string, signal?: AbortSignal): Promise<void> {
  return requestDelete(subtaskPath(taskId, id), signal);
}

export function getTodayTasks(signal: AbortSignal | undefined, context: TaskContext) {
  return requestDto(withContext("/tasks?view=today", context), isTaskList, { signal });
}

export function getBacklogTasks(signal: AbortSignal | undefined, context: TaskContext) {
  return requestDto(withContext("/tasks?view=backlog", context), isTaskList, { signal });
}
