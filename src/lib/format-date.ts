/** Uses the browser's local timezone, just like task cards. */
export function formatDate(value: string | null | undefined, empty = "Не вказано") {
  if (!value) return empty;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" })
    : empty;
}
