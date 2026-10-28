"use client";

import uiStyles from "../../../shared/ui/controls.module.css";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Task } from "@/modules/tasks/model/task-types";
import { CreateTaskForm } from "./create-task-form";
import { DiscardChangesDialog } from "../../../shared/ui/discard-changes-dialog";

type Props = {
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCreated: (task: Task, contextKey: string) => void;
  onSubmittingChange: (submitting: boolean) => void;
};

export function CreateTaskModal({ returnFocusRef, onClose, onCreated, onSubmittingChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    // Native modal dialogs contain keyboard focus and make the page behind inert.
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>("#create-title")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      // Wait for the opening button to become enabled after a successful POST.
      requestAnimationFrame(() => opener?.focus());
    };
  }, [returnFocusRef]);

  function requestClose() {
    if (inFlight.current || confirmingDiscard) return;
    if (dirty.current) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={uiStyles.modal}
      aria-labelledby="create-heading"
      onKeyDown={(event) => {
        // Keep dirty/pending close checks synchronous across history traversals.
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div className={uiStyles.modalLayout}>
        <header className={uiStyles.modalHeader}>
          <h2 id="create-heading" className={uiStyles.sectionTitle}>Нова задача</h2>
          <button type="button" className={uiStyles.closeButton} disabled={submitting} onClick={requestClose} aria-label="Закрити вікно створення задачі">✕</button>
        </header>
        <div className={uiStyles.modalBody}>
          <CreateTaskForm
            formId="create-task-form"
            disabled={submitting}
            onDirtyChange={(value) => { dirty.current = value; }}
            onSubmittingChange={(value) => {
              inFlight.current = value;
              setSubmitting(value);
              onSubmittingChange(value);
            }}
            onCreated={onCreated}
          />
        </div>
        <footer className={uiStyles.modalFooter}>
          <button type="button" className={uiStyles.secondaryButton} disabled={submitting} onClick={requestClose}>Скасувати</button>
          <button type="submit" form="create-task-form" className={uiStyles.primaryButton} disabled={submitting}>
            {submitting ? "Створення…" : "Створити задачу"}
          </button>
        </footer>
      </div>
      {confirmingDiscard && (
        <DiscardChangesDialog
          onContinue={() => setConfirmingDiscard(false)}
          onDiscard={() => {
            if (inFlight.current) return;
            onClose();
          }}
        />
      )}
    </dialog>
  );
}
