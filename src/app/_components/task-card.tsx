"use client";
import { RoutineOccurrence } from "./routine-occurrence";

import { useRef, useState } from "react";
import { TASK_STATUSES, type InitialSubtaskInput, type Subtask, type SubtaskDetailsChange, type SubtaskStatusChange, type Task, type TaskDetailsChange, type TaskStatusChange } from "@/lib/task-types";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/task-labels";
import { formatDuration } from "@/lib/format-duration";
import { useSettings } from "../_hooks/use-settings";
import { formatDate } from "@/lib/format-date";
import { TaskDetailsModal } from "./task-details-modal";
import { TaskTimeMetrics } from "./task-time-summary";
import { TaskSubtaskList } from "./task-subtask-list";
import { DeleteSubtaskDialog } from "./delete-subtask-dialog";
import { CreateSubtaskDialog } from "./create-subtask-dialog";
import { EditTaskModal } from "./edit-task-modal";
import { TaskStatusDialog } from "./task-status-dialog";
import { SkipTaskDialog } from "./skip-task-dialog";
import type { TaskMutationState } from "../_hooks/use-task-mutations";
import styles from "../page.module.css";

type Props = {
  task: Task;
  disabled: boolean;
  mutation?: TaskMutationState;
  retryDisabled: boolean;
  onRetryRefresh: () => void;
  onSubtaskStatusChange: (subtask: Subtask, change: SubtaskStatusChange) => Promise<boolean>;
  onEditSubtask: (id: string, change: SubtaskDetailsChange) => Promise<boolean>;
  onDeleteSubtask: (id: string) => Promise<boolean>;
  onCreateSubtask: (input: InitialSubtaskInput) => Promise<boolean>;
  onBeginEdit: () => boolean;
  onEndEdit: () => void;
  onEdit: (input: TaskDetailsChange) => Promise<boolean>;
  onBeginStatusDialog: () => boolean;
  onEndStatusDialog: () => void;
  onStatusChange: (change: TaskStatusChange) => Promise<boolean>;
  expanded: boolean;
  onToggleSubtasks: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
};

function TaskDate({ label, value }: { label: string; value: string | null }) {
  const { settings: { timeZone } } = useSettings();
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return (
    <div>
      <dt>{label}</dt>
      <dd><time dateTime={value}>{formatDate(value, timeZone)}</time></dd>
    </div>
  );
}

