"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { parseCreateSubtaskFields, type CreateSubtaskErrors, type CreateSubtaskFields } from "@/modules/tasks/model/create-subtask-input";
import { MAX_DURATION_MINUTES } from "@/modules/tasks/model/task-field-input";
import type { InitialSubtaskInput } from "@/modules/tasks/model/task-types";
import { DiscardChangesDialog } from "../../../shared/ui/discard-changes-dialog";
import styles from "../../../app/page.module.css";

type Props = {
  taskTitle: string;
  opener: HTMLButtonElement;
  fallbackFocusRef: RefObject<HTMLHeadingElement | null>;
  disabled: boolean;
  onSave: (input: InitialSubtaskInput) => Promise<boolean>;
  onClose: () => void;
};

export function CreateSubtaskDialog({ taskTitle, opener, fallbackFocusRef, disabled, onSave, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [fields, setFields] = useState<CreateSubtaskFields>({ title: "", estimatedDurationMinutes: "" });
  const [errors, setErrors] = useState<CreateSubtaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const dirty = fields.title !== "" || fields.estimatedDurationMinutes !== "";
  const locked = disabled || submitting;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    titleRef.current?.focus();
    return () => dialog?.close();
  }, []);

  function close() {
    if (inFlight.current) return;
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => {
      // Creating the first child replaces the opener; a failed GET keeps it locked.
      const target = opener.isConnected && !opener.disabled ? opener : fallbackFocusRef.current;
      target?.focus();
    });
  }

  function requestClose() {
    if (inFlight.current || confirmingDiscard) return;
    if (dirty) setConfirmingDiscard(true);
    else close();
  }

  function change(field: keyof CreateSubtaskFields, value: string) {
    if (locked || inFlight.current || confirmingDiscard) return;
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current || confirmingDiscard) return;
    const result = parseCreateSubtaskFields(fields);
    setErrors(result.errors ?? {});
    setError(null);
    if (result.errors) {
      if (result.errors.title) titleRef.current?.focus();
      else durationRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    let saved = false;
    try {
      saved = await onSave(result.input);
      if (!saved) setError("Не вдалося додати підзадачу. Перевірте дані та спробуйте ще раз.");
    } catch {
      setError("Не вдалося додати підзадачу. Перевірте дані та спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    // POST succeeded even if the coordinator could not refresh the parent.
    if (saved) close();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.discardDialog}
      aria-modal="true"
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-parent`}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (confirmingDiscard) return;
        if (event.key === "Escape") event.stopPropagation();
        if (event.key !== "Tab") return;
        const controls = [titleRef.current, durationRef.current, cancelRef.current, saveRef.current].filter((control) => control && !control.disabled);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <form noValidate className={styles.editSubtaskForm} onSubmit={submit} aria-busy={submitting}>
        <h2 id={`${id}-heading`} className={styles.sectionTitle}>Нова підзадача</h2>
        <p id={`${id}-parent`} className={styles.discardDescription}>{taskTitle}</p>
        <label className={styles.field} htmlFor={`${id}-title`}>
          Назва
          <input
            ref={titleRef}
            id={`${id}-title`}
            name="title"
            value={fields.title}
            required
            disabled={locked}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? `${id}-title-error` : undefined}
            onChange={(event) => change("title", event.target.value)}
          />
          {errors.title && <span id={`${id}-title-error`} className={styles.fieldError}>{errors.title}</span>}
        </label>
        <label className={styles.field} htmlFor={`${id}-duration`}>
          Орієнтовна тривалість у хвилинах
          <input
            ref={durationRef}
            id={`${id}-duration`}
            name="estimatedDurationMinutes"
            type="number"
            min={1}
            max={MAX_DURATION_MINUTES}
            step={1}
            value={fields.estimatedDurationMinutes}
            required
            disabled={locked}
            aria-invalid={Boolean(errors.estimatedDurationMinutes)}
            aria-describedby={errors.estimatedDurationMinutes ? `${id}-duration-error` : undefined}
            onChange={(event) => change("estimatedDurationMinutes", event.target.value)}
          />
          {errors.estimatedDurationMinutes && <span id={`${id}-duration-error`} className={styles.fieldError}>{errors.estimatedDurationMinutes}</span>}
        </label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {submitting && <p role="status">Додавання та оновлення даних…</p>}
        <div className={styles.discardActions}>
          <button ref={cancelRef} type="button" className={styles.secondaryButton} aria-disabled={submitting} onClick={requestClose}>Скасувати</button>
          <button ref={saveRef} type="submit" className={styles.primaryButton} aria-disabled={locked}>Додати</button>
        </div>
      </form>
      {confirmingDiscard && <DiscardChangesDialog
        onContinue={() => setConfirmingDiscard(false)}
        onDiscard={close}
      />}
    </dialog>
  );
}
