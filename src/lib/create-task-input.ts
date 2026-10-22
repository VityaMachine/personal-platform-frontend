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

export function parseCreateTaskFields(fields: CreateTaskFields):
  | { input: CreateTaskInput; errors?: never }
  | { errors: CreateTaskErrors; input?: never } {
  const errors: CreateTaskErrors = {};
  const title = fields.title.trim();
  if (!title) errors.title = "Введіть назву задачі.";
  else if (title.length > 160) errors.title = "Назва має містити не більше 160 символів після видалення пробілів на краях.";

  const dueAt = localDateToIso(fields.dueAt);
  if (!dueAt) errors.dueAt = "Вкажіть коректні дату й час дедлайну.";
  const plannedAt = fields.plannedAt ? localDateToIso(fields.plannedAt) : undefined;
  if (fields.plannedAt && !plannedAt) errors.plannedAt = "Вкажіть коректні дату й час планування або залиште поле порожнім.";

  const duration = Number(fields.estimatedDurationMinutes);
  if (!fields.estimatedDurationMinutes.trim() || !Number.isInteger(duration) || duration <= 0 || duration > 2_147_483_647) {
    errors.estimatedDurationMinutes = "Введіть цілу кількість хвилин від 1 до 2147483647.";
  }
  const priority = TASK_PRIORITIES.find((value) => value === fields.priority);
  if (!priority) errors.priority = "Виберіть пріоритет зі списку.";

  if (Object.keys(errors).length || !dueAt || !priority) return { errors };
  return {
    input: {
      title,
      ...(fields.description ? { description: fields.description } : {}),
      dueAt,
      estimatedDurationMinutes: duration,
      ...(plannedAt ? { plannedAt } : {}),
      priority,
    },
  };
}
