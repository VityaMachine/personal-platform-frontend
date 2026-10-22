"use client";

import { useRef, useState, type FormEvent } from "react";
import { createTask, type Task } from "@/lib/tasks";
import { TASK_PRIORITIES } from "@/lib/task-types";
import { EMPTY_TASK_FIELDS, parseCreateTaskFields, type CreateTaskErrors, type CreateTaskFields } from "@/lib/create-task-input";
import styles from "../page.module.css";

const priorityLabels = { LOW: "Низький", MEDIUM: "Середній", HIGH: "Високий", CRITICAL: "Критичний" };

type Props = {
  disabled: boolean;
  onCreated: (task: Task) => void;
  onSubmittingChange: (submitting: boolean) => void;
};

export function CreateTaskForm({ disabled, onCreated, onSubmittingChange }: Props) {
  const [fields, setFields] = useState<CreateTaskFields>(EMPTY_TASK_FIELDS);
  const [errors, setErrors] = useState<CreateTaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A synchronous lock also blocks duplicate submits before React rerenders.
  const inFlight = useRef(false);
  const locked = disabled || submitting;

  function change(field: keyof CreateTaskFields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function fieldProps(field: keyof CreateTaskFields) {
    return {
      id: `create-${field}`,
      name: field,
      value: fields[field],
      disabled: locked,
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `create-${field}-error` : undefined,
    };
  }

  function fieldError(field: keyof CreateTaskFields) {
    return errors[field] && <span id={`create-${field}-error`} className={styles.fieldError}>{errors[field]}</span>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current) return;
    const result = parseCreateTaskFields(fields);
    setErrors(result.errors ?? {});
    setError(null);
    if (!result.input) {
      const firstField = Object.keys(result.errors)[0];
      const element = event.currentTarget.elements.namedItem(firstField);
      if (element instanceof HTMLElement) element.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    onSubmittingChange(true);
    let created: Task;
    try {
      created = await createTask(result.input);
    } catch (error) {
      // ApiError.message is safe for UI; apiMessage/details are diagnostics only.
      setError(error instanceof Error ? error.message : "Не вдалося створити задачу. Спробуйте ще раз.");
      return;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      onSubmittingChange(false);
    }

    setFields({ ...EMPTY_TASK_FIELDS });
    // A validated POST response is enough to insert the task without a second GET.
    onCreated(created);
  }

  return (
    <section className={styles.panel} aria-labelledby="create-heading">
      <h2 id="create-heading" className={styles.sectionTitle}>Нова задача</h2>
      <form onSubmit={handleSubmit} className={styles.form} noValidate aria-busy={submitting}>
        <label className={styles.field} htmlFor="create-title">
          Назва <span className={styles.required}>(обов’язково, до 160 символів)</span>
          <input {...fieldProps("title")} required onChange={(event) => change("title", event.target.value)} placeholder="Що потрібно зробити?" />
          {fieldError("title")}
        </label>
        <label className={styles.field} htmlFor="create-description">
          Опис <span className={styles.required}>(необов’язково)</span>
          <textarea {...fieldProps("description")} rows={3} onChange={(event) => change("description", event.target.value)} placeholder="Деталі, які допоможуть почати" />
        </label>
        <label className={styles.field} htmlFor="create-dueAt">
          Дедлайн: дата й час <span className={styles.required}>(обов’язково)</span>
          <input {...fieldProps("dueAt")} type="datetime-local" required onChange={(event) => change("dueAt", event.target.value)} />
          {fieldError("dueAt")}
        </label>
        <label className={styles.field} htmlFor="create-estimatedDurationMinutes">
          Орієнтовна тривалість у хвилинах <span className={styles.required}>(обов’язково)</span>
          <input {...fieldProps("estimatedDurationMinutes")} type="number" min={1} max={2147483647} step={1} required onChange={(event) => change("estimatedDurationMinutes", event.target.value)} />
          {fieldError("estimatedDurationMinutes")}
        </label>
        <label className={styles.field} htmlFor="create-plannedAt">
          Планування: дата й час <span className={styles.required}>(необов’язково)</span>
          <input {...fieldProps("plannedAt")} type="datetime-local" onChange={(event) => change("plannedAt", event.target.value)} />
          {fieldError("plannedAt")}
        </label>
        <label className={styles.field} htmlFor="create-priority">
          Пріоритет
          <select {...fieldProps("priority")} onChange={(event) => change("priority", event.target.value)}>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
          </select>
          {fieldError("priority")}
        </label>
        {error && <div role="alert" className={styles.error}><p>{error}</p></div>}
        <button className={styles.primaryButton} type="submit" disabled={locked}>
          {submitting ? "Створення…" : "+ Додати задачу"}
        </button>
      </form>
    </section>
  );
}
