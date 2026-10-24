"use client";

import { useEffect, useRef, useState } from "react";
import { getTasks, type Task } from "@/lib/tasks";
import { useTaskMutations } from "./_hooks/use-task-mutations";
import { CreateTaskModal } from "./_components/create-task-modal";
import { TaskCard } from "./_components/task-card";
import { TasksShell } from "./_components/tasks-shell";
import styles from "./page.module.css";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  // Keep disclosure state separate from refreshed DTOs and keyed by task ID.
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const busy = loading || pending !== null;
  const mutations = useTaskMutations(setTasks, busy, (id) => {
    setExpandedTaskIds((previous) => new Set(previous).add(id));
  });

  useEffect(() => {
    const controller = new AbortController();
    void getTasks(controller.signal)
      .then((nextTasks) => {
        if (!controller.signal.aborted) setTasks(nextTasks);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Не вдалося завантажити задачі.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      setTasks(await getTasks());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не вдалося завантажити задачі.");
    } finally {
      setLoading(false);
    }
  }

  const completedCount = tasks.filter((task) => task.status === "DONE").length;

  return (
    <TasksShell>
      <header className={styles.header}>
        <div>
          <h1 id="tasks-heading" className={styles.title}>Поточні задачі</h1>
          <p className={styles.counter}>{completedCount} / {tasks.length} завершено</p>
        </div>
        <button ref={createButtonRef} className={styles.primaryButton} type="button" disabled={busy} onClick={() => setCreating(true)}>+ Нова задача</button>
      </header>

      {creating && <CreateTaskModal
        returnFocusRef={createButtonRef}
        onClose={() => setCreating(false)}
        onSubmittingChange={(submitting) => {
          setPending(submitting ? "create" : null);
          if (submitting) {
            setNotice("");
            setError(null);
          }
        }}
        onCreated={(created) => {
          setTasks((previous) => [created, ...previous.filter((task) => task.id !== created.id)]);
          setError(null);
          setNotice("Задачу створено.");
          setCreating(false);
        }}
      />}

      <div className={styles.feedback}>
        <p role="status" className={styles.notice}>{notice}</p>
        {error && (
          <div role="alert" className={styles.error}>
            <p>{error}</p>
            <button type="button" className={styles.secondaryButton} disabled={busy || mutations.hasLockedTasks} onClick={() => void loadTasks()}>Оновити список</button>
          </div>
        )}
      </div>

      <section aria-labelledby="tasks-heading" aria-busy={loading}>
        {loading && <p role="status" className={styles.loading}>Завантаження задач…</p>}
        {!loading && !error && tasks.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">✓</span>
            <h3>Тут починається ваш план</h3>
            <p>Натисніть «+ Нова задача», щоб додати першу справу.</p>
          </div>
        )}
        {tasks.length > 0 && (
          <ul className={styles.taskList}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                disabled={busy || Boolean(mutations.states[task.id]?.pending || mutations.states[task.id]?.refreshRequired)}
                mutation={mutations.states[task.id]}
                retryDisabled={busy}
                onRetryRefresh={() => void mutations.retryRefresh(task.id)}
                onSubtaskStatusChange={(subtask, change) => mutations.changeSubtaskStatus(task.id, subtask, change)}
                onEditSubtask={(id, change) => mutations.editSubtask(task.id, id, change)}
                onDeleteSubtask={(id) => mutations.deleteSubtask(task.id, id)}
                onCreateSubtask={(input) => mutations.createSubtask(task.id, input)}
                expanded={expandedTaskIds.has(task.id)}
                onToggleSubtasks={() => setExpandedTaskIds((previous) => {
                  const next = new Set(previous);
                  if (next.has(task.id)) next.delete(task.id);
                  else next.add(task.id);
                  return next;
                })}
                onToggle={() => void mutations.toggleTask(task)}
                onDelete={() => void mutations.deleteTask(task.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </TasksShell>
  );
}
