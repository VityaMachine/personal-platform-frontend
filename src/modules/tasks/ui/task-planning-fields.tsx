import taskStyles from "./tasks.module.css";
import uiStyles from "../../../shared/ui/controls.module.css";
import { Temporal } from "@js-temporal/polyfill";
import { localDateCandidates } from "@/shared/dates/zoned-date";

export function TaskPlanningFields({ id, date, time, timeZone, hint, occurrenceHint, choice, original, dateError, timeError, disabled, canRemove, onDate, onTime, onChoice, onRemove }: {
  id: string; date: string; time: string; timeZone: string; hint: string; occurrenceHint: boolean;
  choice?: string; original: string | null; dateError?: string; timeError?: string; disabled: boolean; canRemove: boolean;
  onDate: (value: string) => void; onTime: (value: string) => void; onChoice: (iso: string) => void; onRemove: () => void;
}) {
  const minuteTime = time.slice(0, 5);
  const { candidates } = date && minuteTime ? localDateCandidates(`${date}T${minuteTime}`, timeZone) : { candidates: [] };
  // Preserve the original DST occurrence even when its seconds are hidden.
  const originalOffset = original ? Temporal.Instant.from(original).toZonedDateTimeISO(timeZone).offset : undefined;
  const currentChoice = choice ?? candidates.find((candidate) => candidate.offset === originalOffset)?.iso ?? "";
  const hintIds = `${id}-hint${occurrenceHint ? ` ${id}-occurrence-hint` : ""}`;
  return <fieldset className={taskStyles.planningFields}>
    <legend>Планування <span className={uiStyles.required}>(необов’язково)</span></legend>
    <div className={taskStyles.planningInputs}>
      <label className={uiStyles.field} htmlFor={`${id}-date`}>Дата
        <input id={`${id}-date`} name="plannedDate" type="date" min="0001-01-01" max="9999-12-31" value={date} disabled={disabled}
          aria-invalid={Boolean(dateError)} aria-describedby={`${hintIds}${dateError ? ` ${id}-date-error` : ""}`}
          onChange={(event) => onDate(event.target.value)} />
        {dateError && <span id={`${id}-date-error`} className={uiStyles.fieldError}>{dateError}</span>}
      </label>
      <label className={uiStyles.field} htmlFor={`${id}-time`}>Час
        <input id={`${id}-time`} name="plannedTime" type="time" step={60} value={minuteTime} disabled={disabled}
          aria-invalid={Boolean(timeError)} aria-describedby={`${hintIds}${timeError ? ` ${id}-time-error` : ""}`}
          onChange={(event) => onTime(event.target.value.slice(0, 5))} />
        {timeError && <span id={`${id}-time-error`} className={uiStyles.fieldError}>{timeError}</span>}
      </label>
    </div>
    <span id={`${id}-hint`} className={uiStyles.fieldHint}>{hint}</span>
    {occurrenceHint && <span id={`${id}-occurrence-hint`} className={uiStyles.fieldHint}>Дата підставлена з повторення. Додайте час, щоб запланувати задачу</span>}
    {candidates.length > 1 && <label className={uiStyles.field} htmlFor={`${id}-offset`}>Уточніть час: годинник переводиться назад
      <select id={`${id}-offset`} value={currentChoice} disabled={disabled} onChange={(event) => onChoice(event.target.value)}
        aria-invalid={Boolean(timeError) && !currentChoice} aria-describedby={timeError ? `${id}-time-error` : `${id}-hint`}>
        <option value="">Виберіть UTC-зсув</option>
        {candidates.map((candidate, index) => <option key={candidate.iso} value={candidate.iso}>UTC{candidate.offset} — {index === 0 ? "перше" : "друге"} входження</option>)}
      </select>
    </label>}
    {canRemove && <button type="button" className={uiStyles.secondaryButton} disabled={disabled} onClick={onRemove}>Прибрати планування</button>}
  </fieldset>;
}
