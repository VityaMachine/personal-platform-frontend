import type { Subtask } from "@/lib/task-types";
import { TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatDuration } from "@/lib/format-duration";
import styles from "../page.module.css";

type Props = {
  subtasks: Subtask[];
  taskTitle: string;
};

export function TaskSubtaskList({ subtasks, taskTitle }: Props) {
  return (
    <div className={styles.nestedSubtaskContainer}>
      <ul className={styles.nestedSubtaskList} aria-label={`Підзадачі задачі «${taskTitle}»`}>
      {subtasks.map((subtask) => (
        <li key={subtask.id} className={styles.nestedSubtask} data-status={subtask.status}>
          <span className={styles.nestedSubtaskTitle}>
            {subtask.status === "DONE" && <span aria-hidden="true">✓ </span>}
            {subtask.title}
          </span>
          <span className={`${styles.taskStatus} ${styles.nestedSubtaskStatus}`} data-status={subtask.status}>Статус: {TASK_STATUS_LABELS[subtask.status]}</span>
          <span className={styles.nestedSubtaskDuration}><span className={styles.visuallyHidden}>Орієнтовна тривалість: </span>{formatDuration(subtask.estimatedDurationMinutes)}</span>
        </li>
      ))}
      </ul>
    </div>
  );
}
