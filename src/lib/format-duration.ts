export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} хв`;
  return remainder === 0 ? `${hours} год` : `${hours} год ${remainder} хв`;
}

/** Formats the server snapshot, without rounding partial minutes upwards. */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "Недостатньо даних";
  if (seconds === 0) return "0 хв";
  if (seconds < 60) return "менше хвилини";
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / (24 * 60));
  if (days === 0) return formatDuration(minutes);
  const lastTwo = days % 100;
  const dayLabel = lastTwo >= 11 && lastTwo <= 14 ? "днів"
    : days % 10 === 1 ? "день" : days % 10 >= 2 && days % 10 <= 4 ? "дні" : "днів";
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  return `${days} ${dayLabel}${hours > 0 ? ` ${hours} год` : ""}`;
}
