"use client";

import uiStyles from "../../../../shared/ui/controls.module.css";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Routine } from "@/modules/tasks/routines/model/routine-types";
import { createRoutine, updateRoutine, routineError } from "@/modules/tasks/routines/api/routines";
import { routineToFields, routineSubtasksToFields, parseUpdateRoutineFields } from "@/modules/tasks/routines/model/edit-routine-input";
import { ApiError } from "@/shared/api/api";
import { initialRoutineFields, parseCreateRoutineFields, routineApiFieldErrors, type CreateRoutineFields, type RoutineFormErrors } from "@/modules/tasks/routines/model/create-routine-input";
import { MAX_DURATION_MINUTES, getSubtaskDuration, type SubtaskFields, type SubtaskErrors } from "@/modules/tasks/model/create-task-input";
import { TASK_PRIORITIES } from "@/modules/tasks/model/task-types";
import { TASK_PRIORITY_LABELS } from "@/modules/tasks/model/task-labels";
import type { TraversalAttempt } from "@/shared/navigation/history-traversal-guard";
import { useHistoryTraversalGuard } from "../../../../shared/navigation/use-history-traversal-guard";
import { SubtasksEditor } from "../../ui/subtasks-editor";
import { AreaSelect } from "../../../../entities/areas/ui";
import { DiscardChangesDialog } from "../../../../shared/ui/discard-changes-dialog";
import { RoutineAutomationEditor } from "./routine-automation-editor";
import { RoutineFormField, RoutineScheduleEditor, type RoutineFieldChange } from "./routine-schedule-editor";
import styles from "./routines.module.css";

