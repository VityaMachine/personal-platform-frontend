"use client";
import { useEffect, useId, useRef } from "react";
import type { RoutineGenerationResult, RoutineScheduleVersion } from "@/modules/tasks/routines/model/routine-types";
import { formatRoutineDate } from "@/modules/tasks/routines/model/routine-format";
import { RoutineConflicts } from "./routine-conflicts";
import shared from "../../../../app/page.module.css";
import styles from "./routines.module.css";

type Result = { type: "generation"; data: RoutineGenerationResult } | { type: "schedule"; data: RoutineScheduleVersion };
export function RoutineResultModal({ result, opener, onClose, refreshing = false, refreshError, onRefresh }: {
  result: Result; opener: HTMLButtonElement; onClose: () => void;
  refreshing?: boolean; refreshError?: string | null; onRefresh?: () => void;
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = dialog.current, overflow = document.body.style.overflow;
    node?.showModal(); close.current?.focus(); document.body.style.overflow = "hidden";
    return () => {
      node?.close(); document.body.style.overflow = overflow;
      requestAnimationFrame(() => { if (opener.isConnected) opener.focus(); });
    };
  }, [opener]);
  useEffect(() => {
    if (dialog.current?.open && !dialog.current.contains(document.activeElement)) close.current?.focus();
  }, [refreshing]);
  return <dialog ref={dialog} data-routine-result="true" closedby="none" className={`${shared.modal} ${styles.resultModal}`} aria-modal="true" aria-labelledby={`${id}-heading`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={`${shared.modalLayout} ${styles.resultLayout}`}>
      <header className={shared.modalHeader}><h2 id={`${id}-heading`} className={shared.sectionTitle}>{result.type === "generation" ? "Результат генерації" : "Версію розкладу створено"}</h2></header>
      <div className={`${shared.modalBody} ${styles.body} ${styles.resultBody}`} tabIndex={0}>
        {result.type === "generation" ? <>
          <p role="status">Створено задач: {result.data.createdCount}. Уже існувало: {result.data.existingCount}</p>
          <RoutineConflicts conflicts={result.data.conflicts} />
        </> : <>
          <p role="status">Версію №{result.data.number} успішно створено.</p>
          <p>Дата початку дії: <time dateTime={result.data.effectiveDate}>{formatRoutineDate(result.data.effectiveDate)}</time> ({result.data.effectiveTimezone}).</p>
          <p>Уже створені задачі, включно з майбутніми, залишилися без змін.</p>
        </>}
        {refreshing && <p role="status">Оновлення даних…</p>}
        {refreshError && <div role="alert"><p className={shared.fieldError}>{refreshError}</p>
          {onRefresh && <button type="button" className={shared.secondaryButton} disabled={refreshing} onClick={onRefresh}>Оновити дані (лише GET)</button>}
        </div>}
      </div>
      <footer className={shared.modalFooter}><button ref={close} type="button" className={shared.primaryButton} onClick={onClose}>Закрити</button></footer>
    </div>
  </dialog>;
}
