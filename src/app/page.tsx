"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTaskList } from "./_hooks/use-task-list";
import { useOpenDialog } from "./_hooks/use-open-dialog";
import { useTaskMutations } from "./_hooks/use-task-mutations";
import { CreateTaskModal } from "./_components/create-task-modal";
import { TaskCard } from "./_components/task-card";
import { TasksShell } from "./_components/tasks-shell";
import styles from "./page.module.css";

export default function Home() {
  return <Suspense fallback={<p role="status" className={styles.loading}>Завантаження задач…</p>}><TasksPage /></Suspense>;
}

function TasksPage() {
  const searchParams = useSearchParams();
  const requestedArchived = searchParams.get("archived") === "true";
  const [archived, setArchived] = useState(requestedArchived);
  const { tasks, setTasks, loading, error: loadError, reload } = useTaskList(archived);
  const dialogOpen = useOpenDialog();
  // Keep disclosure state separate from refreshed DTOs and keyed by task ID.
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const busy = loading || pending !== null;
  const mutations = useTaskMutations(setTasks, busy, (id) => {
    setExpandedTaskIds((previous) => new Set(previous).add(id));
  });

  // History can change behind a modal. Preserve its draft and parent locks
  // until the form closes and pending mutations finish.
  const navigationDeferred = requestedArchived !== archived;
  if (navigationDeferred && !creating && !dialogOpen && pending === null && !mutations.hasLockedTasks) {
    setArchived(requestedArchived);
    setNotice("");
  }

  const completedCount = tasks.filter((task) => task.status === "DONE").length;

  return (
    <TasksShell archived={archived}>
      <header className={styles.header}>
        <div>
          <h1 id="tasks-heading" className={styles.title}>{archived ? "Архів" : "Поточні задачі"}</h1>
          <p className={styles.counter}>{completedCount} / {tasks.length} завершено</p>
        </div>
        {!archived && <button ref={createButtonRef} className={styles.primaryButton} type="button" disabled={busy} onClick={() => setCreating(true)}>+ Нова задача</button>}
      </header>

      {creating && <CreateTaskModal
        returnFocusRef={createButtonRef}
        onClose={() => setCreating(false)}
        onSubmittingChange={(submitting) => {
          setPending(submitting ? "create" : null);
          if (submitting) {
            setNotice("");
          }
        }}
        onCreated={(created) => {
          setTasks((previous) => [created, ...previous.filter((task) => task.id !== created.id)]);
          setNotice("Задачу створено.");
          setCreating(false);
        }}
      />}

      <div className={styles.feedback}>
        <p role="status" className={styles.notice}>{notice}</p>
        {navigationDeferred && <p role="status" className={styles.notice}>Перехід між розділами відбудеться після закриття форми та завершення поточних змін.</p>}
        {loadError && (
          <div role="alert" className={styles.error}>
            <p>{loadError}</p>
            <button type="button" className={styles.secondaryButton} disabled={busy || mutations.hasLockedTasks} onClick={reload}>Оновити список</button>
          </div>
        )}
      </div>

      <section aria-labelledby="tasks-heading" aria-busy={loading}>
        {loading && <p role="status" className={styles.loading}>Завантаження задач…</p>}
        {!loading && !loadError && tasks.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">✓</span>
            <h3>{archived ? "Архів порожній" : "Тут починається ваш план"}</h3>
            <p>{archived ? "Архівовані задачі з’являться тут. Їх можна повернути до поточних задач." : "Натисніть «+ Нова задача», щоб додати першу справу."}</p>
          </div>
        )}
        {tasks.length > 0 && (
          <ul className={styles.taskList}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                disabled={busy || Boolean(mutations.states[task.id]?.pending || mutations.states[task.id]?.refreshRequired || mutations.states[task.id]?.editing || mutations.states[task.id]?.statusDialog)}
                mutation={mutations.states[task.id]}
                retryDisabled={busy}
                onRetryRefresh={() => void mutations.retryRefresh(task.id)}
                onSubtaskStatusChange={(subtask, change) => mutations.changeSubtaskStatus(task.id, subtask, change)}
                onEditSubtask={(id, change) => mutations.editSubtask(task.id, id, change)}
                onDeleteSubtask={(id) => mutations.deleteSubtask(task.id, id)}
                onCreateSubtask={(input) => mutations.createSubtask(task.id, input)}
                onBeginEdit={() => mutations.beginTaskEdit(task.id)}
                onEndEdit={() => mutations.endTaskEdit(task.id)}
                onEdit={(input) => mutations.editTask(task.id, input)}
                onBeginStatusDialog={() => mutations.beginTaskStatusDialog(task.id)}
                onEndStatusDialog={() => mutations.endTaskStatusDialog(task.id)}
                onStatusChange={(change) => mutations.changeTaskStatus(task, change)}
                expanded={expandedTaskIds.has(task.id)}
                onToggleSubtasks={() => setExpandedTaskIds((previous) => {
                  const next = new Set(previous);
                  if (next.has(task.id)) next.delete(task.id);
                  else next.add(task.id);
                  return next;
                })}
                onToggle={() => void mutations.toggleTask(task)}
                onDelete={() => void mutations.deleteTask(task.id)}
                onArchive={() => {
                  setNotice("");
                  void mutations.changeArchived(task).then((changed) => {
                    if (changed) setNotice(task.archivedAt ? "Задачу повернуто з архіву." : "Задачу архівовано.");
                  });
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </TasksShell>
  );
}
