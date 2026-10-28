"use client";

import uiStyles from "../../../shared/ui/controls.module.css";
import taskStyles from "./tasks.module.css";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { parseEditSubtaskFields, type EditSubtaskErrors, type EditSubtaskFields } from "@/modules/tasks/model/edit-subtask-input";
import { MAX_DURATION_MINUTES } from "@/modules/tasks/model/task-field-input";
import type { Subtask, SubtaskDetailsChange } from "@/modules/tasks/model/task-types";
import { DiscardChangesDialog } from "../../../shared/ui/discard-changes-dialog";

type Props = {
  subtask: Subtask;
  opener: HTMLButtonElement;
  disabled: boolean;
  onSave: (change: SubtaskDetailsChange) => Promise<boolean>;
  onClose: () => void;
};

export function EditSubtaskDialog({ subtask, opener, disabled, onSave, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [fields, setFields] = useState<EditSubtaskFields>({ title: subtask.title, estimatedDurationMinutes: String(subtask.estimatedDurationMinutes) });
  const [errors, setErrors] = useState<EditSubtaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const dirty = fields.title !== subtask.title || fields.estimatedDurationMinutes !== String(subtask.estimatedDurationMinutes);
  const locked = disabled || submitting;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    titleRef.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => { if (opener.isConnected) opener.focus(); });
    };
  }, [opener]);

  function requestClose() {
    if (inFlight.current || confirmingDiscard) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  }

  function change(field: keyof EditSubtaskFields, value: string) {
    if (locked || inFlight.current || confirmingDiscard) return;
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current || confirmingDiscard) return;
    const result = parseEditSubtaskFields(fields, subtask);
    setErrors(result.errors ?? {});
    setError(null);
    if (result.errors) {
      if (result.errors.title) titleRef.current?.focus();
      else durationRef.current?.focus();
      return;
    }
    if (result.input === null) {
      onClose();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    let saved = false;
    try {
      saved = await onSave(result.input);
      if (!saved) setError("Не вдалося зберегти підзадачу. Спробуйте ще раз.");
    } catch {
      setError("Не вдалося зберегти підзадачу. Спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    // The coordinator returns true after a saved PATCH even if GET failed.
    if (saved) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={uiStyles.discardDialog}
      aria-labelledby={`${id}-heading`}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onKeyDown={(event) => {
        // The nested confirmation owns keyboard handling while it is open.
        if (confirmingDiscard || event.key !== "Tab") return;
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
      <form noValidate className={taskStyles.editSubtaskForm} onSubmit={submit} aria-busy={submitting}>
        <h2 id={`${id}-heading`} className={uiStyles.sectionTitle}>Редагувати підзадачу</h2>
        <label className={uiStyles.field} htmlFor={`${id}-title`}>
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
          {errors.title && <span id={`${id}-title-error`} className={uiStyles.fieldError}>{errors.title}</span>}
        </label>
        <label className={uiStyles.field} htmlFor={`${id}-duration`}>
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
          {errors.estimatedDurationMinutes && <span id={`${id}-duration-error`} className={uiStyles.fieldError}>{errors.estimatedDurationMinutes}</span>}
        </label>
        {error && <p role="alert" className={uiStyles.error}>{error}</p>}
        {submitting && <p role="status">Збереження та оновлення даних…</p>}
        <div className={uiStyles.discardActions}>
          <button ref={cancelRef} type="button" className={uiStyles.secondaryButton} disabled={submitting} onClick={requestClose}>Скасувати</button>
          <button ref={saveRef} type="submit" className={uiStyles.primaryButton} disabled={locked}>Зберегти</button>
        </div>
      </form>
      {confirmingDiscard && <DiscardChangesDialog
        onContinue={() => setConfirmingDiscard(false)}
        onDiscard={() => { if (!inFlight.current) onClose(); }}
      />}
    </dialog>
  );
}
