import { DURATION_ERROR, getTitleError, parseDuration } from "./task-field-input";
import type { InitialSubtaskInput } from "./task-types";

export type CreateSubtaskFields = { title: string; estimatedDurationMinutes: string };
export type CreateSubtaskErrors = Partial<Record<keyof CreateSubtaskFields, string>>;

export function parseCreateSubtaskFields(fields: CreateSubtaskFields):
  | { input: InitialSubtaskInput; errors?: never }
  | { input?: never; errors: CreateSubtaskErrors } {
  const errors: CreateSubtaskErrors = {};
  const titleError = getTitleError(fields.title, "Введіть назву підзадачі.");
  if (titleError) errors.title = titleError;
  const duration = parseDuration(fields.estimatedDurationMinutes);
  if (duration === undefined) errors.estimatedDurationMinutes = DURATION_ERROR;
  if (Object.keys(errors).length || duration === undefined) return { errors };

  return { input: { title: fields.title.trim(), estimatedDurationMinutes: duration } };
}
