import { Temporal } from "@js-temporal/polyfill";
import type { RoutineScheduleVersion, CreateRoutineScheduleVersionInput } from "./routine-types";
import { parseRoutineRule, type CreateRoutineFields } from "./create-routine-input";
import { isRoutineDate } from "./routine-validation";
import { ApiError } from "../../../../shared/api/api";

export const SCHEDULE_CHANGED_EVENT = "routine-schedule-changed";
export function invalidateRoutineSchedule(id: string) {
  window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGED_EVENT, { detail: id }));
}
export function minimumEffectiveDate(versions: readonly RoutineScheduleVersion[], now = Temporal.Now.instant()): string | null {
  const first = versions[0], latest = versions.at(-1);
  if (!first || !latest || versions.length >= 100) return null;
  try {
    let date = now.toZonedDateTimeISO(first.effectiveTimezone).toPlainDate().add({ days: 1 });
    if (date.toString() <= latest.effectiveDate) date = Temporal.PlainDate.from(latest.effectiveDate).add({ days: 1 });
    while (Temporal.Instant.compare(date.toZonedDateTime(first.effectiveTimezone).toInstant(), latest.effectiveAt) <= 0) date = date.add({ days: 1 });
    return date.year <= 9999 ? date.toString() : null;
  } catch { return null; }
}
export function scheduleVersionStatus(version: RoutineScheduleVersion, versions: readonly RoutineScheduleVersion[], now = Temporal.Now.instant()) {
  if (Temporal.Instant.compare(version.effectiveAt, now) > 0) return "Майбутній";
  const current = versions.findLast((entry) => Temporal.Instant.compare(entry.effectiveAt, now) <= 0);
  return current?.id === version.id ? "Чинний" : "Попередній";
}
export function parseScheduleVersionFields(fields: CreateRoutineFields, effectiveDate: string, versions: readonly RoutineScheduleVersion[], now = Temporal.Now.instant()) {
  const rule = parseRoutineRule(fields);
  let effectiveError: string | undefined;
  const first = versions[0], latest = versions.at(-1), minimum = minimumEffectiveDate(versions, now);
  if (!minimum) effectiveError = "Досягнуто межі версій або доступних дат. Нову версію створити неможливо.";
  else if (!isRoutineDate(effectiveDate)) effectiveError = "Вкажіть коректну календарну дату.";
  else if (effectiveDate < minimum) effectiveError = `Оберіть дату не раніше ${minimum}. Дата має бути майбутньою та пізнішою за останню версію.`;
  if (latest && (fields.recurrence === "AFTER_COMPLETION") !== (latest.schedule.recurrence.type === "AFTER_COMPLETION")) {
    rule.errors.recurrence = "Перехід між календарним розкладом і повторенням після результату потребує окремої Routine.";
  }
  if (first?.schedule.recurrence.type === "AFTER_COMPLETION" && fields.startDate !== first.startDate) rule.errors.startDate = "Дата початку AFTER_COMPLETION незмінна для всіх версій.";
  const input: CreateRoutineScheduleVersionInput | undefined = !effectiveError && !Object.keys(rule.errors).length && rule.schedule && rule.endCondition
    ? { effectiveDate, timezone: fields.timezone.trim(), startDate: fields.startDate, schedule: rule.schedule, endCondition: rule.endCondition } : undefined;
  return { input, errors: rule.errors, effectiveError };
}
export function scheduleVersionFailure(error: unknown) {
  const uncertain = !(error instanceof ApiError) || error.status >= 500 || error.status < 400;
  if (uncertain) return { uncertain, message: "Не отримано підтвердження. Версію могло бути створено. Перевірте версії; автоматичного повтору POST немає." };
  const messages: Record<string, string> = {
    "effectiveDate must be strictly later than the latest schedule version.": "Дата має бути строго пізнішою за останню версію. Перевірте версії.",
    "Retroactive schedule versions are not allowed. Choose a future date in effectiveTimezone.": "День початку дії вже розпочався. Виберіть майбутню дату в часовому поясі першої версії.",
    "COUNT cannot be less than the number of already materialized occurrences.": "Загальний COUNT не може бути меншим за кількість уже створених виконань, включно з майбутніми.",
    "Schedule version budget reached.": "Досягнуто ліміту 100 версій.",
  };
  return { uncertain, message: messages[error.apiMessage ?? ""] ?? (error.status === 409
    ? "Стан Routine змінився або конфігурація несумісна. Перевірте версії та введені дані. Чернетку збережено."
    : error.message) };
}
