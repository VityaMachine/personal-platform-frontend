import { TASK_PRIORITIES, type CreateTaskInput } from "./task-types";
import { isAreaId } from "../../../lib/area-validation";
import { DURATION_ERROR, MAX_DURATION_MINUTES, getTitleError, parseDuration } from "./task-field-input";
import { resolveLocalDate, type DateOptions } from "../../../lib/zoned-date";

export { MAX_DURATION_MINUTES } from "./task-field-input";

export type CreateTaskFields = {
  areaId: string;
  title: string;
  description: string;
  dueAt: string;
  estimatedDurationMinutes: string;
  plannedAt: string;
  priority: string;
};

export type CreateTaskErrors = Partial<Record<keyof CreateTaskFields, string>>;

export type SubtaskFields = {
  localId: string;
  title: string;
  estimatedDurationMinutes: string;
};
export type SubtaskErrors = Record<string, Partial<Record<"title" | "estimatedDurationMinutes", string>>>;
/** An incomplete sum stays blank rather than implying the unfinished rows were omitted. */
export function getSubtaskDuration(subtasks: readonly SubtaskFields[]): number | undefined {
  let total = 0;
  for (const subtask of subtasks) {
    const duration = parseDuration(subtask.estimatedDurationMinutes);
    if (duration === undefined) return undefined;
    total += duration;
  }
  return total;
}

export const EMPTY_TASK_FIELDS: CreateTaskFields = {
  areaId: "",
  title: "",
  description: "",
  dueAt: "",
  estimatedDurationMinutes: "",
  plannedAt: "",
  priority: "MEDIUM",
};

export function parseCreateTaskFields(fields: CreateTaskFields, subtasks: readonly SubtaskFields[] = [], dates: DateOptions = { timeZone: "UTC" }):
  | { input: CreateTaskInput; errors?: never; subtaskErrors?: never }
  | { errors: CreateTaskErrors; subtaskErrors: SubtaskErrors; input?: never } {
  const errors: CreateTaskErrors = {};
  if (fields.areaId && !isAreaId(fields.areaId)) errors.areaId = "Виберіть сферу зі списку.";
  const subtaskErrors: SubtaskErrors = {};
  const title = fields.title.trim();
  const titleError = getTitleError(fields.title, "Введіть назву задачі.");
  if (titleError) errors.title = titleError;

  const due = resolveLocalDate(fields.dueAt, dates.timeZone, dates.choices?.dueAt);
  const dueAt = due.iso;
  if (!dueAt) errors.dueAt = due.error;
  const planned = fields.plannedAt ? resolveLocalDate(fields.plannedAt, dates.timeZone, dates.choices?.plannedAt) : {};
  const plannedAt = planned.iso;
  if (planned.error) errors.plannedAt = planned.error;

  const duration = parseDuration(fields.estimatedDurationMinutes);
  if (!subtasks.length && duration === undefined) {
    errors.estimatedDurationMinutes = DURATION_ERROR;
  }
  for (const subtask of subtasks) {
    const rowErrors: SubtaskErrors[string] = {};
    const titleError = getTitleError(subtask.title, "Введіть назву підзадачі.");
    if (titleError) rowErrors.title = titleError;
    if (parseDuration(subtask.estimatedDurationMinutes) === undefined) {
      rowErrors.estimatedDurationMinutes = DURATION_ERROR;
    }
    if (Object.keys(rowErrors).length) subtaskErrors[subtask.localId] = rowErrors;
  }
  const total = getSubtaskDuration(subtasks);
  if (subtasks.length && total !== undefined && total > MAX_DURATION_MINUTES) {
    errors.estimatedDurationMinutes = "Сума тривалостей підзадач не може перевищувати 2147483647 хвилин.";
  }
  const priority = TASK_PRIORITIES.find((value) => value === fields.priority);
  if (!priority) errors.priority = "Виберіть пріоритет зі списку.";

  if (Object.keys(errors).length || Object.keys(subtaskErrors).length || !dueAt || !priority) return { errors, subtaskErrors };
  // Build the wire payload explicitly: local IDs and statuses never leave the draft.
  const firstSubtask = subtasks[0];
  const toInput = (row: SubtaskFields) => ({ title: row.title.trim(), estimatedDurationMinutes: Number(row.estimatedDurationMinutes) });
  return {
    input: {
      title,
      ...(fields.areaId ? { areaId: fields.areaId } : {}),
      ...(fields.description ? { description: fields.description } : {}),
      dueAt,
      ...(firstSubtask
        ? { subtasks: [toInput(firstSubtask), ...subtasks.slice(1).map(toInput)] as [ReturnType<typeof toInput>, ...ReturnType<typeof toInput>[]] }
        : { estimatedDurationMinutes: duration! }),
      ...(plannedAt ? { plannedAt } : {}),
      priority,
    },
  };
}
