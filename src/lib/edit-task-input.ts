import type { CreateTaskFields } from "./create-task-input";
import { isAreaId } from "./area-validation";
import { DURATION_ERROR, getTitleError, parseDuration, toLocalDateTime } from "./task-field-input";
import { TASK_PRIORITIES, type Task, type TaskDetailsChange } from "./task-types";
import { resolveLocalDate, sameInstant, toMinuteDateTime, type DateOptions } from "./zoned-date";

export type EditTaskFields = Omit<CreateTaskFields, "plannedAt"> & { plannedDate: string; plannedTime: string };
export type EditTaskErrors = Partial<Record<keyof EditTaskFields, string>>;

export function getEditTaskFields(task: Task, timeZone = "UTC"): EditTaskFields {
  const planned = toLocalDateTime(task.plannedAt, timeZone);
  return {
    areaId: task.areaId ?? "",
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    plannedDate: planned ? planned.split("T")[0] : task.routineOccurrence?.startDate ?? "",
    plannedTime: planned ? planned.split("T")[1].slice(0, 5) : "",
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

  // Compare the draft first: untouched dates retain their exact original instant,
  // including seconds, milliseconds and the offset of an ambiguous local time.
  if (fields.plannedDate !== initial.plannedDate || fields.plannedTime !== initial.plannedTime
    || (dates.choices?.plannedAt && !sameInstant(dates.choices.plannedAt, original.plannedAt))) {
    if (!fields.plannedTime) {
      if (original.plannedAt !== null) input.plannedAt = null;
    } else if (!fields.plannedDate) errors.plannedDate = "Вкажіть дату планування.";
    else {
      const result = resolveLocalDate(toMinuteDateTime(`${fields.plannedDate}T${fields.plannedTime}`), dates.timeZone, dates.choices?.plannedAt);
      if (result.error) errors.plannedTime = result.error;
      else if (result.iso && !sameInstant(result.iso, original.plannedAt)) input.plannedAt = result.iso;
    }
  }
  if (fields.dueAt !== initial.dueAt || (dates.choices?.dueAt && !sameInstant(dates.choices.dueAt, original.dueAt))) {
    const result = fields.dueAt === "" ? { iso: null, error: undefined } : resolveLocalDate(fields.dueAt, dates.timeZone, dates.choices?.dueAt);
    if (result.error) errors.dueAt = result.error;
    else if (result.iso !== undefined && !sameInstant(result.iso, original.dueAt)) input.dueAt = result.iso;
  }

  if (!original.subtasks.some((subtask) => subtask.deletedAt === null)) {
    const duration = parseDuration(fields.estimatedDurationMinutes);
    if (duration === undefined) errors.estimatedDurationMinutes = DURATION_ERROR;
    else if (duration !== original.estimatedDurationMinutes) input.estimatedDurationMinutes = duration;
  }

  if (Object.keys(errors).length) return { errors };
  return { input: Object.keys(input).length ? input as TaskDetailsChange : null };
}
