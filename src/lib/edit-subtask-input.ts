import { DURATION_ERROR, getTitleError, parseDuration } from "./task-field-input";
import type { Subtask, SubtaskDetailsChange } from "./task-types";

export type EditSubtaskFields = { title: string; estimatedDurationMinutes: string };
export type EditSubtaskErrors = Partial<Record<keyof EditSubtaskFields, string>>;

export function parseEditSubtaskFields(fields: EditSubtaskFields, original: Subtask):
  | { input: SubtaskDetailsChange | null; errors?: never }
  | { input?: never; errors: EditSubtaskErrors } {
  const errors: EditSubtaskErrors = {};
  const titleError = getTitleError(fields.title, "Введіть назву підзадачі.");
  if (titleError) errors.title = titleError;
  const duration = parseDuration(fields.estimatedDurationMinutes);
  if (duration === undefined) errors.estimatedDurationMinutes = DURATION_ERROR;
  if (Object.keys(errors).length || duration === undefined) return { errors };

  const title = fields.title.trim();
  if (title !== original.title) {
    return { input: { title, ...(duration !== original.estimatedDurationMinutes ? { estimatedDurationMinutes: duration } : {}) } };
  }
  if (duration !== original.estimatedDurationMinutes) return { input: { estimatedDurationMinutes: duration } };
  return { input: null };
}
