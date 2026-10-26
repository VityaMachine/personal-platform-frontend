import { jsonRequest, requestDto, requestDelete, ApiError } from "./api";
import { isRoutineScheduleVersion, isRoutineScheduleVersionList, isRoutine, isRoutineList, isRoutinePreview, isRoutineGenerationResult, isRoutineGenerationPreview } from "./routine-validation";
import type { CreateRoutineInput, UpdateRoutineInput, RoutinePreviewRange, GenerateRoutineInput, RoutineGenerationResult, RoutineGenerationPreview } from "./routine-types";
const routinePath = (id: string) => `/routines/${encodeURIComponent(id)}`;
export function getRoutineScheduleVersions(id: string, signal?: AbortSignal) {
  return requestDto(`${routinePath(id)}/schedule-versions`, (value): value is import("./routine-types").RoutineScheduleVersion[] =>
    isRoutineScheduleVersionList(value) && value.every((version) => version.routineId === id), { signal });
}
export function createRoutineScheduleVersion(id: string, input: import("./routine-types").CreateRoutineScheduleVersionInput, signal?: AbortSignal) {
  const { effectiveDate, timezone, startDate, schedule, endCondition } = input;
  return requestDto(`${routinePath(id)}/schedule-versions`, (value): value is import("./routine-types").RoutineScheduleVersion =>
    isRoutineScheduleVersion(value) && value.routineId === id,
    jsonRequest("POST", { effectiveDate, timezone, startDate, schedule, endCondition }, signal));
}
export const deleteRoutine = (id: string, signal?: AbortSignal) => requestDelete(routinePath(id), signal);
export const getRoutines = (signal?: AbortSignal) => requestDto("/routines", isRoutineList, { signal });
export const createRoutine = (input: CreateRoutineInput, signal?: AbortSignal) => requestDto("/routines", isRoutine, jsonRequest("POST", input, signal));
export function generateRoutine(id: string, input: GenerateRoutineInput, signal?: AbortSignal) {
  const body: GenerateRoutineInput = { from: input.from, to: input.to,
    ...(input.planning === undefined ? {} : { planning: input.planning.map(({ occurrenceKey, plannedAt }) => ({ occurrenceKey, plannedAt })) }) };
  return requestDto(`${routinePath(id)}/generate`, (value): value is RoutineGenerationResult =>
    isRoutineGenerationResult(value) && value.routineId === id && value.from === body.from && value.to === body.to,
    jsonRequest("POST", body, signal));
}
export function getRoutineGenerationPreview(id: string, range: RoutinePreviewRange, signal?: AbortSignal) {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  return requestDto(`${routinePath(id)}/generation-preview?${query}`, (value): value is RoutineGenerationPreview =>
    isRoutineGenerationPreview(value) && value.routineId === id && value.from === range.from && value.to === range.to, { signal });
}
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
