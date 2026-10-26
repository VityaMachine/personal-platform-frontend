"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getEditTaskFields, parseEditTaskFields, type EditTaskErrors, type EditTaskFields } from "@/lib/edit-task-input";
import { MAX_DURATION_MINUTES } from "@/lib/task-field-input";
import { TASK_PRIORITIES, type Task, type TaskDetailsChange } from "@/lib/task-types";
import { TASK_PRIORITY_LABELS } from "@/lib/task-labels";
import { sameInstant } from "@/lib/zoned-date";
import { DiscardChangesDialog } from "./discard-changes-dialog";
import { AreaSelect } from "./area-select";
import { useFormDates } from "../_hooks/use-form-dates";
import { ZonedDateTimeField } from "./zoned-date-time-field";
import { TaskPlanningFields } from "./task-planning-fields";
import styles from "../page.module.css";

type Props = {
  task: Task;
  opener: HTMLButtonElement;
  disabled: boolean;
  onSave: (input: TaskDetailsChange) => Promise<boolean>;
  onClose: () => void;
};

export function EditTaskModal({ task, opener, disabled, onSave, onClose }: Props) {
  const id = useId();
  const formId = `${id}-form`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  // Capture one baseline per modal session; parent rerenders never replace a draft.
  const dates = useFormDates();
  const [initial] = useState(() => getEditTaskFields(task, dates.timeZone));
  const [fields, setFields] = useState<EditTaskFields>(initial);
  const [errors, setErrors] = useState<EditTaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const hasSubtasks = task.subtasks.some((subtask) => subtask.deletedAt === null);
  const locked = disabled || submitting;
  const dirty = (Object.keys(fields) as (keyof EditTaskFields)[]).some((field) => fields[field] !== initial[field])
    || (["dueAt", "plannedAt"] as const).some((field) => dates.choices[field] && !sameInstant(dates.choices[field], task[field]));

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    const blockPendingCancel = (event: Event) => {
      if (inFlight.current) event.preventDefault();
    };
    dialog?.addEventListener("cancel", blockPendingCancel);
    dialog?.showModal();
    titleRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.removeEventListener("cancel", blockPendingCancel);
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  function close() {
    if (inFlight.current) return;
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => { if (opener.isConnected) opener.focus(); });
  }

  function requestClose() {
    if (inFlight.current || confirmingDiscard) return;
    if (dirty) setConfirmingDiscard(true);
    else close();
  }

  function change(field: keyof EditTaskFields, value: string) {
    if (locked || inFlight.current || confirmingDiscard || (field === "estimatedDurationMinutes" && hasSubtasks)) return;
    if (field === "dueAt") dates.clear(field);
    if (field === "plannedDate" || field === "plannedTime") dates.clear("plannedAt");
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => field === "plannedDate" || field === "plannedTime"
      ? { ...previous, plannedDate: undefined, plannedTime: undefined }
      : { ...previous, [field]: undefined });
    setError(null);
  }

  function removePlanning() {
    if (locked || inFlight.current || confirmingDiscard) return;
    dates.clear("plannedAt");
    setFields((previous) => ({ ...previous, plannedDate: "", plannedTime: "" }));
    setErrors((previous) => ({ ...previous, plannedDate: undefined, plannedTime: undefined }));
    setError(null);
  }

  function fieldProps(field: keyof EditTaskFields) {
    return {
      id: `${id}-${field}`,
      name: field,
      value: fields[field],
      disabled: locked,
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
    };
  }

  function fieldError(field: keyof EditTaskFields) {
    return errors[field] && <span id={`${id}-${field}-error`} className={styles.fieldError}>{errors[field]}</span>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current || confirmingDiscard) return;
    const result = parseEditTaskFields(fields, task, initial, dates.options);
    setErrors(result.errors ?? {});
    setError(null);
    if (result.errors) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (result.input === null) {
      close();
      return;
    }
    inFlight.current = true;
    // Keep focus inside the modal when its currently focused input is disabled.
    saveRef.current?.focus();
    setSubmitting(true);
    let saved = false;
    try {
      saved = await onSave(result.input);
      if (!saved) setError(fields.areaId ? "Не вдалося зберегти задачу. Обрана сфера могла бути видалена. Оновіть список сфер і перевірте вибір перед повторним збереженням." : "Не вдалося зберегти задачу. Спробуйте ще раз.");
    } catch {
      setError("Не вдалося зберегти задачу. Спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    if (saved) close();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-modal="true"
      aria-labelledby={`${id}-heading`}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (confirmingDiscard) return;
        if (event.key === "Escape") {
          event.stopPropagation();
          if (inFlight.current) event.preventDefault();
        }
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')];
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }}
    >
      <div className={styles.modalLayout}>
        <header className={styles.modalHeader}>
          <h2 id={`${id}-heading`} className={styles.sectionTitle}>Редагувати задачу</h2>
          <button type="button" className={styles.closeButton} aria-disabled={submitting} onClick={requestClose} aria-label="Закрити вікно редагування задачі">✕</button>
        </header>
        <div className={styles.modalBody}>
          <form id={formId} className={styles.form} noValidate onSubmit={submit} aria-busy={submitting}>
            <div className={styles.formColumn}>
              <label className={styles.field} htmlFor={`${id}-title`}>
                Назва <span className={styles.required}>(обов’язково, до 160 символів)</span>
                <input {...fieldProps("title")} ref={titleRef} required onChange={(event) => change("title", event.target.value)} />
                {fieldError("title")}
              </label>
              <label className={styles.field} htmlFor={`${id}-description`}>
                Опис <span className={styles.required}>(необов’язково)</span>
                <textarea {...fieldProps("description")} rows={5} onChange={(event) => change("description", event.target.value)} />
                {fieldError("description")}
              </label>
            </div>
            <div className={styles.formColumn}>
              <ZonedDateTimeField
                id={`${id}-dueAt`} name="dueAt" label="Дедлайн: дата й час (необов’язково)"
                value={fields.dueAt} timeZone={dates.timeZone} hint={dates.hint}
                choice={dates.choices.dueAt} original={fields.dueAt === initial.dueAt ? task.dueAt : null}
                disabled={locked}
                error={errors.dueAt}
                onChange={(value) => change("dueAt", value)}
                onChoice={(iso) => dates.choose("dueAt", iso)}
              />
              <AreaSelect id={`${id}-areaId`} value={fields.areaId} currentArea={task.area} onChange={(value) => change("areaId", value)} disabled={locked} error={errors.areaId} />
              <TaskPlanningFields
                id={`${id}-plannedAt`} date={fields.plannedDate} time={fields.plannedTime} timeZone={dates.timeZone} hint={dates.hint}
                occurrenceHint={task.plannedAt === null && Boolean(task.routineOccurrence) && fields.plannedDate === task.routineOccurrence?.startDate && !fields.plannedTime}
                choice={dates.choices.plannedAt} original={fields.plannedDate === initial.plannedDate && fields.plannedTime === initial.plannedTime ? task.plannedAt : null}
                disabled={locked}
                dateError={errors.plannedDate} timeError={errors.plannedTime}
                canRemove={task.plannedAt !== null}
                onDate={(value) => change("plannedDate", value)} onTime={(value) => change("plannedTime", value)}
                onChoice={(iso) => dates.choose("plannedAt", iso)}
                onRemove={removePlanning}
              />
              <label className={styles.field} htmlFor={`${id}-priority`}>
                Пріоритет
                <select {...fieldProps("priority")} onChange={(event) => change("priority", event.target.value)}>
                  {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}
                </select>
                {fieldError("priority")}
              </label>
              <label className={styles.field} htmlFor={`${id}-estimatedDurationMinutes`}>
                Орієнтовна тривалість у хвилинах
                <input
                  {...fieldProps("estimatedDurationMinutes")}
                  type="number" min={1} max={MAX_DURATION_MINUTES} step={1} required readOnly={hasSubtasks}
                  aria-describedby={hasSubtasks ? `${id}-duration-hint` : errors.estimatedDurationMinutes ? `${id}-estimatedDurationMinutes-error` : undefined}
                  onChange={(event) => change("estimatedDurationMinutes", event.target.value)}
                />
                {hasSubtasks && <span id={`${id}-duration-hint`} className={styles.fieldHint}>Сума тривалостей підзадач</span>}
                {fieldError("estimatedDurationMinutes")}
              </label>
            </div>
            {error && <div role="alert" className={`${styles.error} ${styles.formError}`}><p>{error}</p></div>}
            {submitting && <p className={styles.formError} role="status">Збереження задачі…</p>}
          </form>
        </div>
        <footer className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} aria-disabled={submitting} onClick={requestClose}>Скасувати</button>
          <button ref={saveRef} type="submit" form={formId} className={styles.primaryButton} aria-disabled={locked}>Зберегти</button>
        </footer>
      </div>
      {confirmingDiscard && <DiscardChangesDialog onContinue={() => setConfirmingDiscard(false)} onDiscard={close} />}
    </dialog>
  );
}
