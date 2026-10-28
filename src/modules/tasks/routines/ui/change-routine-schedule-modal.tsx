"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Routine, RoutineScheduleVersion } from "@/modules/tasks/routines/model/routine-types";
import { createRoutineScheduleVersion, getRoutine } from "@/modules/tasks/routines/api/routines";
import { routineToFields } from "@/modules/tasks/routines/model/edit-routine-input";
import { routineApiFieldErrors, type RoutineFormErrors } from "@/modules/tasks/routines/model/create-routine-input";
import { ApiError } from "@/shared/api/api";
import { invalidateRoutineSchedule, minimumEffectiveDate, parseScheduleVersionFields, scheduleVersionFailure } from "@/modules/tasks/routines/model/routine-schedule-versions";
import { formatRoutineDate } from "@/modules/tasks/routines/model/routine-format";
import { useHistoryTraversalGuard } from "../../../../shared/navigation/use-history-traversal-guard";
import type { TraversalAttempt } from "@/shared/navigation/history-traversal-guard";
import { DiscardChangesDialog } from "../../../../shared/ui/discard-changes-dialog";
import { RoutineScheduleEditor, type RoutineFieldChange } from "./routine-schedule-editor";
import { RoutineResultModal } from "./routine-result-modal";
import shared from "../../../../app/page.module.css";
import styles from "./routines.module.css";

