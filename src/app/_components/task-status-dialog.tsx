"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getCancellationNoteError } from "@/lib/task-field-input";
import { getPostponeTaskFields, parsePostponeTaskFields, type PostponeTaskErrors, type PostponeTaskFields } from "@/lib/task-status-input";
import type { Task, TaskStatusChange } from "@/lib/task-types";
import styles from "../page.module.css";

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
  const [initial] = useState(() => getPostponeTaskFields(task));
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
      const result = parsePostponeTaskFields(fields, task, initial);
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
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)')];
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
            <label className={styles.field} htmlFor={`${id}-plannedAt`}>
              Запланований час виконання (необов’язково)
              <input ref={plannedRef} id={`${id}-plannedAt`} name="plannedAt" type="datetime-local" step="0.001" value={fields.plannedAt} disabled={locked} aria-invalid={Boolean(errors.plannedAt)} aria-describedby={`${id}-planned-hint${errors.plannedAt ? ` ${id}-plannedAt-error` : ""}`} onChange={(event) => changeDate("plannedAt", event.target.value)} />
              <span id={`${id}-planned-hint`} className={styles.fieldHint}>Незмінений запланований час буде збережено. Очистіть поле, щоб прибрати планування.</span>
              {errors.plannedAt && <span id={`${id}-plannedAt-error`} className={styles.fieldError}>{errors.plannedAt}</span>}
            </label>
            <label className={styles.field} htmlFor={`${id}-dueAt`}>
              Дедлайн: дата й час (необов’язково)
              <input id={`${id}-dueAt`} name="dueAt" type="datetime-local" step="0.001" value={fields.dueAt} disabled={locked} aria-invalid={Boolean(errors.dueAt)} aria-describedby={`${id}-due-hint${errors.dueAt ? ` ${id}-dueAt-error` : ""}`} onChange={(event) => changeDate("dueAt", event.target.value)} />
              <span id={`${id}-due-hint`} className={styles.fieldHint}>Незмінений дедлайн буде збережено. Порожнє поле прибирає дедлайн.</span>
              {errors.dueAt && <span id={`${id}-dueAt-error`} className={styles.fieldError}>{errors.dueAt}</span>}
            </label>
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
