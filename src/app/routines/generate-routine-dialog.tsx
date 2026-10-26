"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Routine, RoutineGenerationResult } from "@/lib/routine-types";
import { formatRoutineDate } from "@/lib/routine-format";
import { useRoutineGeneration } from "../_hooks/use-routine-generation";
import { GenerationPlanningRows } from "./generation-planning-rows";
import { RoutineConflicts } from "./routine-conflicts";
import type { TraversalAttempt } from "@/lib/history-traversal-guard";
import { useHistoryTraversalGuard } from "../_hooks/use-history-traversal-guard";
import { DiscardChangesDialog } from "../_components/discard-changes-dialog";
import shared from "../page.module.css";
import styles from "./routines.module.css";

export function GenerateRoutineDialog({ routine, opener, onClose, onGenerated, onCurrentTasks, onSubmittingChange, navigationDisabled = false }: {
  routine: Routine; opener: HTMLButtonElement; onClose: () => void;
  onGenerated: (result: RoutineGenerationResult) => void;
  onCurrentTasks: () => void; onSubmittingChange: (pending: boolean) => void; navigationDisabled?: boolean;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const model = useRoutineGeneration(routine, onSubmittingChange);
  const { range, result, error, rangeError: fieldError, pending, dirty } = model;
  const action = useRef<(() => void) | null>(null);
  const traversal = useRef<TraversalAttempt | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [discardFocus, setDiscardFocus] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (result) onGenerated(result);
  }, [result, onGenerated]);

  useHistoryTraversalGuard(dirty || pending, (attempt) => {
    if (model.isPosting() || confirming || action.current) { attempt.stay(); return true; }
    traversal.current = attempt; action.current = () => { onClose(); attempt.leave(); };
    setDiscardFocus(attempt.returnFocus); setConfirming(true); return true;
  });
  useEffect(() => {
    const dialog = dialogRef.current, overflow = document.body.style.overflow;
    dialog?.showModal(); fromRef.current?.focus(); document.body.style.overflow = "hidden";
    return () => {
      dialog?.close(); document.body.style.overflow = overflow;
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
    if (model.isPosting() || confirming) return;
    if (!dirty) { next(); return; }
    action.current = next;
    setDiscardFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null); setConfirming(true);
  }
  function focusOutcome(outcome: string | null) {
    requestAnimationFrame(() => {
      if (outcome === "error") errorRef.current?.focus();
      else if (outcome === "validation") {
        const invalid = dialogRef.current?.querySelector<HTMLElement>('input[aria-invalid="true"], select[aria-invalid="true"]');
        (invalid ?? fromRef.current)?.focus();
      }
    });
  }
  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (model.isPosting() || confirming) return;
    focusOutcome(await model.generate());
  }
  return <dialog ref={dialogRef} className={`${shared.modal} ${styles.generateModal}`} aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-warning`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); requestClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab" || confirming || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length > 0 && element.closest("dialog") === event.currentTarget);
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
        <p>Часовий пояс: <strong>{model.preview.data?.timezone ?? routine.timezone}</strong></p>
        <p id={`${id}-warning`}>Після підтвердження будуть створені реальні задачі з цього шаблону.</p>
        <ul className={styles.messages}>
          <li>Вікно виконання, яке перетинає діапазон, створюється цілком.</li>
          <li>Повторний запуск не дублює вже створені виконання.</li>
          <li>Максимум 100 нових задач за запит. Якщо ліміт перевищено, звузьте діапазон.</li>
        </ul>
        {routine.schedule.recurrence.type === "AFTER_COMPLETION" && <p className={styles.hint}>Один запуск створює максимум одне нове виконання. Наступне залежить від фактичного завершення або пропуску попередньої задачі. Дати й наступника визначає сервер.</p>}
        {routine.pausedAt && <p className={shared.fieldError}>Повторення на паузі. Перед запуском потрібно його відновити.</p>}
        <form id={`${id}-form`} onSubmit={(event) => { event.preventDefault(); if (!confirming) void model.loadPreview(); }} noValidate className={styles.range} aria-busy={pending}>
          <label className={shared.field} htmlFor={`${id}-from`}>З дати
            <input ref={fromRef} id={`${id}-from`} type="date" min="0001-01-01" max="9999-12-31" required disabled={pending} value={range.from}
              aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-range-error` : `${id}-range-hint`} onChange={(event) => model.changeRange("from", event.target.value)} />
          </label>
          <label className={shared.field} htmlFor={`${id}-to`}>До дати
            <input id={`${id}-to`} type="date" min="0001-01-01" max="9999-12-31" required disabled={pending} value={range.to}
              aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-range-error` : `${id}-range-hint`} onChange={(event) => model.changeRange("to", event.target.value)} />
          </label>
          <button type="submit" className={shared.secondaryButton} disabled={pending || confirming || model.preview.loading || routine.pausedAt !== null}>Показати виконання</button>
          {model.preview.loading && <button type="button" className={shared.secondaryButton} disabled={pending} onClick={model.cancelPreview}>Скасувати завантаження</button>}
        </form>
        <p id={`${id}-range-hint`} className={styles.hint}>Локальні календарні дати включно, не більше 366 днів.</p>
        {fieldError && <p id={`${id}-range-error`} role="alert" className={shared.fieldError}>{fieldError}</p>}
        <section aria-busy={model.preview.loading} aria-label="Фактичні кандидати генерації">
          {model.preview.loading && <p role="status">Завантаження виконань…</p>}
          {model.preview.error && <div role="alert" className={shared.error}><p>{model.preview.error}</p>
            <button type="button" className={shared.secondaryButton} disabled={pending || confirming} onClick={() => void model.loadPreview()}>Повторити завантаження виконань</button>
          </div>}
          {model.notice && <p role="status" className={styles.hint}>{model.notice}</p>}
          {model.preview.data && <>
            <RoutineConflicts conflicts={model.preview.data.conflicts} />
            <p className={styles.hint}>Перелік за {formatRoutineDate(model.preview.data.from)} — {formatRoutineDate(model.preview.data.to)}.
              {!model.current && " Перелік неактуальний. Оновіть виконання перед новою генерацією; введення збережено."}
            </p>
            <p className={styles.hint}>Час необов’язковий. Порожні поля залишать задачі без особистого планування.</p>
            <GenerationPlanningRows id={id} preview={model.preview.data} drafts={model.drafts} errors={model.planningErrors}
              disabled={pending || !model.current || confirming} onChange={model.changePlanning} />
          </>}
          {!model.preview.data && !model.preview.loading && <p className={styles.hint}>Натисніть «Показати виконання», щоб отримати фактичних кандидатів перед створенням задач.</p>}
        </section>
        {pending && <p role="status">Створення задач…</p>}
        {error && <div ref={errorRef} role="alert" tabIndex={-1} className={styles.generationResult}>
          <p className={shared.fieldError}>{error.message}</p>
          <p className={styles.hint}>Запитаний діапазон: {formatRoutineDate(error.payload.from)} — {formatRoutineDate(error.payload.to)}</p>
          {model.uncertainPayload && <>
            <p className={styles.hint}>Збережено точний надісланий запит із {model.uncertainPayload.planning?.length ?? 0} записами планування. Зміни поточної чернетки не впливають на його повтор. Повтор не переплановує вже створені задачі.</p>
            <button type="button" className={shared.secondaryButton} disabled={pending || model.preview.loading || confirming}
              onClick={async () => focusOutcome(await model.retryExact())}>Повторити точний запит</button>
            <p className={styles.hint}>Новий запит із поточного планування доступний після завершення точного повтору й оновлення виконань.</p>
          </>}
        </div>}
        {error?.uncertain && <button type="button" className={shared.secondaryButton} disabled={pending || navigationDisabled} onClick={() => {
          if (!navigationDisabled) requestClose(onCurrentTasks);
        }}>Перейти до поточних задач</button>}
      </div>
      <footer className={shared.modalFooter}>
        <button type="button" className={shared.secondaryButton} disabled={pending} onClick={() => requestClose()}>Скасувати</button>
        <button type="button" onClick={submit} className={shared.primaryButton} disabled={pending || confirming || !model.canGenerate}>
          {pending ? "Створення…" : "Створити задачі"}
        </button>
      </footer>
    </div>
    {confirming && <DiscardChangesDialog returnFocus={discardFocus} onContinue={() => {
      traversal.current?.stay(); traversal.current = null; action.current = null; setConfirming(false);
    }} onDiscard={() => {
      if (model.isPosting()) return;
      const next = action.current ?? onClose; traversal.current = null; action.current = null; next();
    }} />}
  </dialog>;
}
