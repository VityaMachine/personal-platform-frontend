"use client";

import uiStyles from "../../../shared/ui/controls.module.css";

import { useEffect, useId, useRef } from "react";

export function DeleteAreaDialog({ name, pending, error, onConfirm, onClose }: {
  name: string; pending: boolean; error: string | null; onConfirm: () => void; onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
    const dialog = dialogRef.current;
    return () => { dialog?.close(); requestAnimationFrame(() => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    }); };
  }, []);
  return <dialog ref={dialogRef} className={uiStyles.discardDialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!pending) onClose(); }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); if (!pending) onClose(); return; }
      if (event.key !== "Tab") return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    }}>
    <h2 id={`${id}-heading`} className={uiStyles.sectionTitle}>Видалити сферу «{name}»?</h2>
    <p id={`${id}-description`} className={uiStyles.discardDescription}>Сферу буде видалено назавжди. Пов’язані задачі залишаться без сфери</p>
    {error && <p role="alert" className={uiStyles.error}>{error}</p>}
    <div className={uiStyles.discardActions}>
      <button ref={cancelRef} type="button" className={uiStyles.secondaryButton} aria-disabled={pending} onClick={() => { if (!pending) onClose(); }}>Скасувати</button>
      <button type="button" className={uiStyles.dangerButton} aria-disabled={pending} onClick={() => { if (!pending) onConfirm(); }}>{pending ? "Видалення…" : "Видалити сферу"}</button>
    </div>
  </dialog>;
}
