/** Formatting always receives the user's zone; UTC is the SSR/pure-helper fallback. */
export function formatDate(value: string | null | undefined, timeZone = "UTC", empty = "Не вказано") {
  if (!value) return empty;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone })
    : empty;
}
