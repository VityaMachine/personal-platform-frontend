import type { CreateTaskFields } from "./create-task-input";
import { isAreaId } from "./area-validation";
import { DURATION_ERROR, getTitleError, parseDuration, toLocalDateTime } from "./task-field-input";
import { TASK_PRIORITIES, type Task, type TaskDetailsChange } from "./task-types";
import { resolveLocalDate, sameInstant, type DateOptions } from "./zoned-date";

export type EditTaskFields = CreateTaskFields;
export type EditTaskErrors = Partial<Record<keyof EditTaskFields, string>>;

export function getEditTaskFields(task: Task, timeZone = "UTC"): EditTaskFields {
  return {
    areaId: task.areaId ?? "",
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    plannedAt: toLocalDateTime(task.plannedAt, timeZone),
    dueAt: toLocalDateTime(task.dueAt, timeZone),
    estimatedDurationMinutes: String(task.estimatedDurationMinutes),
  };
}

export function parseEditTaskFields(fields: EditTaskFields, original: Task, initial: EditTaskFields, dates: DateOptions = { timeZone: "UTC" }):
  | { input: TaskDetailsChange | null; errors?: never }
  | { input?: never; errors: EditTaskErrors } {
  const errors: EditTaskErrors = {};
  const input: Partial<TaskDetailsChange> = {};
  if (fields.areaId && !isAreaId(fields.areaId)) errors.areaId = "Виберіть сферу зі списку.";
  else if (fields.areaId !== initial.areaId) input.areaId = fields.areaId || null;
  const titleError = getTitleError(fields.title, "Введіть назву задачі.");
  if (titleError) errors.title = titleError;
  else if (fields.title.trim() !== original.title) input.title = fields.title.trim();
  if (fields.description !== initial.description) input.description = fields.description === "" ? null : fields.description;

  const priority = TASK_PRIORITIES.find((value) => value === fields.priority);
  if (!priority) errors.priority = "Виберіть пріоритет зі списку.";
  else if (priority !== original.priority) input.priority = priority;

  for (const field of ["plannedAt", "dueAt"] as const) {
    // Compare the draft first: untouched dates retain their exact original instant,
    // including seconds, milliseconds and the offset of an ambiguous local time.
    if (fields[field] === initial[field] && (!dates.choices?.[field] || sameInstant(dates.choices[field], original[field]))) continue;
    const result = fields[field] === "" ? { iso: null, error: undefined } : resolveLocalDate(fields[field], dates.timeZone, dates.choices?.[field]);
    if (result.error) errors[field] = result.error;
    else if (result.iso !== undefined && !sameInstant(result.iso, original[field])) input[field] = result.iso;
  }

  if (!original.subtasks.some((subtask) => subtask.deletedAt === null)) {
    const duration = parseDuration(fields.estimatedDurationMinutes);
    if (duration === undefined) errors.estimatedDurationMinutes = DURATION_ERROR;
    else if (duration !== original.estimatedDurationMinutes) input.estimatedDurationMinutes = duration;
  }

  if (Object.keys(errors).length) return { errors };
  return { input: Object.keys(input).length ? input as TaskDetailsChange : null };
}
