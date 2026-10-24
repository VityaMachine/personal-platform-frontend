"use client";

import { useState } from "react";
import { TASK_STATUSES, type Subtask, type SubtaskDetailsChange, type SubtaskStatusChange, type TaskStatus } from "@/lib/task-types";
import { TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatDuration } from "@/lib/format-duration";
import { CancelSubtaskDialog } from "./cancel-subtask-dialog";
import { EditSubtaskDialog } from "./edit-subtask-dialog";
import styles from "../page.module.css";

type Props = {
  subtasks: Subtask[];
  taskTitle: string;
  disabled: boolean;
  onStatusChange: (subtask: Subtask, change: SubtaskStatusChange) => Promise<boolean>;
  onEdit: (id: string, change: SubtaskDetailsChange) => Promise<boolean>;
};

export function TaskSubtaskList({ subtasks, taskTitle, disabled, onStatusChange, onEdit }: Props) {
  const [canceling, setCanceling] = useState<{ subtask: Subtask; opener: HTMLSelectElement } | null>(null);
  const [editing, setEditing] = useState<{ subtask: Subtask; opener: HTMLButtonElement } | null>(null);

  function selectStatus(subtask: Subtask, select: HTMLSelectElement) {
    const status = select.value as TaskStatus;
    if (disabled || status === subtask.status) return;
    if (status === "CANCELED") setCanceling({ subtask, opener: select });
    else void onStatusChange(subtask, { status });
  }

  return (
    <div className={styles.nestedSubtaskContainer}>
      <ul className={styles.nestedSubtaskList} aria-label={`Підзадачі задачі «${taskTitle}»`}>
      {subtasks.map((subtask) => (
        <li key={subtask.id} className={styles.nestedSubtask} data-status={subtask.status}>
          <span className={styles.nestedSubtaskHeading}>
            {subtask.status !== "CANCELED" && (
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={subtask.status === "DONE"}
                disabled={disabled}
                aria-label={`${subtask.status === "DONE" ? "Відкрити повторно" : "Завершити"} підзадачу: ${subtask.title}`}
                onChange={(event) => void onStatusChange(subtask, { status: event.target.checked ? "DONE" : "TODO" })}
              />
            )}
            <span className={styles.nestedSubtaskTitle}>{subtask.title}</span>
          </span>
          <select
            className={`${styles.taskStatus} ${styles.nestedSubtaskStatus}`}
            data-status={subtask.status}
            aria-label={`Статус підзадачі: ${subtask.title}`}
            value={subtask.status}
            disabled={disabled}
            onChange={(event) => selectStatus(subtask, event.currentTarget)}
          >
            {TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
          </select>
          <span className={styles.nestedSubtaskDuration}><span className={styles.visuallyHidden}>Орієнтовна тривалість: </span>{formatDuration(subtask.estimatedDurationMinutes)}</span>
          <button
            type="button"
            className={`${styles.secondaryButton} ${styles.subtaskEditButton}`}
            aria-label={`Редагувати підзадачу: ${subtask.title}`}
            // Keep the opener focusable after a saved PATCH with a failed GET.
            aria-disabled={disabled}
            onClick={(event) => { if (!disabled) setEditing({ subtask, opener: event.currentTarget }); }}
          >Редагувати</button>
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
