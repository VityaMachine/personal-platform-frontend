import { ApiError } from "./api";
import type { Routine, UpdateRoutineInput } from "./routine-types";
import { initialRoutineFields, parseCreateRoutineFields, type CreateRoutineFields } from "./create-routine-input";
import type { SubtaskFields } from "./create-task-input";

export const ROUTINE_CALENDAR_FIELDS = ["timezone", "startDate", "localTime", "recurrence", "dailyInterval", "afterInterval", "intervalWeeks", "weeklyMode", "weekdays", "startWeekday", "endWeekday", "intervalMonths", "monthlyMode", "monthDay", "startDay", "endDay", "shortMonthPolicy", "endType", "endDate", "endCount"] as const;

export function routineToFields(routine: Routine): CreateRoutineFields {
  const fields = { ...initialRoutineFields(routine.timezone), title: routine.title, description: routine.description ?? "", priority: routine.priority,
    areaId: routine.areaId ?? "", estimatedDurationMinutes: String(routine.estimatedDurationMinutes), startDate: routine.startDate,
    localTime: routine.schedule.localTime ?? "", recurrence: routine.schedule.recurrence.type, endType: routine.endCondition.type };
  const rule = routine.schedule.recurrence;
  if (rule.type === "DAILY") fields.dailyInterval = String(rule.intervalDays);
  else if (rule.type === "AFTER_COMPLETION") fields.afterInterval = String(rule.intervalDays);
  else if (rule.type === "WEEKLY") {
    fields.intervalWeeks = String(rule.intervalWeeks); fields.weeklyMode = rule.selection.type;
    if (rule.selection.type === "DAYS") fields.weekdays = [...rule.selection.weekdays];
    else { fields.startWeekday = String(rule.selection.startWeekday); fields.endWeekday = String(rule.selection.endWeekday); }
  } else {
    fields.intervalMonths = String(rule.intervalMonths); fields.monthlyMode = rule.selection.type;
    if (rule.selection.type !== "LAST_DAY") {
      fields.shortMonthPolicy = rule.selection.shortMonthPolicy;
      if (rule.selection.type === "DAY") fields.monthDay = String(rule.selection.day);
      else { fields.startDay = String(rule.selection.startDay); fields.endDay = String(rule.selection.endDay); }
    }
  }
  if (routine.endCondition.type === "COUNT") fields.endCount = String(routine.endCondition.count);
  if (routine.endCondition.type === "UNTIL_DATE") fields.endDate = routine.endCondition.date;
  return fields;
}
export const routineSubtasksToFields = (routine: Routine): SubtaskFields[] => routine.subtasks.map((row) => ({
  localId: row.id, title: row.title, estimatedDurationMinutes: String(row.estimatedDurationMinutes),
}));

/** Object key order is irrelevant; array order remains meaningful. The shared
 * parser already normalizes numeric/text fields and sorts weekday selections. */
function sameNormalized(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameNormalized(value, right[index]));
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null || Array.isArray(left) || Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key)
    && sameNormalized((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}
export function parseUpdateRoutineFields(routine: Routine, fields: CreateRoutineFields, subtasks: readonly SubtaskFields[]) {
  const parsed = parseCreateRoutineFields(fields, subtasks);
  if (!parsed.input) return { errors: parsed.errors, subtaskErrors: parsed.subtaskErrors, input: undefined };
  const baseline = parseCreateRoutineFields(routineToFields(routine), routineSubtasksToFields(routine)).input!;
  const next = parsed.input;
  const patch: UpdateRoutineInput = {};
  for (const key of ["title", "description", "priority", "areaId", "timezone", "startDate", "schedule", "endCondition"] as const) {
    if (!sameNormalized(next[key], baseline[key])) Object.assign(patch, { [key]: next[key] });
  }
  if (!sameNormalized(next.subtasks ?? [], baseline.subtasks ?? [])) patch.subtasks = next.subtasks ?? [];
  if (!(next.subtasks?.length) && (routine.subtasks.length > 0 || next.estimatedDurationMinutes !== baseline.estimatedDurationMinutes)) {
    patch.estimatedDurationMinutes = next.estimatedDurationMinutes;
  }
  return { errors: parsed.errors, subtaskErrors: parsed.subtaskErrors, input: Object.keys(patch).length ? patch : null };
}
export function restoreRoutineCalendar(fields: CreateRoutineFields, baseline: CreateRoutineFields): CreateRoutineFields {
  const restored = { ...fields };
  for (const key of ROUTINE_CALENDAR_FIELDS) Object.assign(restored, { [key]: key === "weekdays" ? [...baseline.weekdays] : baseline[key] });
  return restored;
}
export const ROUTINE_CALENDAR_CONFLICT_MESSAGE = "Розклад уже використано для створення задач. Змінити його поки неможливо. Інші поля можна редагувати";
export function isRoutineCalendarConflict(error: unknown) {
  return error instanceof ApiError && error.status === 409 && error.apiMessage === "Calendar configuration cannot change after generation. Create a new Routine; existing occurrences and Tasks are immutable snapshots.";
}
