"use client";
import { useEffect, useId, useRef } from "react";
import type { Routine } from "@/lib/routine-types";
import { useRoutineDetails } from "../_hooks/use-routines";
import { RoutineFacts } from "./routine-facts";
import { RoutinePreview } from "./routine-preview";
import { formatDuration } from "@/lib/format-duration";
import shared from "../page.module.css";
import styles from "./routines.module.css";

export function RoutineDetailsModal({ routineId, replacement, opener, pending, error, notice, onToggle, onClose }: {
  routineId: string; replacement?: Routine; opener: HTMLButtonElement; pending: boolean;
  error?: string; notice?: string; onToggle: (routine: Routine) => void; onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const details = useRoutineDetails(routineId, replacement);
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); closeRef.current?.focus(); document.body.style.overflow = "hidden";
    return () => {
      dialog?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => { if (opener.isConnected && !document.querySelector("dialog[open]")) opener.focus(); });
    };
  }, [opener]);
  const routine = details.data;
  return <dialog ref={dialogRef} className={`${shared.modal} ${styles.modal}`} aria-labelledby={`${id}-heading`} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!pending) onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"], summary')].filter((control) => control.getClientRects().length > 0);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={`${shared.modalLayout} ${styles.layout}`}>
      <header className={shared.modalHeader}>
        <h2 id={`${id}-heading`} className={`${shared.sectionTitle} ${styles.modalTitle}`}>{routine?.title ?? "Деталі повторюваної задачі"}</h2>
        <button ref={closeRef} type="button" className={shared.closeButton} disabled={pending} onClick={onClose} aria-label="Закрити деталі повторюваної задачі">✕</button>
      </header>
      <div className={`${shared.modalBody} ${styles.body}`} tabIndex={0} role="region" aria-label="Деталі та preview розкладу">
        {details.loading && <p role="status">Завантаження деталей…</p>}
        {details.error && <div role="alert" className={shared.error}><p>{details.error}</p>
          <button type="button" className={shared.secondaryButton} onClick={details.retry}>Повторити завантаження деталей</button>
        </div>}
        {routine && <>
          <p className={styles.text}>{routine.description || "Опис не додано."}</p>
          <RoutineFacts routine={routine} detailed />
          <p className={styles.hint}>«Активний» означає відсутність паузи. Розклад міг уже завершитися за датою або кількістю виконань.</p>
          <button type="button" className={shared.secondaryButton} disabled={pending} onClick={() => onToggle(routine)}>
            {pending ? "Збереження…" : routine.pausedAt ? "Відновити" : "Призупинити"}
          </button>
          {error && <p role="alert" className={shared.fieldError}>{error}</p>}
          {notice && <p role="status" className={shared.notice}>{notice}</p>}
          <section aria-labelledby={`${id}-templates`}>
            <h3 id={`${id}-templates`}>Шаблони підзадач</h3>
            {routine.subtasks.length === 0 ? <p>Шаблонів підзадач немає.</p> : <ol className={styles.templates}>
              {routine.subtasks.map((child) => <li key={child.id}>{child.title} · {formatDuration(child.estimatedDurationMinutes)}</li>)}
            </ol>}
          </section>
          <RoutinePreview routine={routine} disabled={pending} />
        </>}
      </div>
    </div>
  </dialog>;
}