export function ChangeRoutineScheduleModal({ routine, versions, opener, onClose, reloadVersions, onRoutine }: {
  routine: Routine; versions: RoutineScheduleVersion[]; opener: HTMLButtonElement; onClose: () => void;
  reloadVersions: () => Promise<RoutineScheduleVersion[] | null>; onRoutine: (routine: Routine) => void;
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), form = useRef<HTMLFormElement>(null);
  const [source] = useState(() => versions.at(-1)!);
  const [history, setHistory] = useState(versions);
  const [baseline] = useState(() => routineToFields({ ...routine, ...source, id: routine.id }));
  const [fields, setFields] = useState(baseline);
  const [effectiveDate, setEffectiveDate] = useState(() => minimumEffectiveDate(versions) ?? "");
  const [initialDate] = useState(effectiveDate);
  const [errors, setErrors] = useState<RoutineFormErrors>({});
  const [effectiveError, setEffectiveError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false), lock = useRef(false);
  const [saved, setSaved] = useState<RoutineScheduleVersion | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [discard, setDiscard] = useState(false), [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const traversal = useRef<TraversalAttempt | null>(null);
  const request = useRef<AbortController | null>(null);
  const postSucceeded = useRef(false);
  const outcome = useRef<HTMLDivElement>(null);
  const cancelAction = useRef<() => void>(() => {});
  const dirty = !saved && (JSON.stringify(fields) !== JSON.stringify(baseline) || effectiveDate !== initialDate || uncertain);
  const minimum = minimumEffectiveDate(history);
  useHistoryTraversalGuard(!saved && (dirty || pending), (attempt) => {
    if (lock.current || discard) { attempt.stay(); return true; }
    traversal.current = attempt; setReturnFocus(attempt.returnFocus); setDiscard(true); return true;
  });
  useEffect(() => {
    const node = dialog.current;
    // Native cancel must be stopped at the top dialog even when focus leaves a disabled field.
    const cancel = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); cancelAction.current(); };
    node?.addEventListener("cancel", cancel);
    node?.showModal(); node?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
    return () => { if (!postSucceeded.current) request.current?.abort(); node?.removeEventListener("cancel", cancel); node?.close(); requestAnimationFrame(() => { if (opener.isConnected && !document.querySelector('dialog[data-routine-result="true"]')) opener.focus(); }); };
  }, [opener]);
  useEffect(() => { cancelAction.current = close; });
  useEffect(() => {
    if (saved || (!dirty && !pending)) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, pending, saved]);
  useEffect(() => { if (error || notice) outcome.current?.focus(); }, [error, notice]);
  function close() {
    if (lock.current || discard) return;
    if (!dirty) { onClose(); return; }
    setReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null); setDiscard(true);
  }
  const change: RoutineFieldChange = (key, value) => {
    if (lock.current || saved || uncertain) return;
    setFields((previous) => ({ ...previous, [key]: value })); setErrors({}); setError(null); setConfirmed(false);
  };
  async function refresh() {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(null);
    const controller = new AbortController(); request.current = controller;
    const [versionResult, routineResult] = await Promise.allSettled([reloadVersions(), getRoutine(routine.id, controller.signal)]);
    if (!controller.signal.aborted) {
      const next = versionResult.status === "fulfilled" ? versionResult.value : null;
      if (next) {
        setHistory(next);
        if (uncertain) setNotice(`Перевірено версії. Остання збережена — №${next.at(-1)!.number}, з ${formatRoutineDate(next.at(-1)!.effectiveDate)}. Перегляньте розклади в деталях перед новою зміною.`);
      }
      if (routineResult.status === "fulfilled") onRoutine(routineResult.value);
      if (!next || routineResult.status === "rejected") setError(`${saved ? "Версію успішно створено. " : ""}Не вдалося оновити ${!next ? "версії" : "дані Routine"}. Повторіть лише GET.`);
      lock.current = false; setPending(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || saved || uncertain || discard) return;
    const parsed = parseScheduleVersionFields(fields, effectiveDate, history);
    setErrors(parsed.errors); setEffectiveError(parsed.effectiveError); setError(null);
    if (!parsed.input || !confirmed) {
      if (!confirmed) setError("Підтвердьте створення незмінної версії розкладу.");
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    const controller = new AbortController(); request.current = controller;
    lock.current = true; setPending(true);
    let created: RoutineScheduleVersion;
    try { created = await createRoutineScheduleVersion(routine.id, parsed.input, controller.signal); }
    catch (failure) {
      if (!controller.signal.aborted) {
        const outcome = scheduleVersionFailure(failure); setUncertain(outcome.uncertain); setError(outcome.message);
        if (outcome.uncertain) invalidateRoutineSchedule(routine.id);
        if (failure instanceof ApiError) setErrors(routineApiFieldErrors(failure.details, fields, []).errors);
        lock.current = false; setPending(false);
      }
      return;
    }
    if (controller.signal.aborted) return;
    postSucceeded.current = true; setSaved(created); setNotice(null);
    invalidateRoutineSchedule(routine.id);
    // Commit the POST outcome before independent GETs; GET failure must never enable another POST.
    const [next, fresh] = await Promise.allSettled([reloadVersions(), getRoutine(routine.id, controller.signal)]);
    if (!controller.signal.aborted) {
      if (next.status === "fulfilled" && next.value) setHistory(next.value);
      if (fresh.status === "fulfilled") onRoutine(fresh.value);
      if (next.status === "rejected" || !next.value || fresh.status === "rejected") setError("Версію успішно створено. Не вдалося оновити дані. Повторіть лише GET; повторний POST заблоковано.");
      lock.current = false; setPending(false);
    }
  }
  if (saved) return <RoutineResultModal result={{ type: "schedule", data: saved }} opener={opener} onClose={onClose}
    refreshing={pending} refreshError={error} onRefresh={() => void refresh()} />;
  return <dialog ref={dialog} closedby="none" className={`${shared.modal} ${styles.modal}`} aria-modal="true" aria-labelledby={`${id}-heading`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (event.target === event.currentTarget && !discard) close(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && (event.target as HTMLElement).closest("dialog") === event.currentTarget) {
        event.preventDefault(); event.stopPropagation(); close(); return;
      }
      if (event.key !== "Tab" || discard || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length && node.closest("dialog") === event.currentTarget);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={`${shared.modalLayout} ${styles.createLayout}`}>
      <header className={shared.modalHeader}><h2 id={`${id}-heading`} className={shared.sectionTitle}>Змінити розклад</h2>
        <button className={shared.closeButton} type="button" disabled={pending} onClick={close} aria-label="Закрити зміну розкладу">✕</button></header>
      <div className={`${shared.modalBody} ${styles.body}`} tabIndex={0}>
        <p>Основа чернетки — остання збережена версія №{source.number}, з {formatRoutineDate(source.effectiveDate)}. Вона може ще не діяти.</p>
        <p>Новий розклад діятиме з вибраної дати. Уже створені задачі, включно з майбутніми, залишаться без змін</p>
        <form ref={form} id={`${id}-form`} onSubmit={submit} noValidate>
          <div className={styles.createColumns}>
            <section className={styles.mainFields}>
              <label className={shared.field}>Дата початку дії
                <input type="date" required min={minimum ?? "9999-12-31"} max="9999-12-31" value={effectiveDate} disabled={pending || !!saved || uncertain}
                  aria-invalid={!!effectiveError} aria-describedby={`${id}-date-hint${effectiveError ? ` ${id}-date-error` : ""}`}
                  onChange={(event) => { setEffectiveDate(event.target.value); setEffectiveError(undefined); setConfirmed(false); }} />
                {effectiveError && <span id={`${id}-date-error`} className={shared.fieldError}>{effectiveError}</span>}
              </label>
              <p id={`${id}-date-hint`} className={styles.hint}>Початок локального дня в {history[0].effectiveTimezone} — незмінному часовому поясі першої версії. Зміна timezone розкладу не змінює цю межу. Найраніше: {minimum ? formatRoutineDate(minimum) : "немає допустимої дати"}. Сервер повторно перевіряє дату під час збереження.</p>
              <p className={styles.hint}>Дата початку в календарних полях задає прив’язку повторення, а дата початку дії — межу застосування версії.</p>
              <p className={styles.hint}>COUNT — загальний ліміт виконань Routine через усі версії. Уже створені, включно з майбутніми та SKIPPED, враховуються; ліміт не скидається. Сервер відхилить COUNT нижче вже створеної кількості.</p>
              <p className={styles.hint}>Перехід calendar ↔ AFTER_COMPLETION потребує окремої Routine. Для AFTER_COMPLETION дата початку незмінна.</p>
            </section>
            <RoutineScheduleEditor fields={fields} errors={errors} disabled={pending || !!saved || uncertain} onChange={change} mode={source.schedule.recurrence.type === "AFTER_COMPLETION" ? "completion" : "calendar"} />
          </div>
          {!saved && !uncertain && <label className={styles.confirmSchedule}><input type="checkbox" checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} /> Підтверджую створення нової незмінної версії розкладу</label>}
        </form>
        <div ref={outcome} tabIndex={-1}>
          {notice && <p role="status" className={shared.notice}>{notice}</p>}
          {error && <p role="alert" className={shared.fieldError}>{error}</p>}
        </div>
        {(saved || uncertain || error) && <button type="button" className={shared.secondaryButton} disabled={pending} onClick={() => void refresh()}>{uncertain ? "Перевірити версії (лише GET)" : "Оновити дані (лише GET)"}</button>}
      </div>
      <footer className={shared.modalFooter}><button type="button" className={shared.secondaryButton} disabled={pending} onClick={close}>{saved ? "Закрити" : "Скасувати"}</button>
        {!saved && !uncertain && <button type="submit" form={`${id}-form`} className={shared.primaryButton} disabled={pending || discard || !confirmed || !minimum}>{pending ? "Збереження…" : "Створити версію"}</button>}</footer>
    </div>
    {discard && <DiscardChangesDialog returnFocus={returnFocus} onContinue={() => { traversal.current?.stay(); traversal.current = null; setDiscard(false); }} onDiscard={() => {
      if (lock.current) return; const attempt = traversal.current; traversal.current = null; onClose(); attempt?.leave();
    }} />}
  </dialog>;
}
