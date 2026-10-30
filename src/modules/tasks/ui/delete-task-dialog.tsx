"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { useHistoryTraversalGuard } from "../../../shared/navigation/use-history-traversal-guard";
import { taskRemovalError, type TaskRemovalOutcome, type TaskRemovalCheckOutcome } from "../model/task-removal";
import styles from "../../../shared/ui/controls.module.css";
import taskStyles from "./tasks.module.css";

export function DeleteTaskDialog({ title, opener, fallbackFocusRef, disabled, initialUncertain = false, onConfirm, onCheck, onClose }: {
  title: string; opener: HTMLButtonElement; fallbackFocusRef: RefObject<HTMLElement | null>; disabled: boolean; initialUncertain?: boolean;
  onConfirm: () => Promise<TaskRemovalOutcome | null>; onCheck: () => Promise<TaskRemovalCheckOutcome | null>; onClose: () => void;
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), checkButton = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false), removed = useRef(false);
  const [pending, setPending] = useState<"delete" | "check" | null>(null);
  const [error, setError] = useState<{ message: string; uncertain: boolean } | null>(initialUncertain
    ? { message: "Результат попереднього видалення невідомий. Перевірте актуальний стан задачі.", uncertain: true } : null);
  const [notice, setNotice] = useState("");
  useHistoryTraversalGuard(true, (attempt) => { attempt.stay(); return true; });
  useEffect(() => {
    const element = dialog.current, overflow = document.body.style.overflow, fallback = fallbackFocusRef.current;
    const protectPending = (event: Event) => { if (inFlight.current) event.preventDefault(); };
    element?.addEventListener("cancel", protectPending);
    element?.showModal(); cancel.current?.focus(); document.body.style.overflow = "hidden";
    return () => {
      element?.removeEventListener("cancel", protectPending); element?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => {
        if (document.querySelector("dialog[open]")) return;
        const target = !removed.current && opener.isConnected ? opener : fallback;
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
    };
  }, [opener, fallbackFocusRef]);
  useEffect(() => {
    if (!pending) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [pending]);

  function close() { if (!inFlight.current) onClose(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || inFlight.current || error?.uncertain) return;
    inFlight.current = true; setPending("delete"); setError(null); setNotice("");
    try {
      const outcome = await onConfirm();
      if (outcome?.status === "deleted" || outcome?.status === "missing") { removed.current = true; onClose(); }
      else if (outcome?.status === "error") {
        setError(outcome);
        requestAnimationFrame(() => (outcome.uncertain ? checkButton.current : cancel.current)?.focus());
      }
    } catch (error) {
      setError(taskRemovalError(error));
      requestAnimationFrame(() => checkButton.current?.focus());
    } finally { inFlight.current = false; setPending(null); }
  }
  async function check() {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setPending("check");
    try {
      const outcome = await onCheck();
      if (outcome?.status === "missing") { removed.current = true; onClose(); }
      else if (outcome?.status === "present") {
        setError(null); setNotice("Задача є в актуальному списку. Для видалення потрібне нове явне підтвердження.");
      } else if (outcome?.status === "error") setError({ message: outcome.message, uncertain: true });
      requestAnimationFrame(() => cancel.current?.focus());
    } catch {
      setError({ message: "Не вдалося перевірити стан задачі. Результат видалення залишається невідомим.", uncertain: true });
    } finally { inFlight.current = false; setPending(null); }
  }
  return <dialog ref={dialog} className={styles.discardDialog} role="alertdialog" aria-modal="true"
    aria-labelledby={`${id}-heading`} aria-describedby={`${id}-title ${id}-description`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <form onSubmit={submit} aria-busy={pending !== null}>
      <h2 className={styles.sectionTitle} id={`${id}-heading`}>Видалити задачу?</h2>
      <p className={`${styles.discardDescription} ${taskStyles.deleteTaskTitle}`} id={`${id}-title`}>{title}</p>
      <p className={styles.discardDescription} id={`${id}-description`}>Задача зникне зі списків. Відновлення через інтерфейс недоступне.</p>
      {error && <div className={styles.error} role="alert"><p>{error.message}</p>
        {error.uncertain && <button ref={checkButton} type="button" className={styles.secondaryButton} aria-disabled={pending !== null} onClick={() => void check()}>Перевірити стан задачі</button>}
      </div>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {pending && <p role="status">{pending === "delete" ? "Видалення задачі…" : "Перевірка стану задачі…"}</p>}
      <div className={styles.discardActions}>
        <button ref={cancel} type="button" className={styles.secondaryButton} aria-disabled={pending !== null} onClick={close}>Скасувати</button>
        <button type="submit" className={styles.dangerButton} disabled={Boolean(error?.uncertain)} aria-disabled={disabled || pending !== null}>Видалити</button>
      </div>
    </form>
  </dialog>;
}
