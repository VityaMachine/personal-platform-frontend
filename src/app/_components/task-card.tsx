import type { Task } from "@/lib/task-types";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/task-labels";
import styles from "../page.module.css";

type Props = {
  task: Task;
  disabled: boolean;
  toggling: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

function TaskDate({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return (
    <div>
      <dt>{label}</dt>
      <dd><time dateTime={value}>{date.toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" })}</time></dd>
    </div>
  );
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} хв`;
  return remainder === 0 ? `${hours} год` : `${hours} год ${remainder} хв`;
}

export function TaskCard({ task, disabled, toggling, deleting, onToggle, onDelete }: Props) {
  const completed = task.status === "DONE";
  const canceled = task.status === "CANCELED";
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.status === "DONE").length;

  return (
    <li className={`${styles.task} ${completed ? styles.completed : ""}`}>
      {!canceled && (
        <input
          className={styles.checkbox}
          type="checkbox"
          checked={completed}
          disabled={disabled}
          aria-label={`${completed ? "Відкрити повторно" : "Завершити"}: ${task.title}`}
          onChange={onToggle}
        />
      )}
      <div className={styles.taskContent}>
        <h3 className={styles.taskTitle}>{task.title}</h3>
        {task.description && <p className={styles.taskDescription}>{task.description}</p>}
        <span className={styles.taskStatus}>Статус: {TASK_STATUS_LABELS[task.status]}</span>
        {toggling && <span className={styles.taskStatus} role="status">Збереження…</span>}
        <dl className={styles.taskDetails}>
          <div>
            <dt>Пріоритет</dt>
            <dd>{TASK_PRIORITY_LABELS[task.priority]}</dd>
          </div>
          <TaskDate label="Дедлайн" value={task.dueAt} />
          <TaskDate label="Заплановано" value={task.plannedAt} />
          <div>
            <dt>Орієнтовна тривалість</dt>
            <dd>{formatDuration(task.estimatedDurationMinutes)}</dd>
          </div>
          {task.subtasks.length > 0 && (
            <div>
              <dt>Підзадачі</dt>
              <dd>{completedSubtasks} / {task.subtasks.length} завершено</dd>
            </div>
          )}
        </dl>
        {canceled && task.cancellationNote && (
          <p className={styles.taskDescription}>Причина скасування: {task.cancellationNote}</p>
        )}
      </div>
      <button className={styles.deleteButton} type="button" disabled={disabled} aria-label={`Видалити: ${task.title}`} onClick={onDelete}>
        {deleting ? "Видалення…" : "Видалити"}
      </button>
    </li>
  );
}
