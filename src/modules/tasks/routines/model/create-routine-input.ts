import { Temporal } from "@js-temporal/polyfill";
import { TASK_PRIORITIES } from "../../model/task-types";
import type { CreateRoutineInput, RoutineSchedule, RoutineEndCondition } from "./routine-types";
import { isRoutineDate } from "./routine-validation";
import { isTimeZone } from "../../../settings/preferences-runtime";
import { isAreaId } from "../../../../entities/areas/public";
import { getTitleError, parseDuration, DURATION_ERROR, MAX_DURATION_MINUTES } from "../../model/task-field-input";
import { getSubtaskDuration, type SubtaskFields, type SubtaskErrors } from "../../model/create-task-input";

export type CreateRoutineFields = {
  autoGenerate: boolean; generationHorizonDays: string;
  title: string; description: string; priority: string; areaId: string; estimatedDurationMinutes: string;
  timezone: string; startDate: string; localTime: string; recurrence: string;
  dailyInterval: string; afterInterval: string; intervalWeeks: string; weeklyMode: string; weekdays: number[];
  startWeekday: string; endWeekday: string; intervalMonths: string; monthlyMode: string;
  monthDay: string; startDay: string; endDay: string; shortMonthPolicy: string;
  endType: string; endDate: string; endCount: string;
};
export type RoutineFormErrors = Partial<Record<keyof CreateRoutineFields, string>>;
export function initialRoutineFields(timezone: string): CreateRoutineFields {
  return { autoGenerate: false, generationHorizonDays: "7", title: "", description: "", priority: "MEDIUM", areaId: "", estimatedDurationMinutes: "",
    timezone, startDate: Temporal.Now.zonedDateTimeISO(timezone).toPlainDate().toString(), localTime: "", recurrence: "DAILY",
    dailyInterval: "1", afterInterval: "90", intervalWeeks: "1", weeklyMode: "DAYS", weekdays: [1], startWeekday: "6", endWeekday: "7",
    intervalMonths: "1", monthlyMode: "DAY", monthDay: "1", startDay: "15", endDay: "23", shortMonthPolicy: "SKIP",
    endType: "NEVER", endDate: "", endCount: "1" };
}
export function parseRoutineRule(fields: CreateRoutineFields): { schedule?: RoutineSchedule; endCondition?: RoutineEndCondition; errors: RoutineFormErrors } {
  const errors: RoutineFormErrors = {};
  const number = (key: keyof CreateRoutineFields, max = MAX_DURATION_MINUTES) => {
    const raw = fields[key];
    const value = typeof raw === "string" ? parseDuration(raw) : undefined;
    if (value === undefined || value > max) { errors[key] = `Введіть ціле число від 1 до ${max}.`; return 1; }
    return value;
  };
  const timezone = fields.timezone.trim();
  if (timezone.length > 100 || !/^[A-Za-z][A-Za-z0-9._+\-/]*$/.test(timezone) || !isTimeZone(timezone)) errors.timezone = "Вкажіть коректний часовий пояс IANA.";
  if (!isRoutineDate(fields.startDate)) errors.startDate = "Вкажіть коректну локальну дату від 0001 до 9999 року.";
  if (fields.localTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.localTime)) errors.localTime = "Вкажіть час у форматі HH:mm від 00:00 до 23:59.";
  let recurrence: RoutineSchedule["recurrence"] | undefined;
  if (fields.recurrence === "DAILY") recurrence = { type: "DAILY", intervalDays: number("dailyInterval") };
  else if (fields.recurrence === "AFTER_COMPLETION") recurrence = { type: "AFTER_COMPLETION", intervalDays: number("afterInterval") };
  else if (fields.recurrence === "WEEKLY") {
    const intervalWeeks = number("intervalWeeks");
    if (fields.weeklyMode === "DAYS") {
      if (!fields.weekdays.length || fields.weekdays.length > 7 || fields.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) || new Set(fields.weekdays).size !== fields.weekdays.length) errors.weekdays = "Оберіть хоча б один день тижня без повторів.";
      recurrence = { type: "WEEKLY", intervalWeeks, selection: { type: "DAYS", weekdays: [...fields.weekdays].sort((a, b) => a - b) } };
    } else if (fields.weeklyMode === "WINDOW") {
      const startWeekday = number("startWeekday", 7), endWeekday = number("endWeekday", 7);
      if (startWeekday > endWeekday) errors.endWeekday = "Кінець вікна має бути не раніше початку в межах одного тижня (понеділок–неділя).";
      recurrence = { type: "WEEKLY", intervalWeeks, selection: { type: "WINDOW", startWeekday, endWeekday } };
    } else errors.weeklyMode = "Оберіть спосіб повторення.";
  } else if (fields.recurrence === "MONTHLY") {
    const intervalMonths = number("intervalMonths");
    if (fields.monthlyMode === "LAST_DAY") recurrence = { type: "MONTHLY", intervalMonths, selection: { type: "LAST_DAY" } };
    else {
      const shortMonthPolicy = fields.shortMonthPolicy === "CLAMP" ? "CLAMP" : "SKIP";
      if (fields.shortMonthPolicy !== "CLAMP" && fields.shortMonthPolicy !== "SKIP") errors.shortMonthPolicy = "Оберіть політику короткого місяця.";
      if (fields.monthlyMode === "DAY") recurrence = { type: "MONTHLY", intervalMonths, selection: { type: "DAY", day: number("monthDay", 31), shortMonthPolicy } };
      else if (fields.monthlyMode === "WINDOW") {
        const startDay = number("startDay", 31), endDay = number("endDay", 31);
        if (startDay > endDay) errors.endDay = "Кінець вікна має бути не раніше початку.";
        recurrence = { type: "MONTHLY", intervalMonths, selection: { type: "WINDOW", startDay, endDay, shortMonthPolicy } };
      } else errors.monthlyMode = "Оберіть спосіб повторення.";
    }
  } else errors.recurrence = "Оберіть тип повторення.";
  let endCondition: RoutineEndCondition | undefined;
  if (fields.endType === "NEVER") endCondition = { type: "NEVER" };
  else if (fields.endType === "COUNT") endCondition = { type: "COUNT", count: number("endCount") };
  else if (fields.endType === "UNTIL_DATE") {
    if (!isRoutineDate(fields.endDate)) errors.endDate = "Вкажіть коректну кінцеву дату.";
    else if (isRoutineDate(fields.startDate) && fields.endDate < fields.startDate) errors.endDate = "Дата завершення не може передувати даті початку.";
    endCondition = { type: "UNTIL_DATE", date: fields.endDate };
  } else errors.endType = "Оберіть умову завершення.";
  return Object.keys(errors).length || !recurrence || !endCondition ? { errors } : { errors, schedule: { version: 1, localTime: fields.localTime || null, recurrence }, endCondition };
}
export function parseCreateRoutineFields(fields: CreateRoutineFields, subtasks: readonly SubtaskFields[]):
  { input?: CreateRoutineInput; errors: RoutineFormErrors; subtaskErrors: SubtaskErrors } {
  const rule = parseRoutineRule(fields), errors = { ...rule.errors }, subtaskErrors: SubtaskErrors = {};
  const horizon = Number(fields.generationHorizonDays);
  if (!/^\d+$/.test(fields.generationHorizonDays) || !Number.isInteger(horizon) || horizon < 1 || horizon > 30) errors.generationHorizonDays = "Введіть ціле число від 1 до 30.";
  if (typeof fields.autoGenerate !== "boolean") errors.autoGenerate = "Оберіть стан автоматичного створення.";
  const titleError = getTitleError(fields.title, "Введіть назву шаблону.");
  if (titleError) errors.title = titleError;
  if (fields.areaId && !isAreaId(fields.areaId)) errors.areaId = "Виберіть сферу зі списку.";
  const priority = TASK_PRIORITIES.find((value) => value === fields.priority);
  if (!priority) errors.priority = "Оберіть пріоритет зі списку.";
  const duration = parseDuration(fields.estimatedDurationMinutes);
  if (!subtasks.length && duration === undefined) errors.estimatedDurationMinutes = DURATION_ERROR;
  for (const row of subtasks) {
    const rowErrors: SubtaskErrors[string] = {};
    const error = getTitleError(row.title, "Введіть назву шаблону підзадачі.");
    if (error) rowErrors.title = error;
    if (parseDuration(row.estimatedDurationMinutes) === undefined) rowErrors.estimatedDurationMinutes = DURATION_ERROR;
    if (Object.keys(rowErrors).length) subtaskErrors[row.localId] = rowErrors;
  }
  const total = getSubtaskDuration(subtasks);
  if (subtasks.length && total !== undefined && total > MAX_DURATION_MINUTES) errors.estimatedDurationMinutes = "Сума тривалостей не може перевищувати 2147483647 хвилин.";
  if (Object.keys(errors).length || Object.keys(subtaskErrors).length || !rule.schedule || !rule.endCondition || !priority) return { errors, subtaskErrors };
  const children = subtasks.map((row) => ({ title: row.title.trim(), estimatedDurationMinutes: Number(row.estimatedDurationMinutes) }));
  return { errors, subtaskErrors, input: {
    autoGenerate: fields.autoGenerate, generationHorizonDays: horizon,
    title: fields.title.trim(), description: fields.description.trim() || null, areaId: fields.areaId ? fields.areaId.toLowerCase() : null, priority,
    timezone: fields.timezone.trim(), startDate: fields.startDate, schedule: rule.schedule, endCondition: rule.endCondition,
    ...(children.length ? { subtasks: children as [typeof children[number], ...typeof children] } : { estimatedDurationMinutes: duration! }),
  } };
}

