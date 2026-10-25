import { Temporal } from "@js-temporal/polyfill";
import type { RoutineSchedule, RoutineEndCondition, RoutinePreviewRange } from "./routine-types";
import { isRoutineDate } from "./routine-validation";

export function formatRoutineDate(value: string) { const [year, month, day] = value.split("-"); return `${day}.${month}.${year}`; }
const weekdays = ["", "понеділок", "вівторок", "середа", "четвер", "п’ятниця", "субота", "неділя"];
const plural = (value: number, forms: [string, string, string]) => value % 100 >= 11 && value % 100 <= 14 ? forms[2] : value % 10 === 1 ? forms[0] : value % 10 >= 2 && value % 10 <= 4 ? forms[1] : forms[2];
export function formatRoutineSchedule(schedule: RoutineSchedule): string {
  const rule = schedule.recurrence;
  if (rule.type === "DAILY") return rule.intervalDays === 1 ? "Щодня" : `Кожні ${rule.intervalDays} ${plural(rule.intervalDays, ["день", "дні", "днів"])}`;
  if (rule.type === "AFTER_COMPLETION") return `Через ${rule.intervalDays} ${plural(rule.intervalDays, ["день", "дні", "днів"])} після завершення`;
  if (rule.type === "WEEKLY") {
    const interval = rule.intervalWeeks === 1 ? "Щотижня" : `Кожні ${rule.intervalWeeks} ${plural(rule.intervalWeeks, ["тиждень", "тижні", "тижнів"])}`;
    const selection = rule.selection;
    return selection.type === "DAYS" ? `${interval}: ${selection.weekdays.map((day) => weekdays[day]).join(" і ")} — окремі виконання`
      : `${interval}: ${weekdays[selection.startWeekday]}–${weekdays[selection.endWeekday]} — одне вікно`;
  }
  const interval = rule.intervalMonths === 1 ? "Щомісяця" : `Кожні ${rule.intervalMonths} ${plural(rule.intervalMonths, ["місяць", "місяці", "місяців"])}`;
  const selection = rule.selection;
  return selection.type === "LAST_DAY" ? `${interval}: останній день місяця`
    : selection.type === "DAY" ? `${interval}: ${selection.day} числа`
      : `${interval}: ${selection.startDay}–${selection.endDay} числа — одне вікно`;
}
export function formatRoutineEnd(end: RoutineEndCondition) {
  return end.type === "NEVER" ? "Без кінцевої дати" : end.type === "COUNT" ? `Після ${end.count} запланованих виконань` : `До ${formatRoutineDate(end.date)} включно`;
}
export function formatShortMonth(schedule: RoutineSchedule) {
  const rule = schedule.recurrence;
  if (rule.type !== "MONTHLY" || rule.selection.type === "LAST_DAY") return null;
  return rule.selection.shortMonthPolicy === "SKIP" ? "Короткий місяць: пропустити виконання, якщо потрібної дати немає."
    : "Короткий місяць: обмежити відсутні дати останнім днем місяця.";
}
const limitations: Record<string, string> = {
  CURRENT_CONFIGURATION_PROJECTION: "Це проєкція поточних налаштувань розкладу, а не історія виконань чи список створених задач.",
  CONFIGURATION_CHANGED: "Налаштування розкладу змінювалися. Проєкція минулих дат може не відповідати історії.",
  PAUSE_HISTORY_UNCERTAIN: "Історія пауз неповна або неоднозначна. Результат враховує лише відомі періоди пауз.",
  COUNT_HISTORY_UNCERTAIN: "Неможливо достовірно визначити залишок виконань для обмеження кількістю за наявною історією.",
  FUTURE_COMPLETIONS_REQUIRED: "Наступні дати залежать від фактичного завершення попереднього виконання. Без цього контексту preview може показати лише перше виконання.",
  COMPUTATION_BUDGET_EXCEEDED: "Досягнуто обмеження обчислень. Результат може бути неповним; спробуйте коротший або раніший період.",
  HISTORY_BUDGET_EXCEEDED: "Історія перевищує ліміт обробки. Для цього запиту preview не може достовірно визначити виконання.",
  CALENDAR_RANGE_EXCEEDED: "Наступна дата виходить за підтримуваний календарний діапазон до 9999 року.",
};
export const formatPreviewLimitation = (value: string) => Object.hasOwn(limitations, value) ? limitations[value] : "Сервер повідомив додаткове обмеження розрахунку. Результат слід трактувати як орієнтовний.";
export function formatPreviewDiagnostic(value: string) {
  return value === "NONEXISTENT_LOCAL_TIME" ? "Через переведення годинника цього локального часу не існує. Точний момент не визначено."
    : value === "AMBIGUOUS_LOCAL_TIME" ? "Через переведення годинника цей локальний час повторюється. UTC-зсув не обрано."
      : "Для цього виконання сервер повідомив додаткову особливість розрахунку. Точний момент може бути невизначеним.";
}
export function defaultRoutinePreviewRange(timezone: string): RoutinePreviewRange {
  const today = Temporal.Now.zonedDateTimeISO(timezone).toPlainDate();
  const to = today.add({ days: 30 });
  return { from: today.toString(), to: to.year > 9999 ? "9999-12-31" : to.toString() };
}
export function routinePreviewRangeError(range: RoutinePreviewRange): string | null {
  if (!isRoutineDate(range.from) || !isRoutineDate(range.to)) return "Вкажіть коректні календарні дати від 0001 до 9999 року.";
  if (range.from > range.to) return "Дата «З дати» не може бути пізнішою за «До дати».";
  if (Temporal.PlainDate.from(range.from).until(range.to).days >= 366) return "Виберіть не більше 366 календарних днів включно.";
  return null;
}
