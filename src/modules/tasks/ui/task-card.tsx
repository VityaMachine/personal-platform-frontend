"use client";

import uiStyles from "../../../shared/ui/controls.module.css";
import taskStyles from "./tasks.module.css";
import { RoutineOccurrence } from "./routine-occurrence";

import { useRef, useState, type RefObject } from "react";
import { TASK_STATUSES, type InitialSubtaskInput, type Subtask, type SubtaskDetailsChange, type SubtaskStatusChange, type Task, type TaskDetailsChange, type TaskStatusChange } from "@/modules/tasks/model/task-types";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/modules/tasks/model/task-labels";
import { formatDuration } from "@/shared/lib/format-duration";
import { useSettings } from "../../settings/preferences";
import { formatDate } from "@/shared/dates/format-date";
import { TaskDetailsModal } from "./task-details-modal";
import { TaskTimeMetrics } from "./task-time-summary";
import { TaskSubtaskList } from "./task-subtask-list";
import { DeleteSubtaskDialog } from "./delete-subtask-dialog";
import { CreateSubtaskDialog } from "./create-subtask-dialog";
import { EditTaskModal } from "./edit-task-modal";
import { TaskStatusDialog } from "./task-status-dialog";
import { SkipTaskDialog } from "./skip-task-dialog";
import type { TaskMutationState } from "../hooks/use-task-mutations";
import type { TaskRemovalOutcome, TaskRemovalCheckOutcome } from "../model/task-removal";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { TaskAction } from "./task-action";

