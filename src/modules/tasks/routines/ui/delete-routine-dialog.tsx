"use client";
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { RoutineRemovalOutcome, RoutineRemovalCheckOutcome } from "../hooks/use-routines";
import { useHistoryTraversalGuard } from "../../../../shared/navigation/use-history-traversal-guard";
import shared from "../../../../app/page.module.css";
import styles from "./routines.module.css";

export function DeleteRoutineDialog({ title, opener, fallbackFocusRef, onConfirm, onCheck, onClose, onDeleted }: {
  title: string; opener: HTMLButtonElement; fallbackFocusRef: RefObject<HTMLHeadingElement | null>;
  onConfirm: () => Promise<RoutineRemovalOutcome | null>; onCheck: () => Promise<RoutineRemovalCheckOutcome | null>;
  onClose: () => void; onDeleted: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState<"delete" | "check" | null>(null);
  const [error, setError] = useState<{ message: string; uncertain: boolean } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useHistoryTraversalGuard(pending !== null, (attempt) => { attempt.stay(); return true; });
  useEffect(() => {
    const dialog = dialogRef.current, overflow = document.body.style.overflow;
    const fallbackFocus = fallbackFocusRef.current;
    dialog?.showModal(); cancelRef.current?.focus(); document.body.style.overflow = "hidden";
    return () => {
      dialog?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => {
        if (document.querySelector("dialog[open]")) return;
        const target = opener.isConnected ? opener : fallbackFocus;
        if (target?.isConnected) target.focus();
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
  function markMissing() {
    setMissing(true); setError(null); setCheckError(null);
    setNotice("Шаблон уже недоступний. Актуальний список оновлено.");
    requestAnimationFrame(() => cancelRef.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || missing) return;
    inFlight.current = true; setPending("delete"); setError(null); setCheckError(null); setNotice(null);
    try {
      const outcome = await onConfirm();
      if (outcome?.status === "deleted") onDeleted();
      else if (outcome?.status === "missing") markMissing();
      else if (outcome?.status === "error") setError(outcome);
    } catch {
      setError({ message: "Не вдалося отримати підтвердження видалення. Видалення могло відбутися. Перевірте актуальний список.", uncertain: true });
    } finally { inFlight.current = false; setPending(null); }
  }
  async function check() {
    if (inFlight.current) return;
    inFlight.current = true; setPending("check"); setCheckError(null);
    try {
      const outcome = await onCheck();
      if (outcome?.status === "missing") markMissing();
      else if (outcome?.status === "present") {
        setError(null); setNotice("Шаблон є в актуальному списку. Щоб видалити його, підтвердьте дію ще раз.");
      } else if (outcome?.status === "error") setCheckError(outcome.message);
    } catch { setCheckError("Не вдалося перевірити актуальний список. Попередній результат видалення залишається невідомим."); }
    finally { inFlight.current = false; setPending(null); }
  }
  return <dialog ref={dialogRef} className={shared.discardDialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)")];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <form onSubmit={submit} aria-busy={pending !== null}>
      <h2 id={`${id}-heading`} className={shared.sectionTitle}>Видалити повторення?</h2>
      <p id={`${id}-description`} className={`${shared.discardDescription} ${styles.text}`}>Шаблон “{title}” буде видалено. Уже створені задачі та їхня історія залишаться. Нові виконання з цього шаблону створювати буде неможливо. Відновлення через інтерфейс недоступне.</p>
      {error && <div role="alert" className={shared.error}><p>{error.message}</p>
        <button type="button" className={shared.secondaryButton} aria-disabled={pending !== null} onClick={() => void check()}>Перевірити актуальний список</button>
        {error.uncertain && <p>Перевірка лише оновлює список і не повторює видалення.</p>}
      </div>}
      {checkError && <p role="alert" className={shared.fieldError}>{checkError}</p>}
      {notice && <p role="status" className={shared.notice}>{notice}</p>}
      {pending && <p role="status">{pending === "delete" ? "Видалення повторення…" : "Перевірка актуального списку…"}</p>}
      <div className={shared.discardActions}>
        <button ref={cancelRef} type="button" className={shared.secondaryButton} aria-disabled={pending !== null} onClick={close}>Скасувати</button>
        <button type="submit" className={shared.dangerButton} disabled={missing} aria-disabled={pending !== null || missing}>Видалити повторення</button>
      </div>
    </form>
  </dialog>;
}
