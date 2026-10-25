import { jsonRequest, requestDto, ApiError } from "./api";
import { isRoutine, isRoutineList, isRoutinePreview } from "./routine-validation";
import type { CreateRoutineInput, UpdateRoutineInput, RoutinePreviewRange } from "./routine-types";
const routinePath = (id: string) => `/routines/${encodeURIComponent(id)}`;
export const getRoutines = (signal?: AbortSignal) => requestDto("/routines", isRoutineList, { signal });
export const createRoutine = (input: CreateRoutineInput, signal?: AbortSignal) => requestDto("/routines", isRoutine, jsonRequest("POST", input, signal));
export const getRoutine = (id: string, signal?: AbortSignal) => requestDto(routinePath(id), (value): value is import("./routine-types").Routine => isRoutine(value) && value.id === id, { signal });
export const updateRoutine = (id: string, input: UpdateRoutineInput, signal?: AbortSignal) =>
  requestDto(routinePath(id), (value): value is import("./routine-types").Routine => isRoutine(value) && value.id === id, jsonRequest("PATCH", input, signal));
export const setRoutinePaused = (id: string, paused: boolean, signal?: AbortSignal) =>
  requestDto(routinePath(id), (value): value is import("./routine-types").Routine => isRoutine(value) && value.id === id, jsonRequest("PATCH", { paused }, signal));
export function getRoutinePreview(id: string, range: RoutinePreviewRange, signal?: AbortSignal) {
  const query = new URLSearchParams({ from: range.from, to: range.to, limit: "100" });
  return requestDto(`${routinePath(id)}/preview?${query}`, (value): value is import("./routine-types").RoutinePreview =>
    isRoutinePreview(value) && value.routineId === id && value.from === range.from && value.to === range.to, { signal });
}
export function routineError(error: unknown) {
  if (error instanceof ApiError && error.status === 404) return "Повторювану задачу не знайдено. Можливо, шаблон уже видалено.";
  if (error instanceof ApiError && error.status === 409) return "Стан шаблону змінився. Оновіть дані й повторіть дію.";
  return error instanceof Error ? error.message : "Не вдалося завантажити повторювані задачі. Спробуйте ще раз.";
}
