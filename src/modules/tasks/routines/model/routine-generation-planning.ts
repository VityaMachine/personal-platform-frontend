import type { GenerateRoutineInput, RoutineGenerationOccurrence, RoutineGenerationPreview, RoutinePreviewRange } from "./routine-types";
import { resolveLocalDate, toMinuteDateTime } from "../../../../lib/zoned-date";
import { isRoutineDate } from "./routine-validation";

export type GenerationPlanningDraft = { value: string; choice?: string; date?: string };
export type GenerationPlanningDrafts = Record<string, GenerationPlanningDraft>;
export function reconcileGenerationPlanning(drafts: GenerationPlanningDrafts, occurrences: readonly RoutineGenerationOccurrence[]) {
  const allowed = new Set(occurrences.filter((entry) => !entry.existing).map((entry) => entry.occurrenceKey));
  const kept: GenerationPlanningDrafts = Object.create(null);
  const removed: string[] = [];
  for (const [key, draft] of Object.entries(drafts)) {
    if (allowed.has(key)) kept[key] = { ...draft };
    else if (draft.value || draft.date !== undefined) removed.push(key);
  }
  return { drafts: kept, removed };
}
export function buildGenerationPayload(range: RoutinePreviewRange, preview: RoutineGenerationPreview, drafts: GenerationPlanningDrafts, afterCompletion: boolean) {
  const errors: Record<string, string> = Object.create(null);
  const planning: NonNullable<GenerateRoutineInput["planning"]> = [];
  for (const entry of preview.occurrences) {
    if (entry.existing) continue;
    const draft = drafts[entry.occurrenceKey];
    if (!draft?.value) continue;
    const resolved = resolveLocalDate(toMinuteDateTime(draft.value), entry.timezone, draft.choice);
    if (!resolved.iso) errors[entry.occurrenceKey] = resolved.error ?? "Перевірте запланований час.";
    else planning.push({ occurrenceKey: entry.occurrenceKey, plannedAt: resolved.iso });
  }
  const limit = afterCompletion ? 1 : 100;
  return { errors, error: planning.length > limit ? `Можна запланувати не більше ${limit} нових виконань за запит.` : null,
    payload: { from: range.from, to: range.to, ...(planning.length ? { planning } : {}) } satisfies GenerateRoutineInput };
}
export function planningOutsideOccurrence(value: string, occurrence: RoutineGenerationOccurrence) {
  const date = value.split("T")[0];
  return isRoutineDate(date) && (date < occurrence.startDate || date > occurrence.endDate);
}
