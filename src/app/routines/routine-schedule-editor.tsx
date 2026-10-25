"use client";
import { useState, type ChangeEvent } from "react";
import { timeZoneOptions } from "@/lib/settings";
import { parseRoutineRule, type CreateRoutineFields, type RoutineFormErrors } from "@/lib/create-routine-input";
import { formatRoutineSchedule, formatRoutineEnd } from "@/lib/routine-format";
import { MAX_DURATION_MINUTES } from "@/lib/task-field-input";
import shared from "../page.module.css";
import styles from "./routines.module.css";

export type RoutineFieldChange = <K extends keyof CreateRoutineFields>(key: K, value: CreateRoutineFields[K]) => void;
type EditorProps = { fields: CreateRoutineFields; errors: RoutineFormErrors; disabled: boolean; onChange: RoutineFieldChange };
type FieldName = Exclude<keyof CreateRoutineFields, "weekdays">;
export function RoutineFormField({ name, label, type = "text", options, max, required = true, ...props }: EditorProps & {
  name: FieldName; label: string; type?: "text" | "number" | "date" | "time";
  options?: readonly (readonly [string, string])[]; max?: number; required?: boolean;
}) {
  const id = `routine-${name}`, error = props.errors[name];
  const common = { id, name, value: props.fields[name], disabled: props.disabled, required,
    "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => props.onChange(name, event.target.value) };
  return <label className={shared.field} htmlFor={id}>{label}
    {options ? <select {...common}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> :
      <input {...common} type={type} list={name === "timezone" ? "routine-timezones" : undefined}
        min={type === "number" ? 1 : type === "date" ? "0001-01-01" : undefined}
        max={type === "number" ? max ?? MAX_DURATION_MINUTES : type === "date" ? "9999-12-31" : undefined}
        step={type === "number" ? 1 : type === "time" ? 60 : undefined} />}
    {error && <span id={`${id}-error`} className={shared.fieldError}>{error}</span>}
  </label>;
}
const week = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"];
const dayOptions = week.map((label, index) => [String(index + 1), label] as const);

export function RoutineScheduleEditor(props: EditorProps) {
  const { fields, errors, disabled, onChange } = props;
  const [zones] = useState(() => timeZoneOptions(fields.timezone));
  const rule = parseRoutineRule(fields);
  return <section className={styles.scheduleEditor} aria-labelledby="routine-schedule-heading">
    <h3 id="routine-schedule-heading" className={shared.sectionTitle}>Розклад</h3>
    <RoutineFormField {...props} name="timezone" label="Часовий пояс (IANA)" />
    <datalist id="routine-timezones">{zones.map((zone) => <option key={zone} value={zone} />)}</datalist>
    <RoutineFormField {...props} name="startDate" label="Дата початку" type="date" />
    <RoutineFormField {...props} name="localTime" label="Локальний час (необов’язково)" type="time" required={false} />
    <p className={styles.hint}>Дати й час належать часовому поясу шаблону. Зміна поясу не змінює введену дату початку.</p>
    <RoutineFormField {...props} name="recurrence" label="Повторення" options={[
      ["DAILY", "Кожні N днів"], ["WEEKLY", "Кожні N тижнів"], ["MONTHLY", "Кожні N місяців"], ["AFTER_COMPLETION", "Через N днів після завершення"],
    ]} />
    {fields.recurrence === "DAILY" && <RoutineFormField {...props} name="dailyInterval" label="Інтервал у днях" type="number" />}
    {fields.recurrence === "AFTER_COMPLETION" && <>
      <RoutineFormField {...props} name="afterInterval" label="Днів після завершення" type="number" />
      <p className={styles.hint}>Наступна дата залежить від фактичного DONE попередньої задачі. Перше виконання прив’язане до дати початку. Багатоденного вікна тут немає.</p>
    </>}
    {fields.recurrence === "WEEKLY" && <>
      <RoutineFormField {...props} name="intervalWeeks" label="Інтервал у тижнях" type="number" />
      <RoutineFormField {...props} name="weeklyMode" label="Спосіб виконання" options={[["DAYS", "В окремі дні"], ["WINDOW", "Одне вікно виконання"]]} />
      <p className={styles.hint}>Понеділок і четвер — два окремі виконання. Субота–неділя — одне вікно виконання. Вікно лежить у межах одного тижня від понеділка до неділі.</p>
      {fields.weeklyMode === "DAYS" ? <fieldset className={styles.weekdays} disabled={disabled} aria-describedby={errors.weekdays ? "routine-weekdays-error" : undefined}>
        <legend>Дні виконання (хоча б один)</legend>
        {week.map((label, index) => <label key={index}><input type="checkbox" checked={fields.weekdays.includes(index + 1)} aria-invalid={Boolean(errors.weekdays)}
          aria-describedby={errors.weekdays ? "routine-weekdays-error" : undefined} onChange={(event) => onChange("weekdays", event.target.checked ? [...fields.weekdays, index + 1] : fields.weekdays.filter((day) => day !== index + 1))} /> {label}</label>)}
        {errors.weekdays && <span id="routine-weekdays-error" className={shared.fieldError}>{errors.weekdays}</span>}
      </fieldset> : <>
        <RoutineFormField {...props} name="startWeekday" label="Початковий день вікна" options={dayOptions} />
        <RoutineFormField {...props} name="endWeekday" label="Кінцевий день вікна" options={dayOptions} />
      </>}
    </>}
    {fields.recurrence === "MONTHLY" && <>
      <RoutineFormField {...props} name="intervalMonths" label="Інтервал у місяцях" type="number" />
      <RoutineFormField {...props} name="monthlyMode" label="Спосіб виконання" options={[["DAY", "Конкретне число"], ["WINDOW", "Вікно чисел"], ["LAST_DAY", "Останній день місяця"]]} />
      {fields.monthlyMode === "DAY" && <RoutineFormField {...props} name="monthDay" label="Число місяця" type="number" max={31} />}
      {fields.monthlyMode === "WINDOW" && <>
        <RoutineFormField {...props} name="startDay" label="Початкове число вікна" type="number" max={31} />
        <RoutineFormField {...props} name="endDay" label="Кінцеве число вікна" type="number" max={31} />
      </>}
      {fields.monthlyMode !== "LAST_DAY" && <>
        <RoutineFormField {...props} name="shortMonthPolicy" label="Політика короткого місяця" options={[["SKIP", "Пропустити період"], ["CLAMP", "Обмежити останнім днем місяця"]]} />
        <p className={styles.hint}>Якщо потрібного числа немає: пропустити весь період або обмежити відсутні межі останнім днем місяця.</p>
      </>}
    </>}
    <RoutineFormField {...props} name="endType" label="Умова завершення" options={[["NEVER", "Без кінцевої дати"], ["UNTIL_DATE", "До дати включно"], ["COUNT", "Після N запланованих виконань"]]} />
    {fields.endType === "UNTIL_DATE" && <RoutineFormField {...props} name="endDate" label="Кінцева дата включно" type="date" />}
    {fields.endType === "COUNT" && <>
      <RoutineFormField {...props} name="endCount" label="Кількість запланованих виконань" type="number" />
      <p className={styles.hint}>COUNT означає кількість запланованих виконань, а не кількість DONE.</p>
    </>}
    {rule.schedule && rule.endCondition && <p className={styles.ruleDescription} role="status">{formatRoutineSchedule(rule.schedule)}. {formatRoutineEnd(rule.endCondition)}.</p>}
  </section>;
}
