import type { CreateRoutineFields, RoutineFormErrors } from "@/modules/tasks/routines/model/create-routine-input";
import { RoutineFormField, type RoutineFieldChange } from "./routine-schedule-editor";
import shared from "../../../../app/page.module.css";
import styles from "./routines.module.css";

export function RoutineAutomationEditor(props: {
  fields: CreateRoutineFields; errors: RoutineFormErrors; disabled: boolean; onChange: RoutineFieldChange;
}) {
  const { fields, errors, disabled, onChange } = props;
  const completion = fields.recurrence === "AFTER_COMPLETION";
  return <section className={styles.scheduleEditor} aria-labelledby="routine-automation-heading">
    <h3 id="routine-automation-heading" className={shared.sectionTitle}>Автоматичне створення задач</h3>
    <label htmlFor="routine-autoGenerate">
      <input id="routine-autoGenerate" type="checkbox" checked={fields.autoGenerate} disabled={disabled}
        onChange={(event) => onChange("autoGenerate", event.target.checked)} aria-invalid={Boolean(errors.autoGenerate)}
        aria-describedby={errors.autoGenerate ? "routine-autoGenerate-error" : undefined} /> Автоматично створювати задачі
    </label>
    {errors.autoGenerate && <span id="routine-autoGenerate-error" className={shared.fieldError}>{errors.autoGenerate}</span>}
    {!completion && <>
      <RoutineFormField {...props} name="generationHorizonDays" label="Горизонт генерації, днів" type="number" max={30} hint="Включно із сьогодні. Наприклад, 7 — сьогодні та наступні 6 днів" />
      <p className={styles.hint}>Календарні виконання після простою створюються від поточного дня у часовому поясі розкладу; активне багатоденне вікно включається повністю.</p>
    </>}
    {completion && <p className={styles.hint}>Цей режим створює одного наступника після завершення або пропуску під час найближчої перевірки сервера, незалежно від горизонту.</p>}
    {completion && errors.generationHorizonDays && <p role="alert" className={shared.fieldError}>{errors.generationHorizonDays} Поверніться до календарного режиму, щоб виправити збережений горизонт.</p>}
    <p className={styles.hint}>Вимкнення або зменшення горизонту не змінює вже створені задачі. Пауза Routine призупиняє і автоматичне створення.</p>
    <p className={styles.hint}>Це налаштування Routine. Глобальне ввімкнення runner контролюється backend; збереження налаштувань не підтверджує створення задач.</p>
  </section>;
}
