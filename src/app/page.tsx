"use client";

import { useEffect, useRef, useState } from "react";
import { deleteTask, getTasks, setTaskCompleted, type Task } from "@/lib/tasks";
import { CreateTaskModal } from "./_components/create-task-modal";
import { TaskCard } from "./_components/task-card";
import { TasksShell } from "./_components/tasks-shell";
import styles from "./page.module.css";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const busy = loading || pending !== null;

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

  async function runAction(key: string, action: () => Promise<void>, message: string) {
    if (busy) return;
    setPending(key);
    setError(null);
    setNotice("");
    try {
      await action();
      setNotice(message);
      await loadTasks();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не вдалося виконати дію. Спробуйте ще раз.");
    } finally {
      setPending(null);
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
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void loadTasks()}>Оновити список</button>
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
                disabled={busy}
                toggling={pending === `toggle:${task.id}`}
                deleting={pending === `delete:${task.id}`}
                onToggle={() => void runAction(`toggle:${task.id}`, () => setTaskCompleted(task.id, task.status !== "DONE"), task.status === "DONE" ? "Задачу відкрито повторно." : "Задачу завершено.")}
                onDelete={() => void runAction(`delete:${task.id}`, () => deleteTask(task.id), "Задачу видалено.")}
              />
            ))}
          </ul>
        )}
      </section>
    </TasksShell>
  );
}
