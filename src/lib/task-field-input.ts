export const MAX_DURATION_MINUTES = 2_147_483_647;

export function parseDuration(value: string): number | undefined {
  const duration = Number(value);
  return value.trim() && Number.isInteger(duration) && duration > 0 && duration <= MAX_DURATION_MINUTES
    ? duration : undefined;
}

export function getTitleError(value: string, requiredMessage: string): string | undefined {
  const title = value.trim();
  if (!title) return requiredMessage;
  if (title.length > 160) return "Назва має містити не більше 160 символів після видалення пробілів на краях.";
}

export const DURATION_ERROR = "Введіть цілу кількість хвилин від 1 до 2147483647.";

export function getCancellationNoteError(value: string): string | undefined {
  if (!value.trim()) return "Вкажіть причину скасування.";
}

export { toZonedDateTime as toLocalDateTime } from "./zoned-date";
