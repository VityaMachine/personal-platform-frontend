import type { Task } from "@/lib/task-types";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatDuration } from "@/lib/format-duration";
import { TaskSubtaskList } from "./task-subtask-list";
import styles from "../page.module.css";

type Props = {
  task: Task;
  disabled: boolean;
  toggling: boolean;
  deleting: boolean;
  expanded: boolean;
  onToggleSubtasks: () => void;
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

export function TaskCard({ task, disabled, toggling, deleting, expanded, onToggleSubtasks, onToggle, onDelete }: Props) {
  const completed = task.status === "DONE";
  const canceled = task.status === "CANCELED";
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.status === "DONE").length;
  const subtasksId = `task-${task.id}-subtasks`;

  return (
    <li className={`${styles.task} ${completed ? styles.completed : ""}`}>
      {!canceled ? (
        <input
          className={styles.checkbox}
          type="checkbox"
          checked={completed}
          disabled={disabled}
          aria-label={`${completed ? "Відкрити повторно" : "Завершити"}: ${task.title}`}
          onChange={onToggle}
        />
      ) : <span className={styles.checkboxSpace} aria-hidden="true" />}
      <div className={styles.taskContent}>
        <h3 className={styles.taskTitle}>{task.title}</h3>
        {task.description && <p className={styles.taskDescription}>{task.description}</p>}
        <div className={styles.taskBadges}>
          <span className={styles.taskStatus} data-status={task.status}>Статус: {TASK_STATUS_LABELS[task.status]}</span>
          <span className={styles.taskPriority} data-priority={task.priority}>Пріоритет: {TASK_PRIORITY_LABELS[task.priority]}</span>
        </div>
        {toggling && <span className={styles.taskStatus} role="status">Збереження…</span>}
        <dl className={styles.taskDetails}>
          <TaskDate label="Дедлайн" value={task.dueAt} />
          <TaskDate label="Заплановано" value={task.plannedAt} />
          <div>
            <dt>Орієнтовна тривалість</dt>
            <dd>{formatDuration(task.estimatedDurationMinutes)}</dd>
          </div>
        </dl>
        {canceled && task.cancellationNote && (
          <p className={styles.cancellationNote}>Причина скасування: {task.cancellationNote}</p>
        )}
        {task.subtasks.length > 0 && (
          <>
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.subtaskDisclosure}`}
              aria-expanded={expanded}
              aria-controls={subtasksId}
              aria-label={`${expanded ? "Згорнути" : "Розгорнути"} підзадачі задачі «${task.title}»: завершено ${completedSubtasks} із ${task.subtasks.length}`}
              onClick={onToggleSubtasks}
            >
              <svg className={styles.disclosureArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="m9 5 7 7-7 7" />
              </svg>
              Підзадачі {completedSubtasks}/{task.subtasks.length}
            </button>
            <div id={subtasksId} hidden={!expanded}>
              <TaskSubtaskList subtasks={task.subtasks} taskTitle={task.title} />
            </div>
          </>
        )}
      </div>
      <button className={styles.deleteButton} type="button" disabled={disabled} aria-label={`Видалити: ${task.title}`} onClick={onDelete}>
        {deleting ? "Видалення…" : "Видалити"}
      </button>
    </li>
  );
}
