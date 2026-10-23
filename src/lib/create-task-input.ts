import { TASK_PRIORITIES, type CreateTaskInput } from "./task-types";

export type CreateTaskFields = {
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
export const MAX_DURATION_MINUTES = 2_147_483_647;

function parseDuration(value: string): number | undefined {
  const duration = Number(value);
  return value.trim() && Number.isInteger(duration) && duration > 0 && duration <= MAX_DURATION_MINUTES
    ? duration : undefined;
}

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
  title: "",
  description: "",
  dueAt: "",
  estimatedDurationMinutes: "",
  plannedAt: "",
  priority: "MEDIUM",
};

function localDateToIso(value: string): string | undefined {
  // datetime-local has no offset: Date interprets it in the browser's timezone.
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function parseCreateTaskFields(fields: CreateTaskFields, subtasks: readonly SubtaskFields[] = []):
  | { input: CreateTaskInput; errors?: never; subtaskErrors?: never }
  | { errors: CreateTaskErrors; subtaskErrors: SubtaskErrors; input?: never } {
  const errors: CreateTaskErrors = {};
  const subtaskErrors: SubtaskErrors = {};
  const title = fields.title.trim();
  if (!title) errors.title = "Введіть назву задачі.";
  else if (title.length > 160) errors.title = "Назва має містити не більше 160 символів після видалення пробілів на краях.";

  const dueAt = localDateToIso(fields.dueAt);
  if (!dueAt) errors.dueAt = "Вкажіть коректні дату й час дедлайну.";
  const plannedAt = fields.plannedAt ? localDateToIso(fields.plannedAt) : undefined;
  if (fields.plannedAt && !plannedAt) errors.plannedAt = "Вкажіть коректні дату й час планування або залиште поле порожнім.";

  const duration = parseDuration(fields.estimatedDurationMinutes);
  if (!subtasks.length && duration === undefined) {
    errors.estimatedDurationMinutes = "Введіть цілу кількість хвилин від 1 до 2147483647.";
  }
  for (const subtask of subtasks) {
    const rowErrors: SubtaskErrors[string] = {};
    if (!subtask.title.trim()) rowErrors.title = "Введіть назву підзадачі.";
    else if (subtask.title.trim().length > 160) rowErrors.title = "Назва має містити не більше 160 символів після видалення пробілів на краях.";
    if (parseDuration(subtask.estimatedDurationMinutes) === undefined) {
      rowErrors.estimatedDurationMinutes = "Введіть цілу кількість хвилин від 1 до 2147483647.";
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
