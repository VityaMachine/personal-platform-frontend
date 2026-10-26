"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { TaskStatusChange } from "@/lib/task-types";
import type { TraversalAttempt } from "@/lib/history-traversal-guard";
import { parseSkipTaskNote } from "@/lib/skip-task-input";
import { useHistoryTraversalGuard } from "../_hooks/use-history-traversal-guard";
import { DiscardChangesDialog } from "./discard-changes-dialog";
import styles from "../page.module.css";

export function SkipTaskDialog({ taskTitle, opener, disabled, onConfirm, onClose }: {
  taskTitle: string; opener: HTMLButtonElement | HTMLSelectElement; disabled: boolean;
  onConfirm: (change: TaskStatusChange) => Promise<boolean>; onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const traversal = useRef<TraversalAttempt | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirty = note !== "";
  const locked = disabled || submitting;

  useHistoryTraversalGuard(dirty || submitting, (attempt) => {
    if (inFlight.current || confirming) { attempt.stay(); return true; }
    traversal.current = attempt;
    setConfirming(true);
    return true;
  });
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal(); noteRef.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        if (document.querySelector("dialog[open]")) return;
        if (opener.isConnected && !opener.disabled) opener.focus();
        else {
          const heading = document.getElementById("tasks-heading");
          if (heading) { heading.tabIndex = -1; heading.focus(); }
        }
      });
    };
  }, [opener]);
  useEffect(() => {
    if (!dirty && !submitting) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, submitting]);

  function requestClose() {
    if (inFlight.current || confirming) return;
    if (dirty) setConfirming(true);
    else onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || inFlight.current || confirming) return;
    const parsed = parseSkipTaskNote(note);
    if (!parsed.input) { setError(parsed.error); noteRef.current?.focus(); return; }
    inFlight.current = true; setSubmitting(true); setError(null); saveRef.current?.focus();
    let saved = false;
    try {
      saved = await onConfirm(parsed.input);
      if (!saved) setError("Не вдалося пропустити виконання. Спробуйте ще раз.");
    } catch { setError("Не вдалося пропустити виконання. Спробуйте ще раз."); }
    finally { inFlight.current = false; setSubmitting(false); }
    if (saved) onClose();
  }

  return <dialog ref={dialogRef} className={styles.discardDialog} aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-task ${id}-hint`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); requestClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); requestClose(); return;
      }
      if (event.key !== "Tab" || confirming) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('textarea:not(:disabled), button:not(:disabled)')];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <form noValidate className={styles.editSubtaskForm} onSubmit={submit} aria-busy={submitting}>
      <h2 id={`${id}-heading`} className={styles.sectionTitle}>Пропустити виконання?</h2>
      <p id={`${id}-task`} className={styles.discardDescription}>{taskTitle}</p>
      <p id={`${id}-hint`} className={styles.fieldHint}>Пропускається лише це виконання. Створені підзадачі залишаться без змін. Наступне виконання автоматично не створюється.</p>
      <label className={styles.field} htmlFor={`${id}-note`}>Причина пропуску (необов’язково, до 2000 символів)
        <textarea ref={noteRef} id={`${id}-note`} name="skipNote" rows={3} value={note} disabled={submitting}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => { if (!submitting && !inFlight.current) { setNote(event.target.value); setError(null); } }} />
      </label>
      {error && <p id={`${id}-error`} role="alert" className={styles.error}>{error}</p>}
      {submitting && <p role="status">Збереження пропуску…</p>}
      <div className={styles.discardActions}>
        <button type="button" className={styles.secondaryButton} aria-disabled={submitting} onClick={requestClose}>Скасувати</button>
        <button ref={saveRef} type="submit" className={styles.primaryButton} aria-disabled={locked}>Пропустити</button>
      </div>
    </form>
    {confirming && <DiscardChangesDialog onContinue={() => {
      traversal.current?.stay(); traversal.current = null; setConfirming(false);
    }} onDiscard={() => {
      const attempt = traversal.current; traversal.current = null; onClose(); attempt?.leave();
    }} />}
  </dialog>;
}
