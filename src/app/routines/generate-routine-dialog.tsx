"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Routine, GenerateRoutineInput, RoutineGenerationResult } from "@/lib/routine-types";
import { generateRoutine } from "@/lib/routines";
import { defaultRoutinePreviewRange, routinePreviewRangeError, formatRoutineDate } from "@/lib/routine-format";
import { routineGenerationFailure } from "@/lib/routine-generation-error";
import { invalidateTaskList } from "@/lib/task-list-invalidation";
import type { TraversalAttempt } from "@/lib/history-traversal-guard";
import { useHistoryTraversalGuard } from "../_hooks/use-history-traversal-guard";
import { DiscardChangesDialog } from "../_components/discard-changes-dialog";
import shared from "../page.module.css";
import styles from "./routines.module.css";

export function GenerateRoutineDialog({ routine, opener, onClose, onCurrentTasks, onSubmittingChange, navigationDisabled = false }: {
  routine: Routine; opener: HTMLButtonElement; onClose: () => void;
  onCurrentTasks: () => void; onSubmittingChange: (pending: boolean) => void; navigationDisabled?: boolean;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const action = useRef<(() => void) | null>(null);
  const traversal = useRef<TraversalAttempt | null>(null);
  const [baseline, setBaseline] = useState<GenerateRoutineInput>(() => defaultRoutinePreviewRange(routine.timezone));
  const [range, setRange] = useState<GenerateRoutineInput>(baseline);
  const [result, setResult] = useState<RoutineGenerationResult | null>(null);
  const [error, setError] = useState<{ message: string; uncertain: boolean; range: GenerateRoutineInput } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discardFocus, setDiscardFocus] = useState<HTMLElement | null>(null);
  const dirty = range.from !== baseline.from || range.to !== baseline.to;

  useHistoryTraversalGuard(dirty || pending, (attempt) => {
    if (inFlight.current || confirming || action.current) { attempt.stay(); return true; }
    traversal.current = attempt; action.current = () => { onClose(); attempt.leave(); };
    setDiscardFocus(attempt.returnFocus); setConfirming(true); return true;
  });
  useEffect(() => {
    const dialog = dialogRef.current, overflow = document.body.style.overflow;
    dialog?.showModal(); fromRef.current?.focus(); document.body.style.overflow = "hidden";
    return () => {
      request.current?.abort(); dialog?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => { if (opener.isConnected && !document.querySelector("dialog[open]")) opener.focus(); });
    };
  }, [opener]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, pending]);

  function requestClose(next = onClose) {
    if (inFlight.current || confirming) return;
    if (!dirty) { next(); return; }
    action.current = next;
    setDiscardFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null); setConfirming(true);
  }
  function change(key: keyof GenerateRoutineInput, value: string) {
    if (inFlight.current) return;
    setRange((previous) => ({ ...previous, [key]: value }));
    setResult(null); setError((previous) => previous?.uncertain ? previous : null); setFieldError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || confirming || routine.pausedAt !== null) return;
    const validation = routinePreviewRangeError(range); setFieldError(validation);
    if (validation) { requestAnimationFrame(() => fromRef.current?.focus()); return; }
    const requested = { from: range.from, to: range.to };
    const controller = new AbortController(); request.current = controller;
    inFlight.current = true; setPending(true); onSubmittingChange(true); setResult(null); setError(null);
    try {
      const data = await generateRoutine(routine.id, requested, controller.signal);
      if (controller.signal.aborted) return;
      setResult(data); setBaseline(requested); invalidateTaskList();
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (failure) {
      if (!controller.signal.aborted) {
        const outcome = routineGenerationFailure(failure);
        setError({ ...outcome, range: requested });
        if (outcome.uncertain) invalidateTaskList();
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      if (!controller.signal.aborted) { inFlight.current = false; setPending(false); onSubmittingChange(false); }
    }
  }
  return <dialog ref={dialogRef} className={`${shared.modal} ${styles.generateModal}`} aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-warning`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); requestClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab" || confirming || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length > 0 && element.closest("dialog") === event.currentTarget);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={`${shared.modalLayout} ${styles.createLayout}`}>
      <header className={shared.modalHeader}>
        <h2 id={`${id}-heading`} className={`${shared.sectionTitle} ${styles.modalTitle}`}>Створити задачі</h2>
        <button type="button" className={shared.closeButton} disabled={pending} onClick={() => requestClose()} aria-label="Закрити створення задач">✕</button>
      </header>
      <div className={`${shared.modalBody} ${styles.body}`} tabIndex={0} role="region" aria-label="Підтвердження створення задач і результат">
        <h3 className={styles.text}>{routine.title}</h3>
        <p>Часовий пояс: <strong>{routine.timezone}</strong></p>
        <p id={`${id}-warning`}>Після підтвердження будуть створені реальні задачі з цього шаблону.</p>
        <ul className={styles.messages}>
          <li>Вікно виконання, яке перетинає діапазон, створюється цілком.</li>
          <li>Повторний запуск не дублює вже створені виконання.</li>
          <li>Максимум 100 нових задач за запит. Якщо ліміт перевищено, звузьте діапазон.</li>
        </ul>
        {routine.schedule.recurrence.type === "AFTER_COMPLETION" && <p className={styles.hint}>Один запуск створює максимум одне нове виконання. Наступне залежить від фактичного завершення попередньої задачі. Дати й наступника визначає сервер.</p>}
        {routine.pausedAt && <p className={shared.fieldError}>Повторення на паузі. Перед запуском потрібно його відновити.</p>}
        <form id={`${id}-form`} onSubmit={submit} noValidate className={styles.range} aria-busy={pending}>
          <label className={shared.field} htmlFor={`${id}-from`}>З дати
            <input ref={fromRef} id={`${id}-from`} type="date" min="0001-01-01" max="9999-12-31" required disabled={pending} value={range.from}
              aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-range-error` : `${id}-range-hint`} onChange={(event) => change("from", event.target.value)} />
          </label>
          <label className={shared.field} htmlFor={`${id}-to`}>До дати
            <input id={`${id}-to`} type="date" min="0001-01-01" max="9999-12-31" required disabled={pending} value={range.to}
              aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-range-error` : `${id}-range-hint`} onChange={(event) => change("to", event.target.value)} />
          </label>
        </form>
        <p id={`${id}-range-hint`} className={styles.hint}>Локальні календарні дати включно, не більше 366 днів.</p>
        {fieldError && <p id={`${id}-range-error`} role="alert" className={shared.fieldError}>{fieldError}</p>}
        {pending && <p role="status">Створення задач…</p>}
        {error && <div ref={errorRef} role="alert" tabIndex={-1} className={styles.generationResult}>
          <p className={shared.fieldError}>{error.message}</p>
          <p className={styles.hint}>Запитаний діапазон: {formatRoutineDate(error.range.from)} — {formatRoutineDate(error.range.to)}</p>
          {error.uncertain && (error.range.from !== range.from || error.range.to !== range.to) && <>
            <p className={styles.hint}>Попередній запит має невідомий результат. Введений вище діапазон уже змінено.</p>
            <button type="button" className={shared.secondaryButton} disabled={pending} onClick={() => {
              if (!inFlight.current) { setRange({ ...error.range }); setFieldError(null); }
            }}>Відновити діапазон запиту</button>
          </>}
        </div>}
        {result && <div ref={resultRef} role="status" tabIndex={-1} className={styles.generationResult}>
          <p>Створено задач: <strong>{result.createdCount}</strong></p>
          <p>Уже існувало: <strong>{result.existingCount}</strong></p>
          <p className={styles.hint}>Діапазон: {formatRoutineDate(result.from)} — {formatRoutineDate(result.to)}</p>
          {result.createdCount === 0 && result.existingCount === 0 && <p>У цьому діапазоні задач не створено й наявних виконань не знайдено.</p>}
        </div>}
        {(result || error?.uncertain) && <button type="button" className={shared.secondaryButton} disabled={pending || navigationDisabled} onClick={() => {
          if (!navigationDisabled) requestClose(onCurrentTasks);
        }}>Перейти до поточних задач</button>}
      </div>
      <footer className={shared.modalFooter}>
        <button type="button" className={shared.secondaryButton} disabled={pending} onClick={() => requestClose()}>{result ? "Закрити" : "Скасувати"}</button>
        <button type="submit" form={`${id}-form`} className={shared.primaryButton} disabled={pending || confirming || routine.pausedAt !== null}>
          {pending ? "Створення…" : result ? "Створити задачі ще раз" : error ? "Повторити запуск" : "Створити задачі"}
        </button>
      </footer>
    </div>
    {confirming && <DiscardChangesDialog returnFocus={discardFocus} onContinue={() => {
      traversal.current?.stay(); traversal.current = null; action.current = null; setConfirming(false);
    }} onDiscard={() => {
      if (inFlight.current) return;
      const next = action.current ?? onClose; traversal.current = null; action.current = null; next();
    }} />}
  </dialog>;
}
