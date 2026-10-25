"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createTask, type Task } from "@/lib/tasks";
import { ApiError } from "@/lib/api";
import { AreaSelect } from "./area-select";
import { TASK_PRIORITIES } from "@/lib/task-types";
import { TASK_PRIORITY_LABELS } from "@/lib/task-labels";
import { EMPTY_TASK_FIELDS, MAX_DURATION_MINUTES, getSubtaskDuration, parseCreateTaskFields, type CreateTaskErrors, type CreateTaskFields, type SubtaskErrors, type SubtaskFields } from "@/lib/create-task-input";
import { SubtasksEditor } from "./subtasks-editor";
import { useTaskContext } from "../_hooks/use-task-context";
import { useFormDates } from "../_hooks/use-form-dates";
import { ZonedDateTimeField } from "./zoned-date-time-field";
import styles from "../page.module.css";

type Props = {
  formId: string;
  disabled: boolean;
  onCreated: (task: Task, contextKey: string) => void;
  onSubmittingChange: (submitting: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
};

export function CreateTaskForm({ formId, disabled, onCreated, onSubmittingChange, onDirtyChange }: Props) {
  const createdCallback = useRef(onCreated);
  useLayoutEffect(() => { createdCallback.current = onCreated; });
  const dates = useFormDates();
  const { context, ready } = useTaskContext();
  const [fields, setFields] = useState<CreateTaskFields>(EMPTY_TASK_FIELDS);
  const [subtasks, setSubtasks] = useState<SubtaskFields[]>([]);
  const [subtaskErrors, setSubtaskErrors] = useState<SubtaskErrors>({});
  const [errors, setErrors] = useState<CreateTaskErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A synchronous lock also blocks duplicate submits before React rerenders.
  const inFlight = useRef(false);
  const locked = disabled || submitting;
  const hasSubtasks = subtasks.length > 0;
  const subtaskDuration = getSubtaskDuration(subtasks);

  function updateDirty(nextFields: CreateTaskFields, nextSubtasks: SubtaskFields[]) {
    onDirtyChange(nextSubtasks.length > 0 || (Object.keys(nextFields) as (keyof CreateTaskFields)[]).some((key) => nextFields[key] !== EMPTY_TASK_FIELDS[key]));
  }

  function changeSubtasks(next: SubtaskFields[]) {
    if (disabled || inFlight.current) return;
    setSubtasks(next);
    updateDirty(fields, next);
    const validation = parseCreateTaskFields(fields, next, dates.options);
    setSubtaskErrors((previous) => Object.fromEntries(
      next.filter((row) => previous[row.localId]).map((row) => [row.localId, validation.subtaskErrors?.[row.localId] ?? {}]),
    ));
    setErrors((previous) => ({ ...previous, estimatedDurationMinutes: undefined }));
  }

  function change(field: keyof CreateTaskFields, value: string) {
    if (disabled || inFlight.current) return;
    if (field === "dueAt" || field === "plannedAt") dates.clear(field);
    const nextFields = { ...fields, [field]: value };
    setFields(nextFields);
    updateDirty(nextFields, subtasks);
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
    if (!ready || disabled || inFlight.current) return;
    const result = parseCreateTaskFields(fields, subtasks, dates.options);
    setErrors(result.errors ?? {});
    setSubtaskErrors(result.subtaskErrors ?? {});
    setError(null);
    if (!result.input) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    onSubmittingChange(true);
    let created: Task;
    try {
      created = await createTask(result.input, undefined, context);
    } catch (error) {
      // ApiError.message is safe for UI; apiMessage/details are diagnostics only.
      setError(error instanceof ApiError && error.status === 404 && fields.areaId
        ? "Обрана сфера могла бути видалена. Оновіть список сфер і перевірте вибір перед повторним збереженням."
        : error instanceof Error ? error.message : "Не вдалося створити задачу. Спробуйте ще раз.");
      return;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      onSubmittingChange(false);
    }

    setFields({ ...EMPTY_TASK_FIELDS });
    setSubtasks([]);
    setSubtaskErrors({});
    setErrors({});
    onDirtyChange(false);
    // A validated POST response is enough to insert the task without a second GET.
    createdCallback.current(created, JSON.stringify(context));
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className={styles.form} noValidate aria-busy={submitting}>
      <div className={styles.formColumn}>
        <label className={styles.field} htmlFor="create-title">
          Назва <span className={styles.required}>(обов’язково, до 160 символів)</span>
          <input {...fieldProps("title")} required onChange={(event) => change("title", event.target.value)} placeholder="Що потрібно зробити?" />
          {fieldError("title")}
        </label>
        <label className={styles.field} htmlFor="create-description">
          Опис <span className={styles.required}>(необов’язково)</span>
          <textarea {...fieldProps("description")} rows={3} onChange={(event) => change("description", event.target.value)} placeholder="Деталі, які допоможуть почати" />
        </label>
        <SubtasksEditor subtasks={subtasks} errors={subtaskErrors} disabled={locked} onChange={changeSubtasks} />
      </div>
      <div className={styles.formColumn}>
        <ZonedDateTimeField
          id="create-dueAt" name="dueAt" label="Дедлайн: дата й час (обов’язково)"
          value={fields.dueAt} timeZone={dates.timeZone} hint={dates.hint}
          choice={dates.choices.dueAt}
          disabled={locked} required
          error={errors.dueAt}
          onChange={(value) => change("dueAt", value)}
          onChoice={(iso) => dates.choose("dueAt", iso)}
        />
        <AreaSelect id="create-areaId" value={fields.areaId} onChange={(value) => change("areaId", value)} disabled={locked} error={errors.areaId} />
        <ZonedDateTimeField
          id="create-plannedAt" name="plannedAt" label="Планування: дата й час (необов’язково)"
          value={fields.plannedAt} timeZone={dates.timeZone} hint={dates.hint}
          choice={dates.choices.plannedAt}
          disabled={locked}
          error={errors.plannedAt}
          onChange={(value) => change("plannedAt", value)}
          onChoice={(iso) => dates.choose("plannedAt", iso)}
        />
        <label className={styles.field} htmlFor="create-priority">
          Пріоритет
          <select {...fieldProps("priority")} onChange={(event) => change("priority", event.target.value)}>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}
          </select>
          {fieldError("priority")}
        </label>
        <label className={styles.field} htmlFor="create-estimatedDurationMinutes">
          Орієнтовна тривалість у хвилинах <span className={styles.required}>(обов’язково)</span>
          <input
            {...fieldProps("estimatedDurationMinutes")}
            type="number" min={1} max={MAX_DURATION_MINUTES} step={1} required
            value={hasSubtasks ? subtaskDuration ?? "" : fields.estimatedDurationMinutes}
            readOnly={hasSubtasks}
            aria-describedby={[
              hasSubtasks ? "create-duration-hint" : "",
              errors.estimatedDurationMinutes ? "create-estimatedDurationMinutes-error" : "",
            ].filter(Boolean).join(" ") || undefined}
            onChange={(event) => { if (!hasSubtasks) change("estimatedDurationMinutes", event.target.value); }}
          />
          {hasSubtasks && <span id="create-duration-hint" className={styles.fieldHint}>Сума тривалостей підзадач</span>}
          {fieldError("estimatedDurationMinutes")}
        </label>
      </div>
      {error && <div role="alert" className={`${styles.error} ${styles.formError}`}><p>{error}</p></div>}
    </form>
  );
}
