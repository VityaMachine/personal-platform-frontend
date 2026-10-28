import uiStyles from "../../../../shared/ui/controls.module.css";
import type { RoutineGenerationPreview } from "@/modules/tasks/routines/model/routine-types";
import type { GenerationPlanningDrafts } from "@/modules/tasks/routines/model/routine-generation-planning";
import { planningOutsideOccurrence } from "@/modules/tasks/routines/model/routine-generation-planning";
import { formatRoutineDate, formatPreviewDiagnostic, formatRoutineBasis } from "@/modules/tasks/routines/model/routine-format";
import { localDateCandidates } from "@/shared/dates/zoned-date";
import styles from "./routines.module.css";

export function GenerationPlanningRows({ id, preview, drafts, errors, disabled, onChange }: {
  id: string; preview: RoutineGenerationPreview; drafts: GenerationPlanningDrafts; errors: Record<string, string>; disabled: boolean;
  onChange: (key: string, value: string, choice?: string, date?: string) => void;
}) {
  if (preview.occurrences.length === 0) return <p>У цьому діапазоні фактичних кандидатів немає.</p>;
  return <ol className={styles.generationOccurrences}>{preview.occurrences.map((entry, index) => {
    const key = entry.occurrenceKey;
    const draft = Object.hasOwn(drafts, key) ? drafts[key] : undefined;
    const window = entry.startDate !== entry.endDate;
    const date = window ? (draft?.date ?? (draft?.value ? draft.value.split("T")[0] : entry.startDate)) : entry.startDate;
    const time = (draft?.value.split("T")[1] ?? "").slice(0, 5);
    const error = Object.hasOwn(errors, key) ? errors[key] : undefined;
    const fieldId = `${id}-planning-${index}`;
    const { candidates } = time ? localDateCandidates(`${date}T${time}`, entry.timezone) : { candidates: [] };
    const update = (nextDate: string, nextTime: string, choice?: string) => onChange(key,
      nextTime ? `${nextDate}T${nextTime.slice(0, 5)}` : "", choice, window && nextDate !== entry.startDate ? nextDate : undefined);
    return <li key={key} className={styles.generationCandidate}>
      <p className={styles.generationDate}>
        <strong><time dateTime={entry.startDate}>{formatRoutineDate(entry.startDate)}</time>
          {entry.endDate !== entry.startDate && <> — <time dateTime={entry.endDate}>{formatRoutineDate(entry.endDate)}</time></>}
        </strong>
        {" · "}{entry.timezone}
      </p>
      {entry.basisType && entry.basisAt && <p className={styles.hint}>{formatRoutineBasis(entry, entry.timezone)}</p>}
      {entry.existing ? <span className={`${styles.hint} ${styles.generationExisting}`}>Уже створено</span> : <>
        <div className={styles.generationFields}>
          {window && <label className={`${uiStyles.field} ${styles.generationField}`} htmlFor={`${fieldId}-date`}>Дата
            <input id={`${fieldId}-date`} type="date" min="0001-01-01" max="9999-12-31" value={date} disabled={disabled}
              aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined}
              onChange={(event) => update(event.target.value, time)} />
          </label>}
          <label className={`${uiStyles.field} ${styles.generationField}`} htmlFor={`${fieldId}-time`}>Час, необов’язково
            <input id={`${fieldId}-time`} type="time" step={60} value={time} disabled={disabled}
              aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined}
              onChange={(event) => update(date, event.target.value)} />
          </label>
        </div>
        {candidates.length > 1 && <label className={`${uiStyles.field} ${styles.generationOffset}`} htmlFor={`${fieldId}-offset`}>Уточніть час: годинник переводиться назад
          <select id={`${fieldId}-offset`} value={draft?.choice ?? ""} disabled={disabled}
            aria-invalid={Boolean(error) && !draft?.choice} aria-describedby={error ? `${fieldId}-error` : undefined}
            onChange={(event) => update(date, time, event.target.value)}>
            <option value="">Виберіть UTC-зсув</option>
            {candidates.map((candidate, candidateIndex) => <option key={candidate.iso} value={candidate.iso}>UTC{candidate.offset} — {candidateIndex === 0 ? "перше" : "друге"} входження</option>)}
          </select>
        </label>}
        {error && <p id={`${fieldId}-error`} className={`${uiStyles.fieldError} ${styles.generationMessage}`} role="alert">{error}</p>}
        {draft?.value && planningOutsideOccurrence(draft.value, entry) && <p className={`${styles.hint} ${styles.generationMessage}`}>Особистий план відрізняється від початкового періоду виконання. Це дозволено й не змінює вікно розкладу.</p>}
      </>}
      {entry.diagnostics.map((diagnostic, diagnosticIndex) => <p key={diagnosticIndex} className={`${styles.hint} ${styles.generationMessage}`}>{formatPreviewDiagnostic(diagnostic)}</p>)}
    </li>;
  })}</ol>;
}
