"use client";

import uiStyles from "../../../shared/ui/controls.module.css";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";

type Props = {
  subtaskTitle: string;
  opener: HTMLButtonElement;
  successFocusRef: RefObject<HTMLHeadingElement | null>;
  disabled: boolean;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
};

export function DeleteSubtaskDialog({ subtaskTitle, opener, successFocusRef, disabled, onConfirm, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);

  function close(deleted = false) {
    if (inFlight.current) return;
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => {
      const target = deleted ? successFocusRef.current : opener;
      if (target?.isConnected) target.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    let deleted = false;
    try {
      // True also means DELETE succeeded but the subsequent GET failed.
      deleted = await onConfirm();
      if (!deleted) setError("Не вдалося видалити підзадачу. Спробуйте ще раз.");
    } catch {
      setError("Не вдалося видалити підзадачу. Спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
    if (deleted) close(true);
  }

  return (
    <dialog
      ref={dialogRef}
      className={uiStyles.discardDialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-title ${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
        if (event.key !== "Tab") return;
        if (event.shiftKey && document.activeElement === cancelRef.current) {
          event.preventDefault();
          deleteRef.current?.focus();
        } else if (!event.shiftKey && document.activeElement === deleteRef.current) {
          event.preventDefault();
          cancelRef.current?.focus();
        }
      }}
    >
      <form onSubmit={submit} aria-busy={submitting}>
        <h2 id={`${id}-heading`} className={uiStyles.sectionTitle}>Видалити підзадачу?</h2>
        <p id={`${id}-title`} className={uiStyles.discardDescription}>{subtaskTitle}</p>
        <p id={`${id}-description`} className={uiStyles.discardDescription}>Підзадача зникне зі списку. Відновити її не можна.</p>
        {error && <p role="alert" className={uiStyles.error}>{error}</p>}
        {submitting && <p role="status">Видалення та оновлення даних…</p>}
        <div className={uiStyles.discardActions}>
          <button ref={cancelRef} type="button" className={uiStyles.secondaryButton} aria-disabled={submitting} onClick={() => close()}>Скасувати</button>
          <button ref={deleteRef} type="submit" className={uiStyles.dangerButton} aria-disabled={disabled || submitting}>Видалити</button>
        </div>
      </form>
    </dialog>
  );
}
