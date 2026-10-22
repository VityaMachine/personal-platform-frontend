"use client";

import { useEffect, useState } from "react";
import { deleteTask, getTasks, setTaskCompleted, type Task } from "@/lib/tasks";
import { CreateTaskForm } from "./_components/create-task-form";
import styles from "./page.module.css";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
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

  const completedCount = tasks.filter((task) => task.isCompleted).length;

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>ЩОДЕННІ СПРАВИ</p>
          <h1 className={styles.title}>Мої задачі</h1>
          <p className={styles.description}>Звільніть голову для важливого. Решту запишіть тут.</p>
        </header>

        <CreateTaskForm
          disabled={busy}
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
          }}
        />

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
          <div className={styles.listHeader}>
            <h2 id="tasks-heading" className={styles.sectionTitle}>Усі задачі</h2>
            <span className={styles.counter}>{completedCount} / {tasks.length} завершено</span>
          </div>
          {loading && <p role="status" className={styles.loading}>Завантаження задач…</p>}
          {!loading && !error && tasks.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">✓</span>
              <h3>Тут починається ваш план</h3>
              <p>Додайте першу задачу за допомогою форми вище.</p>
            </div>
          )}
          {tasks.length > 0 && (
            <ul className={styles.taskList}>
              {tasks.map((task) => (
                <li key={task.id} className={`${styles.task} ${task.isCompleted ? styles.completed : ""}`}>
                  <input className={styles.checkbox} type="checkbox" checked={task.isCompleted} disabled={busy} aria-label={`${task.isCompleted ? "Відкрити повторно" : "Завершити"}: ${task.title}`} onChange={() => void runAction(`toggle:${task.id}`, () => setTaskCompleted(task.id, !task.isCompleted), task.isCompleted ? "Задачу відкрито повторно." : "Задачу завершено.")} />
                  <div className={styles.taskContent}>
                    <h3 className={styles.taskTitle}>{task.title}</h3>
                    {task.description && <p className={styles.taskDescription}>{task.description}</p>}
                    <span className={styles.taskStatus}>{pending === `toggle:${task.id}` ? "Збереження…" : task.isCompleted ? "Завершено" : "До виконання"}</span>
                  </div>
                  <button className={styles.deleteButton} type="button" disabled={busy} aria-label={`Видалити: ${task.title}`} onClick={() => void runAction(`delete:${task.id}`, () => deleteTask(task.id), "Задачу видалено.")}>
                    {pending === `delete:${task.id}` ? "Видалення…" : "Видалити"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