export function TaskCard({ task, disabled, mutation, retryDisabled, onRetryRefresh, onSubtaskStatusChange, onEditSubtask, onDeleteSubtask, onCreateSubtask, onBeginEdit, onEndEdit, onEdit, onBeginStatusDialog, onEndStatusDialog, onStatusChange, expanded, onToggleSubtasks, onToggle, onDelete, onArchive }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [detailsOpener, setDetailsOpener] = useState<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState<{ subtask: Subtask; opener: HTMLButtonElement } | null>(null);
  const [createOpener, setCreateOpener] = useState<HTMLButtonElement | null>(null);
  const [editing, setEditing] = useState<{ task: Task; opener: HTMLButtonElement } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ task: Task; status: "CANCELED" | "POSTPONED"; opener: HTMLSelectElement } | null>(null);
  const [skipDialog, setSkipDialog] = useState<{ task: Task; opener: HTMLButtonElement | HTMLSelectElement } | null>(null);
  const completed = task.status === "DONE";
  const archived = task.archivedAt !== null;
  const canceled = task.status === "CANCELED";
  const skipped = task.status === "SKIPPED";
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.status === "DONE").length;
  const subtasksId = `task-${task.id}-subtasks`;

  function selectStatus(select: HTMLSelectElement) {
    const status = TASK_STATUSES.find((value) => value === select.value);
    // A selection opens a draft; the task keeps its saved status until PATCH succeeds.
    select.value = task.status;
    if (disabled || !status || status === task.status) return;
    if (status === "SKIPPED") {
      if (task.routineOccurrence && onBeginStatusDialog()) setSkipDialog({ task, opener: select });
    } else if (status === "CANCELED" || status === "POSTPONED") {
      if (onBeginStatusDialog()) setStatusDialog({ task, status, opener: select });
    } else void onStatusChange({ status });
  }
  const addSubtaskButton = !archived && (
    <button
      type="button"
      className={styles.addSubtaskButton}
      disabled={disabled}
      aria-label={`Додати підзадачу до задачі «${task.title}»`}
      onClick={(event) => { if (!disabled) setCreateOpener(event.currentTarget); }}
    >+ Додати підзадачу</button>
  );

  return (
    <li className={`${styles.task} ${completed ? styles.completed : ""}`} data-task-id={task.id} data-has-subtasks={task.subtasks.length > 0} aria-busy={Boolean(mutation?.pending)}>
      <div className={styles.taskHeader}>
        {task.subtasks.length > 0 && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.subtaskDisclosure}`}
            aria-expanded={expanded}
            aria-controls={subtasksId}
            aria-label={`${expanded ? "Згорнути" : "Розгорнути"} підзадачі задачі «${task.title}»: завершено ${completedSubtasks} із ${task.subtasks.length}`}
            onClick={onToggleSubtasks}
          >
            <svg className={styles.disclosureArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        )}
        {!canceled && !skipped ? (
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
          <div className={styles.taskTitleRow}>
            <h3 ref={titleRef} tabIndex={-1} className={styles.taskTitle}>{task.title}</h3>
            {task.subtasks.length > 0 && <span className={styles.subtaskProgress} aria-label={`Завершено підзадач: ${completedSubtasks} із ${task.subtasks.length}`}>{completedSubtasks}/{task.subtasks.length}</span>}
          </div>
          {task.description && <p className={styles.taskDescription}>{task.description}</p>}
          <RoutineOccurrence task={task} />
          <div className={styles.taskMetadata}>
            {task.area && <span className={styles.taskPriority}>Сфера: {task.area.name}</span>}
            <select
              className={`${styles.taskStatus} ${styles.taskStatusSelect}`}
              data-status={task.status}
              value={task.status}
              aria-label={`Статус задачі: ${task.title}`}
              aria-disabled={disabled}
              onChange={(event) => selectStatus(event.currentTarget)}
            >
              {TASK_STATUSES.filter((status) => status !== "SKIPPED" || task.routineOccurrence).map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
            </select>
            <span className={styles.taskPriority} data-priority={task.priority}>Пріоритет: {TASK_PRIORITY_LABELS[task.priority]}</span>
            <dl className={styles.taskDetails}>
              <TaskDate label="Дедлайн" value={task.dueAt} />
              <TaskDate label="Заплановано" value={task.plannedAt} />
              <div>
                <dt>Орієнтовна тривалість</dt>
                <dd>{formatDuration(task.estimatedDurationMinutes)}</dd>
              </div>
            </dl>
          </div>
          {mutation?.pending && <span className={styles.taskStatus} role="status">{mutation.pending === "refresh" ? "Оновлення даних…" : "Збереження…"}</span>}
          {mutation?.notice && <p className={styles.notice} role="status">{mutation.notice}</p>}
          {mutation?.error && (
            <div role="alert" className={styles.error}>
              <p>{mutation.error}</p>
              {mutation.refreshRequired && <button type="button" className={styles.secondaryButton} disabled={retryDisabled || Boolean(mutation.pending)} onClick={onRetryRefresh}>Повторити завантаження</button>}
            </div>
          )}
          <TaskTimeMetrics summary={task.summary} />
          {canceled && task.cancellationNote && (
            <p className={styles.cancellationNote}>Причина скасування: {task.cancellationNote}</p>
          )}
          {task.subtasks.length === 0 && addSubtaskButton}
        </div>
        <div className={styles.taskActions}>
          {!archived && task.routineOccurrence && !skipped && <button className={styles.secondaryButton} type="button" aria-disabled={disabled}
            onClick={(event) => { if (!disabled && onBeginStatusDialog()) setSkipDialog({ task, opener: event.currentTarget }); }}>Пропустити</button>}
          <button className={styles.secondaryButton} type="button" disabled={disabled} onClick={(event) => {
            if (!disabled && !document.querySelector("dialog[open]")) setDetailsOpener(event.currentTarget);
          }}>Деталі</button>
          <button className={styles.secondaryButton} type="button" disabled={disabled} onClick={onArchive}>
            {mutation?.pending === "archive" ? "Збереження…" : archived ? "Повернути з архіву" : "Архівувати"}
          </button>
          <button
            className={styles.iconButton}
            type="button"
            // Keep the opener focusable while the edit reservation is released.
            aria-disabled={disabled}
            aria-label={`Редагувати задачу: ${task.title}`}
            onClick={(event) => { if (!disabled && onBeginEdit()) setEditing({ task, opener: event.currentTarget }); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="m16 3 5 5L8 21H3v-5L16 3Z M13 6l5 5" />
            </svg>
          </button>
          <button className={styles.deleteButton} type="button" disabled={disabled} aria-label={`Видалити: ${task.title}`} onClick={onDelete}>
            {mutation?.pending === "delete" ? "Видалення…" : "Видалити"}
          </button>
        </div>
      </div>
      {task.subtasks.length > 0 && (
        <div id={subtasksId} className={styles.subtaskGroup} hidden={!expanded}>
          <TaskSubtaskList readOnly={archived} subtasks={task.subtasks} taskTitle={task.title} disabled={disabled} onStatusChange={onSubtaskStatusChange} onEdit={onEditSubtask} onRequestDelete={(subtask, opener) => setDeleting({ subtask, opener })} />
          {addSubtaskButton}
        </div>
      )}
      {deleting && <DeleteSubtaskDialog
        subtaskTitle={deleting.subtask.title}
        opener={deleting.opener}
        successFocusRef={titleRef}
        disabled={disabled}
        onConfirm={() => onDeleteSubtask(deleting.subtask.id)}
        onClose={() => setDeleting(null)}
      />}
      {detailsOpener && <TaskDetailsModal taskId={task.id} opener={detailsOpener} onClose={() => setDetailsOpener(null)} />}
      {createOpener && <CreateSubtaskDialog
        taskTitle={task.title}
        opener={createOpener}
        fallbackFocusRef={titleRef}
        disabled={disabled}
        onSave={onCreateSubtask}
        onClose={() => setCreateOpener(null)}
      />}
      {editing && <EditTaskModal
        task={editing.task}
        opener={editing.opener}
        disabled={retryDisabled || Boolean(mutation?.pending || mutation?.refreshRequired)}
        onSave={onEdit}
        onClose={() => { onEndEdit(); setEditing(null); }}
      />}
      {statusDialog && <TaskStatusDialog
        task={statusDialog.task}
        status={statusDialog.status}
        opener={statusDialog.opener}
        disabled={retryDisabled || Boolean(mutation?.pending || mutation?.refreshRequired)}
        onConfirm={onStatusChange}
        onClose={() => { onEndStatusDialog(); setStatusDialog(null); }}
      />}
      {skipDialog && <SkipTaskDialog taskTitle={skipDialog.task.title} opener={skipDialog.opener}
        disabled={retryDisabled || Boolean(mutation?.pending || mutation?.refreshRequired)}
        onConfirm={onStatusChange} onClose={() => { onEndStatusDialog(); setSkipDialog(null); }} />}
    </li>
  );
}
