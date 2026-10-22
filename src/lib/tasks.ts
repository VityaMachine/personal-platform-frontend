import { jsonRequest, requestDelete, requestDto } from "./api";
import type { CreateSubtaskInput, CreateTaskInput, UpdateSubtaskInput, UpdateTaskInput } from "./task-types";
import { isSubtask, isSubtaskList, isTask, isTaskList } from "./task-validation";

export type { Task, Subtask, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput, CreateSubtaskInput, UpdateSubtaskInput } from "./task-types";

const taskPath = (id: string) => `/tasks/${encodeURIComponent(id)}`;
const subtasksPath = (taskId: string) => `${taskPath(taskId)}/subtasks`;
const subtaskPath = (taskId: string, id: string) => `${subtasksPath(taskId)}/${encodeURIComponent(id)}`;

// NEXT_PUBLIC_API_URL retains the existing configuration, including its /api prefix.
export function getTasks(signal?: AbortSignal) {
  return requestDto("/tasks", isTaskList, { signal });
}

export function getArchivedTasks(signal?: AbortSignal) {
  return requestDto("/tasks?archived=true", isTaskList, { signal });
}

export function getTask(id: string, signal?: AbortSignal) {
  return requestDto(taskPath(id), isTask, { signal });
}

export function createTask(input: CreateTaskInput, signal?: AbortSignal) {
  return requestDto("/tasks", isTask, jsonRequest("POST", input, signal));
}

export function updateTask(id: string, input: UpdateTaskInput, signal?: AbortSignal) {
  return requestDto(taskPath(id), isTask, jsonRequest("PATCH", input, signal));
}

export function archiveTask(id: string, signal?: AbortSignal) {
  return updateTask(id, { archived: true }, signal);
}

export function unarchiveTask(id: string, signal?: AbortSignal) {
  return updateTask(id, { archived: false }, signal);
}

/** Thin compatibility wrapper for the current page's Promise<void> action. */
export async function setTaskCompleted(id: string, isCompleted: boolean, signal?: AbortSignal): Promise<void> {
  await updateTask(id, { isCompleted }, signal);
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
