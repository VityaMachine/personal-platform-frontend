"use client";

import taskStyles from "./tasks.module.css";
import { RoutineOccurrence } from "./routine-occurrence";

import type { Task } from "@/modules/tasks/model/task-types";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/modules/tasks/model/task-labels";
import { useSettings } from "../../settings/preferences";
import { formatDate } from "@/shared/dates/format-date";
import { formatDuration } from "@/shared/lib/format-duration";
import { TaskTimeSummary } from "./task-time-summary";
import styles from "./task-details.module.css";

function DateValue({ value, empty }: { value: string | null; empty?: string }) {
  const { settings: { timeZone } } = useSettings();
  return value ? <time dateTime={value}>{formatDate(value, timeZone)}</time> : <>{empty ?? "Не вказано"}</>;
}

export function TaskDetailsContent({ task }: { task: Task }) {
  const subtasks = task.subtasks.filter((subtask) => subtask.deletedAt === null);
  const completed = subtasks.filter((subtask) => subtask.status === "DONE").length;
  return <div className={styles.columns}>
    <div className={styles.mainContent}>
      <section aria-label="Опис задачі">
        <h3>Опис</h3>
        <p className={styles.fullText}>{task.description || "Опис не додано."}</p>
        {task.cancellationNote && <p className={styles.fullText}><strong>Причина скасування: </strong>{task.cancellationNote}</p>}
        {task.skipNote?.trim() && <p className={styles.fullText}><strong>Причина пропуску: </strong>{task.skipNote}</p>}
      </section>
      <TaskTimeSummary task={task} />
      <section aria-label="Підзадачі">
        <h3>Підзадачі</h3>
        <p>Завершено {completed} із {subtasks.length}</p>
        {subtasks.length > 0 ? <>
          <progress className={styles.progress} max={subtasks.length} value={completed} aria-label="Прогрес виконання підзадач" />
          <ul className={styles.subtasks}>
            {subtasks.map((subtask) => <li key={subtask.id}>
              <h4>{subtask.title}</h4>
              <p><span className={taskStyles.taskStatus} data-status={subtask.status}>{TASK_STATUS_LABELS[subtask.status]}</span> · {formatDuration(subtask.estimatedDurationMinutes)}</p>
              {subtask.cancellationNote && <p className={styles.fullText}>Причина скасування: {subtask.cancellationNote}</p>}
            </li>)}
          </ul>
        </> : <p>У цієї задачі ще немає підзадач.</p>}
      </section>
    </div>
    <aside className={styles.metadata} aria-label="Метадані задачі">
      <h3>Про задачу</h3>
      <RoutineOccurrence task={task} />
      <dl>
        <div><dt>Сфера</dt><dd>{task.area?.name ?? "Без сфери"}</dd></div>
        <div><dt>Статус</dt><dd><span className={taskStyles.taskStatus} data-status={task.status}>{TASK_STATUS_LABELS[task.status]}</span></dd></div>
        <div><dt>Пріоритет</dt><dd><span className={taskStyles.taskPriority} data-priority={task.priority}>{TASK_PRIORITY_LABELS[task.priority]}</span></dd></div>
        <div><dt>Заплановано</dt><dd><DateValue value={task.plannedAt} empty="Не заплановано" /></dd></div>
        <div><dt>Дедлайн</dt><dd><DateValue value={task.dueAt} empty="Не встановлено" /></dd></div>
        <div><dt>Орієнтовна тривалість</dt><dd>{formatDuration(task.estimatedDurationMinutes)}</dd></div>
        <div><dt>Створено</dt><dd><DateValue value={task.createdAt} /></dd></div>
        <div><dt>Оновлено</dt><dd><DateValue value={task.updatedAt} /></dd></div>
        {task.completedAt && <div><dt>Завершено</dt><dd><DateValue value={task.completedAt} /></dd></div>}
        {task.skippedAt && <div><dt>Пропущено</dt><dd><DateValue value={task.skippedAt} /></dd></div>}
        {task.archivedAt && <div><dt>Архівовано</dt><dd><DateValue value={task.archivedAt} /></dd></div>}
      </dl>
    </aside>
  </div>;
}
