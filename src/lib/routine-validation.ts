import { Temporal } from "@js-temporal/polyfill";
import { isAreaId, isAreaReference } from "./area-validation";
import { isTimeZone } from "./settings";
import { TASK_PRIORITIES } from "./task-types";
import type { Routine, RoutineSchedule, RoutineEndCondition, RoutinePreview, RoutinePreviewOccurrence, GenerateRoutineInput, RoutineGenerationResult, RoutineGenerationLink, RoutineGenerationPreview } from "./routine-types";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 1, max = 2_147_483_647): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const text = (value: unknown): value is string => typeof value === "string";
const title = (value: unknown) => text(value) && value.trim().length > 0 && value.length <= 160;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const localTime = (value: unknown) => value === null || (text(value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
const timestamp = (value: unknown) => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(value)) return false;
  try { Temporal.Instant.from(value); return true; } catch { return false; }
};
const nullableTimestamp = (value: unknown) => value === null || timestamp(value);
const timezone = (value: unknown) => typeof value === "string" && value.length <= 100 && /^[A-Za-z][A-Za-z0-9._+\-/]*$/.test(value) && isTimeZone(value);
export function isRoutineDate(value: unknown): value is string {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  try { return Temporal.PlainDate.from(value).toString() === value; } catch { return false; }
}
export function isRoutineSchedule(value: unknown): value is RoutineSchedule {
  if (!record(value) || value.version !== 1 || !localTime(value.localTime) || !record(value.recurrence)) return false;
  const rule = value.recurrence;
  if (rule.type === "DAILY" || rule.type === "AFTER_COMPLETION") return integer(rule.intervalDays);
  const selection = rule.selection;
  if (!record(selection)) return false;
  if (rule.type === "WEEKLY" && integer(rule.intervalWeeks)) {
    return selection.type === "DAYS" ? Array.isArray(selection.weekdays) && selection.weekdays.length > 0 && selection.weekdays.length <= 7
      && selection.weekdays.every((day) => integer(day, 1, 7)) && new Set(selection.weekdays).size === selection.weekdays.length
      : selection.type === "WINDOW" && integer(selection.startWeekday, 1, 7) && integer(selection.endWeekday, 1, 7) && selection.startWeekday <= selection.endWeekday;
  }
  if (rule.type !== "MONTHLY" || !integer(rule.intervalMonths)) return false;
  if (selection.type === "LAST_DAY") return true;
  if (selection.shortMonthPolicy !== "SKIP" && selection.shortMonthPolicy !== "CLAMP") return false;
  return selection.type === "DAY" ? integer(selection.day, 1, 31)
    : selection.type === "WINDOW" && integer(selection.startDay, 1, 31) && integer(selection.endDay, 1, 31) && selection.startDay <= selection.endDay;
}
export function isRoutineEndCondition(value: unknown): value is RoutineEndCondition {
  return record(value) && (value.type === "NEVER" || (value.type === "UNTIL_DATE" && isRoutineDate(value.date)) || (value.type === "COUNT" && integer(value.count)));
}
export function isRoutine(value: unknown): value is Routine {
  return record(value) && isAreaId(value.id) && title(value.title) && (value.description === null || text(value.description))
    && TASK_PRIORITIES.some((priority) => priority === value.priority)
    && ((value.areaId === null && value.area === null) || (isAreaReference(value.area) && value.areaId === value.area.id))
    && integer(value.estimatedDurationMinutes) && timezone(value.timezone) && isRoutineDate(value.startDate)
    && typeof value.autoGenerate === "boolean" && integer(value.generationHorizonDays, 1, 30)
    && isRoutineSchedule(value.schedule) && isRoutineEndCondition(value.endCondition)
    && (value.endCondition.type !== "UNTIL_DATE" || value.endCondition.date >= value.startDate)
    && nullableTimestamp(value.pausedAt) && nullableTimestamp(value.deletedAt) && timestamp(value.createdAt) && timestamp(value.updatedAt)
    && Array.isArray(value.subtasks) && value.subtasks.every((child: unknown, position: number) => record(child)
      && isAreaId(child.id) && child.routineId === value.id && child.position === position && title(child.title) && integer(child.estimatedDurationMinutes))
    && (value.subtasks.length === 0 || value.subtasks.reduce((sum: number, child: { estimatedDurationMinutes: number }) => sum + child.estimatedDurationMinutes, 0) === value.estimatedDurationMinutes);
}
export const isRoutineList = (value: unknown): value is Routine[] => Array.isArray(value) && value.every(isRoutine);
export function isPreviewOccurrence(value: unknown): value is RoutinePreviewOccurrence {
  return record(value) && text(value.occurrenceKey) && isRoutineDate(value.startDate) && isRoutineDate(value.endDate) && value.startDate <= value.endDate
    && timezone(value.timezone) && localTime(value.localTime) && nullableTimestamp(value.instant) && strings(value.diagnostics);
}
export function isRoutinePreview(value: unknown): value is RoutinePreview {
  return record(value) && validConflicts(value.conflicts) && isAreaId(value.routineId) && timezone(value.timezone) && isRoutineDate(value.from) && isRoutineDate(value.to) && value.from <= value.to
    && Array.isArray(value.occurrences) && value.occurrences.every(isPreviewOccurrence) && typeof value.truncated === "boolean" && strings(value.limitations);
}

