import { localDateToIso, toLocalDateTime } from "./task-field-input";
import type { PostponeTaskChange, Task } from "./task-types";

export type PostponeTaskFields = { plannedAt: string; dueAt: string };
export type PostponeTaskErrors = Partial<Record<keyof PostponeTaskFields, string>>;

export function getPostponeTaskFields(task: Task): PostponeTaskFields {
  return { plannedAt: toLocalDateTime(task.plannedAt), dueAt: toLocalDateTime(task.dueAt) };
}

export function parsePostponeTaskFields(fields: PostponeTaskFields, original: Task, initial: PostponeTaskFields):
  | { input: PostponeTaskChange; errors?: never }
  | { input?: never; errors: PostponeTaskErrors } {
  const errors: PostponeTaskErrors = {};
  // Always send plannedAt: omission on entering POSTPONED clears it on the backend.
  // Preserve the original instant (including DST offset and milliseconds) if untouched.
  const input: PostponeTaskChange = { status: "POSTPONED", plannedAt: original.plannedAt };
  for (const field of ["plannedAt", "dueAt"] as const) {
    if (fields[field] === initial[field]) continue;
    const date = fields[field] === "" ? null : localDateToIso(fields[field]);
    if (date === undefined) errors[field] = "Вкажіть коректні дату й час або залиште поле порожнім.";
    else if (field === "plannedAt" || date !== original[field]) input[field] = date;
  }
  return Object.keys(errors).length ? { errors } : { input };
}