/** Only attach known validation paths; never copy arbitrary server keys into form state. */
export function routineApiFieldErrors(details: unknown, fields: CreateRoutineFields, rows: readonly SubtaskFields[]) {
  const errors: RoutineFormErrors = {}, subtaskErrors: SubtaskErrors = {};
  if (!Array.isArray(details)) return { errors, subtaskErrors };
  const paths: Record<string, keyof CreateRoutineFields> = {
    autoGenerate: "autoGenerate", generationHorizonDays: "generationHorizonDays",
    title: "title", description: "description", priority: "priority", areaId: "areaId", estimatedDurationMinutes: "estimatedDurationMinutes", timezone: "timezone", startDate: "startDate",
    "schedule.localTime": "localTime", "schedule.recurrence.type": "recurrence", "schedule.recurrence.intervalDays": fields.recurrence === "AFTER_COMPLETION" ? "afterInterval" : "dailyInterval",
    "schedule.recurrence.intervalWeeks": "intervalWeeks", "schedule.recurrence.intervalMonths": "intervalMonths",
    "schedule.recurrence.selection.weekdays": "weekdays", "schedule.recurrence.selection.startWeekday": "startWeekday", "schedule.recurrence.selection.endWeekday": "endWeekday",
    "schedule.recurrence.selection.day": "monthDay", "schedule.recurrence.selection.startDay": "startDay", "schedule.recurrence.selection.endDay": "endDay", "schedule.recurrence.selection.shortMonthPolicy": "shortMonthPolicy",
    "schedule.recurrence.selection.type": fields.recurrence === "WEEKLY" ? "weeklyMode" : "monthlyMode",
    "endCondition.type": "endType", "endCondition.date": "endDate", "endCondition.count": "endCount",
  };
  for (const issue of details) {
    if (!issue || !Array.isArray(issue.path)) continue;
    const path = issue.path as unknown[];
    if (path[0] === "subtasks" && typeof path[1] === "number" && rows[path[1]] && (path[2] === "title" || path[2] === "estimatedDurationMinutes")) {
      const id = rows[path[1]].localId;
      subtaskErrors[id] = { ...subtaskErrors[id], [path[2]]: "Перевірте значення: сервер відхилив це поле." };
    } else {
      const key = path.slice(0, path[3] === "weekdays" ? 4 : path.length).map(String).join(".");
      if (Object.hasOwn(paths, key)) errors[paths[key]] = "Перевірте значення: сервер відхилив це поле.";
    }
  }
  return { errors, subtaskErrors };
}