function validGenerationRange(value: Record<string, unknown>): value is Record<string, unknown> & GenerateRoutineInput {
  return isRoutineDate(value.from) && isRoutineDate(value.to) && value.from <= value.to
    && Temporal.PlainDate.from(value.from).until(value.to).days < 366;
}
export function isGenerateRoutineInput(value: unknown): value is GenerateRoutineInput {
  if (!record(value) || !Object.keys(value).every((key) => key === "from" || key === "to" || key === "planning") || !validGenerationRange(value)) return false;
  if (value.planning === undefined) return true;
  if (!Array.isArray(value.planning) || value.planning.length > 100) return false;
  return value.planning.every((entry: unknown) => {
    if (!record(entry) || Object.keys(entry).length !== 2 || !text(entry.occurrenceKey) || !entry.occurrenceKey.length || entry.occurrenceKey.length > 512
      || !text(entry.plannedAt) || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(entry.plannedAt)) return false;
    try { Temporal.Instant.from(entry.plannedAt); return true; } catch { return false; }
  }) && new Set(value.planning.map((entry) => entry.occurrenceKey)).size === value.planning.length;
}
export function isRoutineGenerationPreview(value: unknown): value is RoutineGenerationPreview {
  if (!record(value) || !validConflicts(value.conflicts) || !validGenerationRange(value) || !isAreaId(value.routineId) || !timezone(value.timezone)
    || !Array.isArray(value.occurrences) || !value.occurrences.every((entry: unknown) => isPreviewOccurrence(entry)
      && entry.occurrenceKey.length > 0 && entry.occurrenceKey.length <= 512 && "existing" in entry && typeof entry.existing === "boolean"
      && "basisType" in entry && (entry.basisType === null || entry.basisType === "COMPLETED" || entry.basisType === "SKIPPED")
      && "basisAt" in entry && nullableTimestamp(entry.basisAt)
      && "basisCompletedAt" in entry && nullableTimestamp(entry.basisCompletedAt))) return false;
  return new Set(value.occurrences.map((entry) => entry.occurrenceKey)).size === value.occurrences.length
    && value.occurrences.filter((entry) => !entry.existing).length <= 100;
}
const isGenerationLink = (value: unknown): value is RoutineGenerationLink => record(value)
  && text(value.occurrenceKey) && value.occurrenceKey.length > 0 && isAreaId(value.taskId);
export function isRoutineGenerationResult(value: unknown): value is RoutineGenerationResult {
  if (!record(value) || !validConflicts(value.conflicts) || !validGenerationRange(value) || !isAreaId(value.routineId)
    || !integer(value.createdCount, 0, 100) || !integer(value.existingCount, 0)
    || !Array.isArray(value.created) || !value.created.every(isGenerationLink)
    || !Array.isArray(value.existing) || !value.existing.every(isGenerationLink)
    || value.created.length !== value.createdCount || value.existing.length !== value.existingCount) return false;
  const links = [...value.created, ...value.existing];
  return new Set(links.map((link) => link.occurrenceKey)).size === links.length
    && new Set(links.map((link) => link.taskId)).size === links.length;
}
export function isRoutineScheduleVersion(value: unknown): value is import("./routine-types").RoutineScheduleVersion {
  if (!record(value) || !isAreaId(value.id) || !isAreaId(value.routineId) || !integer(value.number, 1, 100)
    || !isRoutineDate(value.effectiveDate) || !timezone(value.effectiveTimezone) || !timestamp(value.effectiveAt)
    || !timestamp(value.createdAt) || !timezone(value.timezone) || !isRoutineDate(value.startDate)
    || !isRoutineSchedule(value.schedule) || !isRoutineEndCondition(value.endCondition)
    || (value.endCondition.type === "UNTIL_DATE" && value.endCondition.date < value.startDate)) return false;
  try { return Temporal.PlainDate.from(value.effectiveDate).toZonedDateTime(value.effectiveTimezone as string).toInstant()
    .equals(Temporal.Instant.from(value.effectiveAt as string)); } catch { return false; }
}
export function isRoutineScheduleVersionList(value: unknown): value is import("./routine-types").RoutineScheduleVersion[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(isRoutineScheduleVersion)
    && value.every((entry, index) => entry.number === index + 1 && entry.routineId === value[0].routineId
      && entry.effectiveTimezone === value[0].effectiveTimezone && (!index || (entry.effectiveDate > value[index - 1].effectiveDate
        && Temporal.Instant.compare(entry.effectiveAt, value[index - 1].effectiveAt) > 0)));
}
function validConflicts(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((entry) => record(entry)
    && (entry.code === "STORED_WINDOW_CONFLICT" || entry.code === "VERSION_WINDOW_CONFLICT")
    && text(entry.occurrenceKey) && entry.occurrenceKey.length > 0 && text(entry.retainedOccurrenceKey) && entry.retainedOccurrenceKey.length > 0
    && (entry.code === "STORED_WINDOW_CONFLICT" ? isAreaId(entry.retainedTaskId) : entry.retainedTaskId === null)));
}
