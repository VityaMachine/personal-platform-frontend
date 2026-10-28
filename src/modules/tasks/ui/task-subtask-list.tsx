"use client";

import { useState } from "react";
import { SUBTASK_STATUSES, type Subtask, type SubtaskDetailsChange, type SubtaskStatusChange } from "@/modules/tasks/model/task-types";
import { TASK_STATUS_LABELS } from "@/modules/tasks/model/task-labels";
import { formatDuration } from "@/shared/lib/format-duration";
import { CancelSubtaskDialog } from "./cancel-subtask-dialog";
import { EditSubtaskDialog } from "./edit-subtask-dialog";
import styles from "../../../app/page.module.css";

type Props = {
  subtasks: Subtask[];
  taskTitle: string;
  disabled: boolean;
  readOnly?: boolean;
  onStatusChange: (subtask: Subtask, change: SubtaskStatusChange) => Promise<boolean>;
  onEdit: (id: string, change: SubtaskDetailsChange) => Promise<boolean>;
  onRequestDelete: (subtask: Subtask, opener: HTMLButtonElement) => void;
};

export function TaskSubtaskList({ subtasks, taskTitle, disabled, readOnly = false, onStatusChange, onEdit, onRequestDelete }: Props) {
  const [canceling, setCanceling] = useState<{ subtask: Subtask; opener: HTMLSelectElement } | null>(null);
  const [editing, setEditing] = useState<{ subtask: Subtask; opener: HTMLButtonElement } | null>(null);

  function selectStatus(subtask: Subtask, select: HTMLSelectElement) {
    const status = SUBTASK_STATUSES.find((value) => value === select.value);
    if (disabled || !status || status === subtask.status) return;
    if (status === "CANCELED") setCanceling({ subtask, opener: select });
    else void onStatusChange(subtask, { status });
  }

  return (
    <div className={styles.nestedSubtaskContainer}>
      <div className={styles.nestedSubtaskColumns} aria-hidden="true">
        <span className={styles.subtaskNameColumn}>Підзадача</span>
        <span>Статус</span>
        <span>Час</span>
        {!readOnly && <span className={styles.subtaskActionsColumn}>Дії</span>}
      </div>
      <ul className={styles.nestedSubtaskList} aria-label={`Підзадачі задачі «${taskTitle}»`}>
        {subtasks.map((subtask) => (
          <li key={subtask.id} className={styles.nestedSubtask} data-status={subtask.status}>
            {!readOnly && subtask.status !== "CANCELED" ? (
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={subtask.status === "DONE"}
                disabled={disabled}
                aria-label={`${subtask.status === "DONE" ? "Відкрити повторно" : "Завершити"} підзадачу: ${subtask.title}`}
                onChange={(event) => void onStatusChange(subtask, { status: event.target.checked ? "DONE" : "TODO" })}
              />
            ) : <span className={styles.checkboxSpace} aria-hidden="true" />}
            <span className={styles.nestedSubtaskTitle}>{subtask.title}</span>
            {readOnly ? <span className={`${styles.taskStatus} ${styles.nestedSubtaskStatus}`} data-status={subtask.status}>{TASK_STATUS_LABELS[subtask.status]}</span> : <select
              className={`${styles.taskStatus} ${styles.nestedSubtaskStatus}`}
              data-status={subtask.status}
              aria-label={`Статус підзадачі: ${subtask.title}`}
              value={subtask.status}
              disabled={disabled}
              onChange={(event) => selectStatus(subtask, event.currentTarget)}
            >
              {SUBTASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
            </select>}
            <span className={styles.nestedSubtaskDuration}><span className={styles.visuallyHidden}>Орієнтовна тривалість: </span>{formatDuration(subtask.estimatedDurationMinutes)}</span>
            {!readOnly && <button
              type="button"
              className={styles.iconButton}
              aria-label={`Редагувати підзадачу: ${subtask.title}`}
              // Keep the opener focusable after a saved PATCH with a failed GET.
              aria-disabled={disabled}
              onClick={(event) => { if (!disabled) setEditing({ subtask, opener: event.currentTarget }); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="m16 3 5 5L8 21H3v-5L16 3Z M13 6l5 5" />
              </svg>
            </button>}
            {!readOnly && <button
              type="button"
              className={`${styles.iconButton} ${styles.subtaskDeleteAction}`}
              disabled={disabled}
              aria-label={`Видалити підзадачу: ${subtask.title}`}
              onClick={(event) => { if (!disabled) onRequestDelete(subtask, event.currentTarget); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
              </svg>
            </button>}
          </li>
        ))}
      </ul>
      {canceling && (
        <CancelSubtaskDialog
          subtaskTitle={canceling.subtask.title}
          opener={canceling.opener}
          disabled={disabled}
          onClose={() => setCanceling(null)}
          onConfirm={(cancellationNote) => onStatusChange(canceling.subtask, { status: "CANCELED", cancellationNote })}
        />
      )}
      {editing && <EditSubtaskDialog
        subtask={editing.subtask}
        opener={editing.opener}
        disabled={disabled}
        onClose={() => setEditing(null)}
        onSave={(change) => onEdit(editing.subtask.id, change)}
      />}
    </div>
  );
}