type Props = {
  layout?: "today";
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
  onBeginDelete: () => boolean;
  onEndDelete: () => void;
  onDelete: () => Promise<TaskRemovalOutcome | null>;
  onCheckDeletion: () => Promise<TaskRemovalCheckOutcome | null>;
  listFocusRef: RefObject<HTMLElement | null>;
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

export function TaskCard({ layout, task, disabled, mutation, retryDisabled, onRetryRefresh, onSubtaskStatusChange, onEditSubtask, onDeleteSubtask, onCreateSubtask, onBeginEdit, onEndEdit, onEdit, onBeginStatusDialog, onEndStatusDialog, onStatusChange, expanded, onToggleSubtasks, onToggle, onBeginDelete, onEndDelete, onDelete, onCheckDeletion, listFocusRef, onArchive }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [detailsOpener, setDetailsOpener] = useState<HTMLButtonElement | null>(null);
  const [deleteOpener, setDeleteOpener] = useState<{ title: string; opener: HTMLButtonElement } | null>(null);
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
      className={uiStyles.addSubtaskButton}
      disabled={disabled}
      aria-label={`Додати підзадачу до задачі «${task.title}»`}
      onClick={(event) => { if (!disabled) setCreateOpener(event.currentTarget); }}
    >+ Додати підзадачу</button>
  );

  return (
    <li className={`${taskStyles.task} ${completed ? taskStyles.completed : ""} ${layout === "today" ? taskStyles.todayCard : ""}`} data-task-id={task.id} data-has-subtasks={task.subtasks.length > 0} aria-busy={Boolean(mutation?.pending)}>
      <div className={taskStyles.taskHeader}>
        {task.subtasks.length > 0 && (
          <button
            type="button"
            className={`${taskStyles.iconButton} ${taskStyles.subtaskDisclosure}`}
            aria-expanded={expanded}
            aria-controls={subtasksId}
            aria-label={`${expanded ? "Згорнути" : "Розгорнути"} підзадачі задачі «${task.title}»: завершено ${completedSubtasks} із ${task.subtasks.length}`}
            onClick={onToggleSubtasks}
          >
            <svg className={taskStyles.disclosureArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        )}
        {!canceled && !skipped ? (
          <input
            className={taskStyles.checkbox}
            type="checkbox"
            checked={completed}
            disabled={disabled}
            aria-label={`${completed ? "Відкрити повторно" : "Завершити"}: ${task.title}`}
            onChange={onToggle}
          />
        ) : <span className={taskStyles.checkboxSpace} aria-hidden="true" />}
        <div className={taskStyles.taskContent}>
          <div className={taskStyles.taskTitleRow}>
            <h3 ref={titleRef} tabIndex={-1} className={taskStyles.taskTitle}>{task.title}</h3>
            {task.subtasks.length > 0 && <span className={taskStyles.subtaskProgress} aria-label={`Завершено підзадач: ${completedSubtasks} із ${task.subtasks.length}`}>{completedSubtasks}/{task.subtasks.length}</span>}
          </div>
          {task.description && <p className={taskStyles.taskDescription}>{task.description}</p>}
          <RoutineOccurrence task={task} />
          <div className={taskStyles.taskMetadata}>
            {task.area && <span className={taskStyles.taskPriority}>Сфера: {task.area.name}</span>}
            <select
              className={`${taskStyles.taskStatus} ${taskStyles.taskStatusSelect}`}
              data-status={task.status}
              value={task.status}
              aria-label={`Статус задачі: ${task.title}`}
              aria-disabled={disabled}
              onChange={(event) => selectStatus(event.currentTarget)}
            >
              {TASK_STATUSES.filter((status) => status !== "SKIPPED" || task.routineOccurrence).map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
            </select>
            <span className={taskStyles.taskPriority} data-priority={task.priority}>Пріоритет: {TASK_PRIORITY_LABELS[task.priority]}</span>
            <dl className={taskStyles.taskDetails}>
              <TaskDate label="Дедлайн" value={task.dueAt} />
              <TaskDate label="Заплановано" value={task.plannedAt} />
              <div>
                <dt>Орієнтовна тривалість</dt>
                <dd>{formatDuration(task.estimatedDurationMinutes)}</dd>
              </div>
            </dl>
          </div>
          {mutation?.pending && <span className={taskStyles.taskStatus} role="status">{mutation.pending === "refresh" ? "Оновлення даних…" : "Збереження…"}</span>}
          {mutation?.notice && <p className={uiStyles.notice} role="status">{mutation.notice}</p>}
          {mutation?.error && (
            <div role="alert" className={uiStyles.error}>
              <p>{mutation.error}</p>
              {mutation.refreshRequired && <button type="button" className={uiStyles.secondaryButton} disabled={retryDisabled || Boolean(mutation.pending)} onClick={onRetryRefresh}>Повторити завантаження</button>}
            </div>
          )}
          {layout === "today" ? <details className={taskStyles.todayTime}><summary>Показники часу</summary><TaskTimeMetrics summary={task.summary} /></details> : <TaskTimeMetrics summary={task.summary} />}
          {canceled && task.cancellationNote && (
            <p className={taskStyles.cancellationNote}>Причина скасування: {task.cancellationNote}</p>
          )}
          {layout !== "today" && task.subtasks.length === 0 && addSubtaskButton}
        </div>
        <div className={taskStyles.taskActions}>
          {layout === "today" && task.subtasks.length === 0 && addSubtaskButton}
          {!archived && task.routineOccurrence && !skipped && <TaskAction icon="skip" label="Пропустити" compact={layout === "today"}
            accessibleLabel={`Пропустити виконання задачі: ${task.title}`} ariaDisabled={disabled}
            onClick={(event) => { if (!disabled && onBeginStatusDialog()) setSkipDialog({ task, opener: event.currentTarget }); }} />}
          <TaskAction icon="details" label="Деталі" compact={layout === "today"} accessibleLabel={`Деталі задачі: ${task.title}`} disabled={disabled} onClick={(event) => {
            if (!disabled && !document.querySelector("dialog[open]")) setDetailsOpener(event.currentTarget);
          }} />
          <TaskAction icon={archived ? "restore" : "archive"} compact={layout === "today"} disabled={disabled} onClick={onArchive}
            accessibleLabel={`${archived ? "Повернути з архіву" : "Архівувати"}: ${task.title}`}
            label={mutation?.pending === "archive" ? "Збереження…" : archived ? "Повернути з архіву" : "Архівувати"} />
          <TaskAction icon="edit" label="Редагувати" compact={layout === "today"}
            // Keep the opener focusable while the edit reservation is released.
            ariaDisabled={disabled}
            accessibleLabel={`Редагувати задачу: ${task.title}`}
            onClick={(event) => { if (!disabled && onBeginEdit()) setEditing({ task, opener: event.currentTarget }); }}
          />
          <TaskAction icon="delete" compact={layout === "today"} disabled={disabled} accessibleLabel={`Видалити: ${task.title}`}
            label={mutation?.pending === "delete" ? "Видалення…" : "Видалити"}
            onClick={(event) => {
              if (!disabled && !document.querySelector("dialog[open]") && onBeginDelete()) setDeleteOpener({ title: task.title, opener: event.currentTarget });
            }} />
        </div>
      </div>
      {task.subtasks.length > 0 && (
        <div id={subtasksId} className={taskStyles.subtaskGroup} hidden={!expanded}>
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
      {deleteOpener && <DeleteTaskDialog title={deleteOpener.title} opener={deleteOpener.opener} fallbackFocusRef={listFocusRef}
        disabled={retryDisabled || Boolean(mutation?.pending || mutation?.refreshRequired)} initialUncertain={mutation?.deleteUncertain}
        onConfirm={onDelete} onCheck={onCheckDeletion} onClose={() => { onEndDelete(); setDeleteOpener(null); }} />}
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
