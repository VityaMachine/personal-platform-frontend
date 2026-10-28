"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getCancellationNoteError } from "@/modules/tasks/model/task-field-input";
import { getPostponeTaskFields, parsePostponeTaskFields, type PostponeTaskErrors, type PostponeTaskFields } from "@/modules/tasks/model/task-status-input";
import type { Task, TaskStatusChange } from "@/modules/tasks/model/task-types";
import { useFormDates } from "../hooks/use-form-dates";
import { ZonedDateTimeField } from "../../../shared/ui/zoned-date-time-field";
import styles from "../../../app/page.module.css";

type Props = {
  task: Task;
  status: "CANCELED" | "POSTPONED";
  opener: HTMLSelectElement;
  disabled: boolean;
  onConfirm: (change: TaskStatusChange) => Promise<boolean>;
  onClose: () => void;
};

export function TaskStatusDialog({ task, status, opener, disabled, onConfirm, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const plannedRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const dates = useFormDates();
  const [initial] = useState(() => getPostponeTaskFields(task, dates.timeZone));
  const [fields, setFields] = useState<PostponeTaskFields>(initial);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [errors, setErrors] = useState<PostponeTaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canceling = status === "CANCELED";
  const locked = disabled || submitting;

  useEffect(() => {
    const dialog = dialogRef.current;
    const blockPendingCancel = (event: Event) => { if (inFlight.current) event.preventDefault(); };
    dialog?.addEventListener("cancel", blockPendingCancel);
    dialog?.showModal();
    (noteRef.current ?? plannedRef.current)?.focus();
    return () => {
      dialog?.removeEventListener("cancel", blockPendingCancel);
      dialog?.close();
    };
  }, []);

  function close() {
    if (inFlight.current) return;
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => { if (opener.isConnected) opener.focus(); });
  }

  function changeDate(field: keyof PostponeTaskFields, value: string) {
    if (locked || inFlight.current) return;
    dates.clear(field);
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current) return;
    setError(null);
    let change: TaskStatusChange;
    if (canceling) {
      const validation = getCancellationNoteError(note);
      setNoteError(validation ?? null);
      if (validation) {
        noteRef.current?.focus();
        return;
      }
      change = { status: "CANCELED", cancellationNote: note.trim() };
    } else {
      const result = parsePostponeTaskFields(fields, task, initial, dates.options);
      setErrors(result.errors ?? {});
      if (result.errors) {
        const form = event.currentTarget;
        requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
      change = result.input;
    }
    inFlight.current = true;
    // The inputs become disabled; keep a focusable control inside the modal active.
    saveRef.current?.focus();
    setSubmitting(true);
    let saved = false;
    try {
      saved = await onConfirm(change);
      if (!saved) setError("Не вдалося змінити статус задачі. Спробуйте ще раз.");
    } catch {
      setError("Не вдалося змінити статус задачі. Спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    if (saved) close();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.discardDialog}
      aria-modal="true"
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-task`}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (inFlight.current) event.preventDefault();
        }
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)')];
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }}
    >
      <form noValidate className={styles.editSubtaskForm} onSubmit={submit} aria-busy={submitting}>
        <h2 id={`${id}-heading`} className={styles.sectionTitle}>{canceling ? "Скасувати задачу?" : "Перенести задачу"}</h2>
        <p id={`${id}-task`} className={styles.discardDescription}>{task.title}</p>
        {canceling ? (
          <label className={styles.field} htmlFor={`${id}-note`}>
            Причина скасування (обов’язково)
            <textarea
              ref={noteRef}
              id={`${id}-note`}
              name="cancellationNote"
              value={note}
              rows={3}
              required
              disabled={locked}
              aria-invalid={Boolean(noteError)}
              aria-describedby={noteError ? `${id}-note-error` : undefined}
              onChange={(event) => { if (!locked && !inFlight.current) { setNote(event.target.value); setNoteError(null); setError(null); } }}
            />
            {noteError && <span id={`${id}-note-error`} className={styles.fieldError}>{noteError}</span>}
          </label>
        ) : (
          <>
            <ZonedDateTimeField
              id={`${id}-plannedAt`} name="plannedAt" label="Планування: дата й час (необов’язково)"
              value={fields.plannedAt} timeZone={dates.timeZone} hint={dates.hint}
              choice={dates.choices.plannedAt} original={fields.plannedAt === initial.plannedAt ? task.plannedAt : null}
              disabled={locked} inputRef={plannedRef}
              error={errors.plannedAt}
              onChange={(value) => changeDate("plannedAt", value)}
              onChoice={(iso) => dates.choose("plannedAt", iso)}
            />
            <ZonedDateTimeField
              id={`${id}-dueAt`} name="dueAt" label="Дедлайн: дата й час (необов’язково)"
              value={fields.dueAt} timeZone={dates.timeZone} hint={dates.hint}
              choice={dates.choices.dueAt} original={fields.dueAt === initial.dueAt ? task.dueAt : null}
              disabled={locked}
              error={errors.dueAt}
              onChange={(value) => changeDate("dueAt", value)}
              onChoice={(iso) => dates.choose("dueAt", iso)}
            />
          </>
        )}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {submitting && <p role="status">Збереження статусу…</p>}
        <div className={styles.discardActions}>
          <button type="button" className={styles.secondaryButton} aria-disabled={submitting} onClick={close}>Назад</button>
          <button ref={saveRef} type="submit" className={canceling ? styles.dangerButton : styles.primaryButton} aria-disabled={locked}>{canceling ? "Скасувати задачу" : "Перенести"}</button>
        </div>
      </form>
    </dialog>
  );
}
