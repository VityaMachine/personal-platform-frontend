"use client";

import { useLayoutEffect, useRef } from "react";
import { MAX_DURATION_MINUTES, type SubtaskErrors, type SubtaskFields } from "@/modules/tasks/model/create-task-input";
import styles from "../../../app/page.module.css";

type Props = {
  subtasks: SubtaskFields[];
  errors: SubtaskErrors;
  disabled: boolean;
  onChange: (subtasks: SubtaskFields[]) => void;
};

export function SubtasksEditor({ subtasks, errors, disabled, onChange }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    sectionRef.current?.querySelector<HTMLElement>(`#${pendingFocus.current}`)?.focus();
    pendingFocus.current = null;
  }, [subtasks]);

  function add() {
    if (disabled) return;
    const localId = crypto.randomUUID();
    pendingFocus.current = `subtask-${localId}-title`;
    onChange([...subtasks, { localId, title: "", estimatedDurationMinutes: "" }]);
  }

  function remove(index: number) {
    if (disabled) return;
    const remaining = subtasks.filter((_, rowIndex) => rowIndex !== index);
    const next = remaining[index] ?? remaining[index - 1];
    pendingFocus.current = next ? `subtask-${next.localId}-title` : "add-subtask";
    onChange(remaining);
  }

  return (
    <section ref={sectionRef} className={styles.subtasksEditor} aria-labelledby="subtasks-heading">
      <h3 id="subtasks-heading" className={styles.subtasksHeading}>Підзадачі</h3>
      {subtasks.length > 0 && <div className={styles.subtaskColumns} aria-hidden="true">
        <span>Назва підзадачі</span>
        <span>Тривалість, хв</span>
      </div>}
      {subtasks.length > 0 && <ol className={styles.subtaskList}>
        {subtasks.map((subtask, index) => (
          <li key={subtask.localId} className={styles.subtaskRow}>
            {(["title", "estimatedDurationMinutes"] as const).map((field) => {
              const id = `subtask-${subtask.localId}-${field}`;
              const error = errors[subtask.localId]?.[field];
              return (
                <label key={field} htmlFor={id} className={`${styles.field} ${styles.subtaskField}`}>
                  <span className={styles.subtaskLabel}>
                    {field === "title" ? `Назва підзадачі ${index + 1}` : <>Тривалість, хв<span className={styles.visuallyHidden}> підзадачі {index + 1}</span></>}
                  </span>
                  <input
                    id={id} name={id}
                    type={field === "title" ? "text" : "number"}
                    min={field === "title" ? undefined : 1}
                    max={field === "title" ? undefined : MAX_DURATION_MINUTES}
                    step={field === "title" ? undefined : 1}
                    required disabled={disabled} value={subtask[field]}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(event) => {
                      if (disabled) return;
                      onChange(subtasks.map((row) => row.localId === subtask.localId ? { ...row, [field]: event.target.value } : row));
                    }}
                  />
                  {error && <span id={`${id}-error`} className={styles.fieldError}>{error}</span>}
                </label>
              );
            })}
            <button type="button" className={`${styles.secondaryButton} ${styles.subtaskRemove}`} disabled={disabled} onClick={() => remove(index)} aria-label={`Видалити підзадачу ${index + 1}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
              </svg>
            </button>
          </li>
        ))}
      </ol>}
      <button id="add-subtask" type="button" className={styles.secondaryButton} disabled={disabled} onClick={add}>Додати підзадачу</button>
    </section>
  );
}
