"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createTask, deleteTask, getTasks, setTaskCompleted, type Task } from "@/lib/tasks";
import styles from "./page.module.css";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    void runAction("create", async () => {
      await createTask({ title: trimmedTitle, ...(description.trim() ? { description: description.trim() } : {}) });
      setTitle("");
      setDescription("");
    }, "Задачу створено.");
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

        <section className={styles.panel} aria-labelledby="create-heading">
          <h2 id="create-heading" className={styles.sectionTitle}>Нова задача</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.field}>
              Назва <span className={styles.required}>(обов’язково)</span>
              <input name="title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Що потрібно зробити?" disabled={pending === "create"} />
            </label>
            <label className={styles.field}>
              Опис <span className={styles.required}>(необов’язково)</span>
              <textarea name="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Деталі, які допоможуть почати" disabled={pending === "create"} />
            </label>
            <button className={styles.primaryButton} type="submit" disabled={busy || !title.trim()}>
              {pending === "create" ? "Створення…" : "+ Додати задачу"}
            </button>
          </form>
        </section>

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
