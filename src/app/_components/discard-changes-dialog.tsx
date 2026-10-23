"use client";

import { useEffect, useRef } from "react";
import styles from "../page.module.css";

type Props = {
  onContinue: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({ onContinue, onDiscard }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    continueRef.current?.focus();
    return () => dialog?.close();
  }, []);

  function continueEditing() {
    dialogRef.current?.close();
    onContinue();
    previousFocus.current?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.discardDialog}
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
      <h2 id="discard-heading" className={styles.sectionTitle}>Відкинути зміни?</h2>
      <p id="discard-description" className={styles.discardDescription}>Введені дані буде втрачено.</p>
      <div className={styles.discardActions}>
        <button ref={continueRef} type="button" className={styles.secondaryButton} onClick={continueEditing}>Продовжити редагування</button>
        <button ref={discardRef} type="button" className={styles.dangerButton} onClick={onDiscard}>Відкинути зміни</button>
      </div>
    </dialog>
  );
}
