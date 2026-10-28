"use client";

import uiStyles from "./controls.module.css";

import { useEffect, useRef } from "react";

type Props = {
  onContinue: () => void;
  onDiscard: () => void;
  returnFocus?: HTMLElement | null;
  continueLabel?: string;
  discardLabel?: string;
};

export function DiscardChangesDialog({ onContinue, onDiscard, returnFocus, continueLabel = "Продовжити редагування", discardLabel = "Відкинути зміни" }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    previousFocus.current = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog?.showModal();
    continueRef.current?.focus();
    return () => dialog?.close();
  }, [returnFocus]);

  function continueEditing() {
    dialogRef.current?.close();
    onContinue();
    previousFocus.current?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className={uiStyles.discardDialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-heading"
      aria-describedby="discard-description"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        continueEditing();
      }}
      onKeyDown={(event) => {
        // Escape belongs only to this topmost dialog.
        if (event.key === "Escape") event.stopPropagation();
        if (event.key !== "Tab") return;
        if (event.shiftKey && document.activeElement === continueRef.current) {
          event.preventDefault();
          discardRef.current?.focus();
        } else if (!event.shiftKey && document.activeElement === discardRef.current) {
          event.preventDefault();
          continueRef.current?.focus();
        }
      }}
    >
      <h2 id="discard-heading" className={uiStyles.sectionTitle}>Відкинути зміни?</h2>
      <p id="discard-description" className={uiStyles.discardDescription}>Введені дані буде втрачено.</p>
      <div className={uiStyles.discardActions}>
        <button ref={continueRef} type="button" className={uiStyles.secondaryButton} onClick={continueEditing}>{continueLabel}</button>
        <button ref={discardRef} type="button" className={uiStyles.dangerButton} onClick={onDiscard}>{discardLabel}</button>
      </div>
    </dialog>
  );
}
