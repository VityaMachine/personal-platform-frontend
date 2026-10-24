import { Temporal } from "@js-temporal/polyfill";

export type DateField = "plannedAt" | "dueAt";
export type DateOptions = { timeZone: string; choices?: Partial<Record<DateField, string>> };
export type DateCandidate = { iso: string; offset: string };
export type LocalDateResult = { candidates: DateCandidate[]; error?: string };

export function toZonedDateTime(value: string | null, timeZone: string): string {
  if (value === null) return "";
  try { return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone).toPlainDateTime().toString({ fractionalSecondDigits: 3 }); }
  catch { return ""; }
}

export function localDateCandidates(value: string, timeZone: string): LocalDateResult {
  try {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) throw new Error("format");
    const local = Temporal.PlainDateTime.from(value, { overflow: "reject" });
    const candidates: DateCandidate[] = [];
    for (const disambiguation of ["earlier", "later"] as const) {
      const zoned = local.toZonedDateTime(timeZone, { disambiguation });
      // Both DST gap alternatives change the wall time: neither is valid input.
      if (!zoned.toPlainDateTime().equals(local)) continue;
      const iso = zoned.toInstant().toString({ fractionalSecondDigits: 3 });
      if (!candidates.some((candidate) => candidate.iso === iso)) candidates.push({ iso, offset: zoned.offset });
    }
    return candidates.length ? { candidates } : { candidates, error: "Цього місцевого часу не існує через переведення годинника. Виберіть інший час." };
  } catch { return { candidates: [], error: "Вкажіть коректні дату й час у часовому поясі форми." }; }
}

export function resolveLocalDate(value: string, timeZone: string, choice?: string): { iso?: string; error?: string } {
  const result = localDateCandidates(value, timeZone);
  if (result.error) return { error: result.error };
  if (result.candidates.length === 1) return { iso: result.candidates[0].iso };
  const selected = result.candidates.find((candidate) => candidate.iso === choice);
  return selected ? { iso: selected.iso } : { error: "Цей час трапляється двічі через переведення годинника. Виберіть UTC-зсув нижче." };
}

export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b;
  try { return Temporal.Instant.compare(a, b) === 0; } catch { return false; }
}
