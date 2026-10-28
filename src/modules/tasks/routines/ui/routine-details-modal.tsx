"use client";

import uiStyles from "../../../../shared/ui/controls.module.css";
import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useId, useRef, useState } from "react";
import type { Routine } from "@/modules/tasks/routines/model/routine-types";
import { useRoutineDetails } from "../hooks/use-routines";
import { RoutineFacts } from "./routine-facts";
import { RoutinePreview } from "./routine-preview";
import { useRoutineScheduleVersions } from "../hooks/use-routine-schedule-versions";
import { ChangeRoutineScheduleModal } from "./change-routine-schedule-modal";
import { scheduleVersionStatus } from "@/modules/tasks/routines/model/routine-schedule-versions";
import { formatRoutineDate, formatRoutineSchedule, formatRoutineEnd, formatShortMonth } from "@/modules/tasks/routines/model/routine-format";
import { formatDuration } from "@/shared/lib/format-duration";
import styles from "./routines.module.css";

export function RoutineDetailsModal({ routineId, replacement, opener, pending, error, notice, onToggle, onClose, onRoutine }: {
  routineId: string; replacement?: Routine; opener: HTMLButtonElement; pending: boolean;
  error?: string; notice?: string; onToggle: (routine: Routine) => void; onClose: () => void; onRoutine: (routine: Routine) => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const details = useRoutineDetails(routineId, replacement);
  const versions = useRoutineScheduleVersions(routineId);
  const [scheduleOpener, setScheduleOpener] = useState<HTMLButtonElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
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
  return <dialog ref={dialogRef} closedby={scheduleOpener ? "none" : "closerequest"} className={`${uiStyles.modal} ${styles.modal}`} aria-labelledby={`${id}-heading`} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (event.target === event.currentTarget && !pending && !scheduleOpener) onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab" || scheduleOpener || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"], summary')].filter((control) => control.getClientRects().length > 0);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className={`${uiStyles.modalLayout} ${styles.layout}`}>
      <header className={uiStyles.modalHeader}>
        <h2 id={`${id}-heading`} className={`${uiStyles.sectionTitle} ${styles.modalTitle}`}>{routine?.title ?? "Деталі повторюваної задачі"}</h2>
        <button ref={closeRef} type="button" className={uiStyles.closeButton} disabled={pending} onClick={onClose} aria-label="Закрити деталі повторюваної задачі">✕</button>
      </header>
      <div className={`${uiStyles.modalBody} ${styles.body}`} tabIndex={0} role="region" aria-label="Деталі та preview розкладу">
        {details.loading && <p role="status">Завантаження деталей…</p>}
        {details.error && <div role="alert" className={uiStyles.error}><p>{details.error}</p>
          <button type="button" className={uiStyles.secondaryButton} onClick={details.retry}>Повторити завантаження деталей</button>
        </div>}
        {routine && <>
          <p className={styles.text}>{routine.description || "Опис не додано."}</p>
          <RoutineFacts routine={routine} detailed />
          <section className={styles.preview} aria-labelledby={`${id}-schedule`} aria-busy={versions.loading}>
            <h3 id={`${id}-schedule`}>Розклад</h3>
            <p className={styles.hint}>Поля шаблону вище відображають останній збережений розклад. Чинність версій наведено нижче; календарні вікна обчислює сервер за історією версій.</p>
            {versions.loading && <p role="status">Завантаження версій…</p>}
            {versions.error && <div role="alert"><p className={uiStyles.fieldError}>{versions.error}</p><button type="button" className={uiStyles.secondaryButton} onClick={() => void versions.reload()}>Повторити GET версій</button></div>}
            {versions.data && <ol className={styles.versions}>{versions.data.map((version) => <li key={version.id}>
              <strong>№{version.number} · {scheduleVersionStatus(version, versions.data!, Temporal.Instant.fromEpochMilliseconds(now))}{version.number === 1 ? " · Початковий" : ""}</strong>
              <p>З <time dateTime={version.effectiveDate}>{formatRoutineDate(version.effectiveDate)}</time> ({version.effectiveTimezone}) · timezone: {version.timezone}</p>
              <p>{formatRoutineSchedule(version.schedule)} · {version.schedule.localTime ?? "Без заданого часу"} · {formatRoutineEnd(version.endCondition)}</p>
              <p className={styles.hint}>Прив’язка повторення: {formatRoutineDate(version.startDate)}. {formatShortMonth(version.schedule)}</p>
            </li>)}</ol>}
            <button type="button" className={uiStyles.secondaryButton} aria-disabled={pending || versions.loading || !!versions.error || !versions.data || versions.data.length >= 100} onClick={(event) => {
              if (!pending && !versions.loading && !versions.error && versions.data && versions.data.length < 100) setScheduleOpener(event.currentTarget);
            }}>Змінити розклад</button>
          </section>
          <p className={styles.hint}>«Активний» означає відсутність паузи. Розклад міг уже завершитися за датою або кількістю виконань.</p>
          <button type="button" className={uiStyles.secondaryButton} disabled={pending} onClick={() => onToggle(routine)}>
            {pending ? "Збереження…" : routine.pausedAt ? "Відновити" : "Призупинити"}
          </button>
          {error && <p role="alert" className={uiStyles.fieldError}>{error}</p>}
          {notice && <p role="status" className={uiStyles.notice}>{notice}</p>}
          <section aria-labelledby={`${id}-templates`}>
            <h3 id={`${id}-templates`}>Шаблони підзадач</h3>
            {routine.subtasks.length === 0 ? <p>Шаблонів підзадач немає.</p> : <ol className={styles.templates}>
              {routine.subtasks.map((child) => <li key={child.id}>{child.title} · {formatDuration(child.estimatedDurationMinutes)}</li>)}
            </ol>}
          </section>
          <div hidden={!!scheduleOpener}><RoutinePreview routine={routine} disabled={pending} /></div>
        </>}
      </div>
    </div>
    {scheduleOpener && routine && versions.data && <ChangeRoutineScheduleModal routine={routine} versions={versions.data} opener={scheduleOpener}
      reloadVersions={versions.reload} onRoutine={onRoutine} onClose={() => setScheduleOpener(null)} />}
  </dialog>;
}
