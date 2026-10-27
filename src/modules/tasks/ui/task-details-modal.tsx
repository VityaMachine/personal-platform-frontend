"use client";

import { useEffect, useId, useRef } from "react";
import { useTaskDetails } from "../hooks/use-task-details";
import { TaskDetailsContent } from "./task-details-content";
import { TaskHistory } from "./task-history";
import styles from "./task-details.module.css";
import shared from "../../../app/page.module.css";

type Props = { taskId: string; opener: HTMLButtonElement; onClose: () => void };

function LoadError({ error, retry, label }: { error: string; retry: () => void; label: string }) {
  return <div role="alert" className={shared.error}>
    <p>{error}</p>
    <button type="button" className={shared.secondaryButton} onClick={retry}>{label}</button>
  </div>;
}

export function TaskDetailsModal({ taskId, opener, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { task, history } = useTaskDetails(taskId);

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => {
        if (opener.isConnected && !document.querySelector("dialog[open]")) opener.focus();
      });
    };
  }, [opener]);

  return <dialog ref={dialogRef} className={`${shared.modal} ${styles.detailsModal}`} aria-modal="true" aria-labelledby={`${id}-heading`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"], summary')];
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault(); controls.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault(); controls[0]?.focus();
      }
    }}>
    <div className={`${shared.modalLayout} ${styles.layout}`}>
      <header className={shared.modalHeader}>
        <h2 id={`${id}-heading`} className={`${shared.sectionTitle} ${styles.heading}`}>{task.data?.title ?? "Деталі задачі"}</h2>
        <button ref={closeRef} type="button" className={shared.closeButton} onClick={onClose} aria-label="Закрити деталі задачі">✕</button>
      </header>
      <div className={`${shared.modalBody} ${styles.body}`} tabIndex={0} role="region" aria-label="Вміст деталей задачі">
        <div aria-busy={task.loading}>
          {task.loading && <p role="status">Завантаження деталей задачі…</p>}
          {task.error && <LoadError error={task.error} retry={task.retry} label="Повторити завантаження задачі" />}
          {task.data && <TaskDetailsContent task={task.data} />}
        </div>
        <section className={styles.history} aria-labelledby={`${id}-history`} aria-busy={history.loading}>
          <h3 id={`${id}-history`}>Історія</h3>
          {history.loading && <p role="status">Завантаження історії…</p>}
          {history.error && <LoadError error={history.error} retry={history.retry} label="Повторити завантаження історії" />}
          {history.data && <TaskHistory events={history.data} />}
        </section>
      </div>
    </div>
  </dialog>;
}
