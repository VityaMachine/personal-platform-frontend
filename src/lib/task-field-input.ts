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

export function toLocalDateTime(value: string | null): string {
  if (value === null) return "";
  const date = new Date(value);
  const pad = (part: number, length = 2) => String(part).padStart(length, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function localDateToIso(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) return undefined;
  // Date interprets datetime-local in the browser's timezone.
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  // Reject calendar overflow and local times skipped by daylight saving time.
  const [day, time] = value.split("T");
  const [hours, minutes, seconds = "0"] = time.split(":");
  if (toLocalDateTime(date.toISOString()) !== `${day}T${hours}:${minutes}:${Number(seconds).toFixed(3).padStart(6, "0")}`) return undefined;
  return date.toISOString();
}
