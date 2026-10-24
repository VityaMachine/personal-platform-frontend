import { toLocalDateTime } from "./task-field-input";
import type { PostponeTaskChange, Task } from "./task-types";
import { resolveLocalDate, sameInstant, type DateOptions } from "./zoned-date";

export type PostponeTaskFields = { plannedAt: string; dueAt: string };
export type PostponeTaskErrors = Partial<Record<keyof PostponeTaskFields, string>>;

export function getPostponeTaskFields(task: Task, timeZone = "UTC"): PostponeTaskFields {
  return { plannedAt: toLocalDateTime(task.plannedAt, timeZone), dueAt: toLocalDateTime(task.dueAt, timeZone) };
}

export function parsePostponeTaskFields(fields: PostponeTaskFields, original: Task, initial: PostponeTaskFields, dates: DateOptions = { timeZone: "UTC" }):
  | { input: PostponeTaskChange; errors?: never }
  | { input?: never; errors: PostponeTaskErrors } {
  const errors: PostponeTaskErrors = {};
  // Always send plannedAt: omission on entering POSTPONED clears it on the backend.
  // Preserve the original instant (including DST offset and milliseconds) if untouched.
  const input: PostponeTaskChange = { status: "POSTPONED", plannedAt: original.plannedAt };
  for (const field of ["plannedAt", "dueAt"] as const) {
    if (fields[field] === initial[field] && (!dates.choices?.[field] || sameInstant(dates.choices[field], original[field]))) continue;
    const result = fields[field] === "" ? { iso: null, error: undefined } : resolveLocalDate(fields[field], dates.timeZone, dates.choices?.[field]);
    if (result.error) errors[field] = result.error;
    else if (result.iso !== undefined && (field === "plannedAt" || !sameInstant(result.iso, original[field]))) input[field] = result.iso;
  }
  return Object.keys(errors).length ? { errors } : { input };
}
