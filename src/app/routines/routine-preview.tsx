"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import type { Routine, RoutinePreview as Preview, RoutinePreviewRange } from "@/lib/routine-types";
import { getRoutinePreview, routineError } from "@/lib/routines";
import { defaultRoutinePreviewRange, routinePreviewRangeError, formatRoutineDate, formatPreviewDiagnostic, formatPreviewLimitation } from "@/lib/routine-format";
import shared from "../page.module.css";
import styles from "./routines.module.css";
import { RoutineConflicts } from "./routine-conflicts";
import { SCHEDULE_CHANGED_EVENT } from "@/lib/routine-schedule-versions";

export function RoutinePreview({ routine, disabled }: { routine: Routine; disabled: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState(() => defaultRoutinePreviewRange(routine.timezone));
  const [range, setRange] = useState<RoutinePreviewRange>(draft);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const invalidate = (event: Event) => { if ((event as CustomEvent<string>).detail === routine.id) setRevision((value) => value + 1); };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, invalidate);
    return () => window.removeEventListener(SCHEDULE_CHANGED_EVENT, invalidate);
  }, [routine.id]);
  const [result, setResult] = useState<{ routine: Routine; range: RoutinePreviewRange; revision: number; data: Preview | null; error: string | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getRoutinePreview(routine.id, range, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ routine, range, revision, data, error: null });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setResult({ routine, range, revision, data: null, error: routineError(error) });
    });
    return () => controller.abort();
  }, [routine, range, revision]);
  const current = result?.routine === routine && result.range === range && result.revision === revision;
  const data = current ? result.data : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    const error = routinePreviewRangeError(draft); setFieldError(error);
    if (!error && !disabled) setRange({ ...draft });
  }
  return <section className={styles.preview} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Попередній перегляд виконань</h3>
    <p className={styles.hint}>Preview показує проєкцію розкладу, а не список уже створених задач. Перегляд нічого не створює.</p>
    {routine.schedule.recurrence.type === "AFTER_COMPLETION" && <p className={styles.hint}>Фактичний наступник залежить від завершення або пропуску попереднього виконання. Без контексту результату тут доступне лише перше виконання, якщо воно потрапляє у діапазон. Фактичного кандидата зі збереженого результату можна перевірити в діалозі «Створити задачі».</p>}
    {routine.pausedAt && <p className={styles.hint}>Відкритий період паузи може прибрати майбутні виконання з preview. Уже створені задачі залишаються доступними.</p>}
    <form onSubmit={submit} className={styles.range} noValidate>
      <label className={shared.field}>З дати
        <input type="date" min="0001-01-01" max="9999-12-31" value={draft.from} disabled={disabled} aria-invalid={Boolean(fieldError)} aria-describedby={`${id}-range-hint${fieldError ? ` ${id}-error` : ""}`} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
      </label>
      <label className={shared.field}>До дати
        <input type="date" min="0001-01-01" max="9999-12-31" value={draft.to} disabled={disabled} aria-invalid={Boolean(fieldError)} aria-describedby={`${id}-range-hint${fieldError ? ` ${id}-error` : ""}`} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
      </label>
      <button type="submit" className={shared.secondaryButton} disabled={disabled}>Показати виконання</button>
    </form>
    <p id={`${id}-range-hint`} className={styles.hint}>Локальні дати в {routine.timezone}. Максимум 366 днів включно, до 100 виконань.</p>
    {fieldError && <p id={`${id}-error`} role="alert" className={shared.fieldError}>{fieldError}</p>}
    <div aria-busy={!current}>
      <p className={styles.hint}>Застосований діапазон: {formatRoutineDate(range.from)} — {formatRoutineDate(range.to)}</p>
      {!current && <p role="status">Завантаження preview…</p>}
      {current && result.error && <div role="alert" className={shared.error}>
        <p>Не вдалося завантажити preview. {result.error}</p>
        <button type="button" className={shared.secondaryButton} disabled={disabled} onClick={() => setRange({ ...range })}>Повторити preview</button>
      </div>}
      {data && <>
        <RoutineConflicts conflicts={data.conflicts} />
        <ul className={styles.messages}>{data.limitations.map((value, index) => <li key={index}>{formatPreviewLimitation(value)}</li>)}</ul>
        {data.truncated && <p role="status">Показано перші 100 виконань. Є додаткові результати — звузьте діапазон.</p>}
        {data.occurrences.length === 0 ? <p>У цьому діапазоні виконань не знайдено. Зверніть увагу на паузи й обмеження вище.</p> :
          <ol className={styles.occurrences}>{data.occurrences.map((occurrence) => <li key={occurrence.occurrenceKey}>
            <time dateTime={occurrence.startDate}>{formatRoutineDate(occurrence.startDate)}</time>
            {occurrence.endDate !== occurrence.startDate && <> — <time dateTime={occurrence.endDate}>{formatRoutineDate(occurrence.endDate)}</time></>}
            {" · "}{occurrence.localTime ?? "Без заданого часу"} · {occurrence.timezone}
            {occurrence.diagnostics.map((value, index) => <p key={index} className={styles.hint}>{formatPreviewDiagnostic(value)}</p>)}
          </li>)}</ol>}
      </>}
    </div>
  </section>;
}
