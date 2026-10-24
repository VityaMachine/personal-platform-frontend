"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import styles from "../page.module.css";

type Props = {
  subtaskTitle: string;
  opener: HTMLSelectElement;
  disabled: boolean;
  onConfirm: (note: string) => Promise<boolean>;
  onClose: () => void;
};

export function CancelSubtaskDialog({ subtaskTitle, opener, disabled, onConfirm, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Native modal behavior traps focus and makes the background inert.
    dialog?.showModal();
    noteRef.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        if (!opener.isConnected) return;
        if (!opener.disabled) opener.focus();
        // A failed GET keeps the select locked; return to the task's retry action.
        else opener.closest("[data-task-id]")?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
      });
    };
  }, [opener]);

  function requestClose() {
    if (!inFlight.current) onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current) return;
    const trimmed = note.trim();
    setError(null);
    if (!trimmed) {
      setValidationError("Вкажіть причину скасування.");
      noteRef.current?.focus();
      return;
    }
    setValidationError(null);
    inFlight.current = true;
    setSubmitting(true);
    let saved = false;
    try {
      saved = await onConfirm(trimmed);
      if (!saved) setError("Не вдалося скасувати підзадачу. Спробуйте ще раз.");
    } catch {
      setError("Не вдалося скасувати підзадачу. Спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    if (saved) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.discardDialog}
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
    >
      <form noValidate onSubmit={submit} aria-busy={submitting}>
        <h2 id={`${id}-heading`} className={styles.sectionTitle}>Скасувати підзадачу?</h2>
        <p id={`${id}-description`} className={styles.discardDescription}>{subtaskTitle}</p>
        <label className={styles.field} htmlFor={`${id}-note`}>
          Причина скасування (обов’язково)
          <textarea
            ref={noteRef}
            id={`${id}-note`}
            value={note}
            required
            rows={3}
            disabled={submitting}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? `${id}-validation` : undefined}
            onChange={(event) => { setNote(event.target.value); setValidationError(null); }}
          />
          {validationError && <span id={`${id}-validation`} className={styles.fieldError}>{validationError}</span>}
        </label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {submitting && <p role="status">Збереження та оновлення даних…</p>}
        <div className={styles.discardActions}>
          <button type="button" className={styles.secondaryButton} disabled={submitting} onClick={requestClose}>Назад</button>
          <button type="submit" className={styles.dangerButton} disabled={disabled || submitting}>Скасувати підзадачу</button>
        </div>
      </form>
    </dialog>
  );
}