export function RoutineFormModal({ opener, timezone, initialRoutine: loadedRoutine, onClose, onSaved, onSubmittingChange }: {
  opener: HTMLButtonElement; timezone: string; onClose: () => void;
  initialRoutine?: Routine; onSaved: (routine: Routine) => void; onSubmittingChange: (pending: boolean) => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const traversal = useRef<TraversalAttempt | null>(null);
  // Keep the fetched snapshot fixed throughout this draft, including background updates.
  const [initialRoutine] = useState(loadedRoutine);
  const [baseline] = useState(() => initialRoutine ? routineToFields(initialRoutine) : initialRoutineFields(timezone));
  const [initialRows] = useState(() => initialRoutine ? routineSubtasksToFields(initialRoutine) : []);
  const [fields, setFields] = useState<CreateRoutineFields>(baseline);
  const [subtasks, setSubtasks] = useState<SubtaskFields[]>(initialRows);
  const [errors, setErrors] = useState<RoutineFormErrors>({});
  const [subtaskErrors, setSubtaskErrors] = useState<SubtaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discardFocus, setDiscardFocus] = useState<HTMLElement | null>(null);
  const dirty = JSON.stringify(fields) !== JSON.stringify(baseline) || JSON.stringify(subtasks) !== JSON.stringify(initialRows);
  const hasSubtasks = subtasks.length > 0;
  const total = getSubtaskDuration(subtasks);

  useHistoryTraversalGuard(dirty || submitting, (attempt) => {
    if (inFlight.current || confirming || traversal.current) { attempt.stay(); return true; }
    traversal.current = attempt; setDiscardFocus(attempt.returnFocus); setConfirming(true); return true;
  });
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); dialog?.querySelector<HTMLInputElement>("#routine-title")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      request.current?.abort(); dialog?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => { if (opener.isConnected && !document.querySelector("dialog[open]")) opener.focus(); });
    };
  }, [opener]);
  useEffect(() => {
    if (!dirty && !submitting) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, submitting]);

  function requestClose() {
    if (inFlight.current || confirming) return;
    if (!dirty) { onClose(); return; }
    setDiscardFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null); setConfirming(true);
  }
  const change: RoutineFieldChange = (key, value) => {
    if (inFlight.current) return;
    setFields((previous) => ({ ...previous, [key]: value }));
    // Hidden branches keep their drafts; payload validation only inspects the active one.
    setErrors({}); setError(null);
  };
  function changeSubtasks(rows: SubtaskFields[]) {
    if (inFlight.current) return;
    setSubtasks(rows); setSubtaskErrors({});
    setErrors((previous) => ({ ...previous, estimatedDurationMinutes: undefined })); setError(null);
  }
  function focusError() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]')?.focus());
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || confirming) return;
    const parsed = parseCreateRoutineFields(fields, subtasks);
    setErrors(parsed.errors); setSubtaskErrors(parsed.subtaskErrors); setError(null);
    if (!parsed.input) { focusError(); return; }
    const patch = initialRoutine ? parseUpdateRoutineFields(initialRoutine, fields, subtasks).input : undefined;
    if (initialRoutine && patch === null) { onClose(); return; }
    if (initialRoutine && patch === undefined) { focusError(); return; }
    const controller = new AbortController(); request.current = controller;
    inFlight.current = true; setSubmitting(true); onSubmittingChange(true);
    let created: Routine;
    try { created = initialRoutine ? await updateRoutine(initialRoutine.id, patch!, controller.signal) : await createRoutine(parsed.input, controller.signal); }
    catch (failure) {
      if (!controller.signal.aborted) {
        const mapped = routineApiFieldErrors(failure instanceof ApiError ? failure.details : undefined, fields, subtasks);
        if (failure instanceof ApiError && failure.status === 404 && (failure.apiMessage === "Area not found." || (!initialRoutine && fields.areaId))) {
          mapped.errors.areaId = "Обрана сфера могла бути видалена. Оновіть довідник і перевірте вибір.";
          setError("Шаблон не збережено. Оновіть список сфер або виберіть «Без сфери» перед повторним збереженням.");
        } else { setError(routineError(failure)); }
        setErrors(mapped.errors); setSubtaskErrors(mapped.subtaskErrors); focusError();
      }
      return;
    } finally {
      if (!controller.signal.aborted) { inFlight.current = false; setSubmitting(false); onSubmittingChange(false); }
    }
    if (!controller.signal.aborted) onSaved(created);
  }
  const editorProps = { fields, errors, disabled: submitting, onChange: change };
  return <dialog ref={dialogRef} className={`${uiStyles.modal} ${styles.modal}`} aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-hint`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); requestClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab" || (event.target as HTMLElement).closest("dialog") !== event.currentTarget || confirming) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length > 0 && element.closest("dialog") === event.currentTarget);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={`${uiStyles.modalLayout} ${styles.createLayout}`}>
      <header className={uiStyles.modalHeader}>
        <h2 id={`${id}-heading`} className={`${uiStyles.sectionTitle} ${styles.modalTitle}`}>{initialRoutine ? "Редагувати повторення" : "Нове повторення"}</h2>
        <button type="button" className={uiStyles.closeButton} disabled={submitting} onClick={requestClose} aria-label={initialRoutine ? "Закрити редагування повторення" : "Закрити створення повторення"}>✕</button>
      </header>
      <div className={uiStyles.modalBody} tabIndex={0} role="region" aria-label={initialRoutine ? "Форма редагування шаблону" : "Форма створення шаблону"}>
        <p id={`${id}-hint`} className={styles.hint}>{initialRoutine ? "Зміна шаблону не переписує вже створені задачі." : "Це шаблон повторення. Збереження не створює задачі автоматично"}</p>
        <form ref={formRef} id={`${id}-form`} onSubmit={submit} noValidate aria-busy={submitting}>
          <div className={styles.createColumns}>
            <section className={styles.mainFields} aria-label="Основні поля та шаблони підзадач">
              <RoutineFormField {...editorProps} name="title" label="Назва (обов’язково, до 160 символів)" />
              <label className={uiStyles.field} htmlFor="routine-description">Опис (необов’язково)
                <textarea id="routine-description" rows={3} value={fields.description} disabled={submitting} onChange={(event) => change("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "routine-description-error" : undefined} />
                {errors.description && <span id="routine-description-error" className={uiStyles.fieldError}>{errors.description}</span>}
              </label>
              <RoutineFormField {...editorProps} name="priority" label="Пріоритет" options={TASK_PRIORITIES.map((value) => [value, TASK_PRIORITY_LABELS[value]] as const)} />
              <AreaSelect id="routine-areaId" value={fields.areaId} disabled={submitting} currentArea={initialRoutine?.area} error={errors.areaId} onChange={(value) => change("areaId", value)} />
              <label className={uiStyles.field} htmlFor="routine-duration">Тривалість, хв
                <input id="routine-duration" type="number" min={1} max={MAX_DURATION_MINUTES} step={1} required disabled={submitting} readOnly={hasSubtasks}
                  value={hasSubtasks ? total ?? "" : fields.estimatedDurationMinutes} onChange={(event) => { if (!hasSubtasks) change("estimatedDurationMinutes", event.target.value); }}
                  aria-invalid={Boolean(errors.estimatedDurationMinutes)} aria-describedby={`routine-duration-hint${errors.estimatedDurationMinutes ? " routine-duration-error" : ""}`} />
                <span id="routine-duration-hint" className={uiStyles.fieldHint}>{hasSubtasks ? "Сума тривалостей шаблонів підзадач (лише для читання)." : "Ручна оцінка тривалості шаблону."}</span>
                {errors.estimatedDurationMinutes && <span id="routine-duration-error" className={uiStyles.fieldError}>{errors.estimatedDurationMinutes}</span>}
              </label>
              <p className={styles.hint}>Нижче — шаблони підзадач, без статусів виконання. Вони не є створеними задачами.</p>
              <SubtasksEditor subtasks={subtasks} errors={subtaskErrors} disabled={submitting} onChange={changeSubtasks} />
            </section>
            {initialRoutine ? <p className={styles.hint}>Календарні налаштування змінюються окремою дією «Змінити розклад» у деталях Routine.</p> : <RoutineScheduleEditor {...editorProps} />}
            <RoutineAutomationEditor {...editorProps} />
          </div>
          {error && <div role="alert" className={`${uiStyles.error} ${styles.createError}`}><p>{error}</p></div>}
        </form>
      </div>
      <footer className={uiStyles.modalFooter}>
        <button type="button" className={uiStyles.secondaryButton} disabled={submitting} onClick={requestClose}>Скасувати</button>
        <button type="submit" form={`${id}-form`} className={uiStyles.primaryButton} disabled={submitting || confirming}>{submitting ? (initialRoutine ? "Збереження…" : "Створення…") : initialRoutine ? "Зберегти зміни" : "Створити шаблон"}</button>
      </footer>
    </div>
    {confirming && <DiscardChangesDialog returnFocus={discardFocus} onContinue={() => {
      traversal.current?.stay(); traversal.current = null; setConfirming(false);
    }} onDiscard={() => {
      if (inFlight.current) return;
      const next = traversal.current; traversal.current = null; onClose(); next?.leave();
    }} />}
  </dialog>;
}
