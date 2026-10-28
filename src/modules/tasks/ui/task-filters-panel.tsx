"use client";

import uiStyles from "../../../shared/ui/controls.module.css";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/modules/tasks/model/task-types";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/modules/tasks/model/task-labels";
import { parseTaskFilters, type TaskFilters } from "@/modules/tasks/model/task-filters";
import { useAreas } from "../../../entities/areas/ui";
import styles from "./task-filters-panel.module.css";
import { useId, useState } from "react";

export function TaskFiltersPanel({ filters, onChange, onReset, disabled, total, found, loading, error }: {
  filters: TaskFilters; onChange: (change: Partial<TaskFilters>) => void; onReset: () => void;
  disabled: boolean; total: number; found: number; loading: boolean; error: boolean;
}) {
  const directory = useAreas();
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();
  const activeCount = [filters.q.trim(), filters.status, filters.priority, filters.area].filter(Boolean).length;
  const missingArea = filters.area && filters.area !== "none" && !directory.areas.some((area) => area.id === filters.area);
  function select(key: "status" | "priority" | "sort", value: string) {
    const normalized = parseTaskFilters(new URLSearchParams({ [key]: value }));
    onChange({ [key]: normalized[key] });
  }
  return <section className={styles.panel} aria-label="Пошук, фільтри й сортування задач">
    <button type="button" className={`${uiStyles.secondaryButton} ${styles.disclosure}`} aria-expanded={expanded}
      aria-controls={controlsId} onClick={() => setExpanded((value) => !value)}>
      {expanded ? "Згорнути фільтри" : `Пошук і фільтри · активних умов: ${activeCount}`}
    </button>
    <div id={controlsId} className={`${styles.filterBody} ${expanded ? styles.expanded : ""}`}>
      <fieldset className={styles.controls} disabled={disabled}>
        <legend className={uiStyles.visuallyHidden}>Умови відбору задач</legend>
        <label className={`${uiStyles.field} ${styles.search}`}>Пошук за назвою
          <input name="q" type="search" value={filters.q} onChange={(event) => onChange({ q: event.target.value })} placeholder="Назва задачі" />
        </label>
        <label className={uiStyles.field}>Статус
          <select name="status" value={filters.status} onChange={(event) => select("status", event.target.value)}>
            <option value="">Усі статуси</option>
            {TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className={uiStyles.field}>Пріоритет
          <select name="priority" value={filters.priority} onChange={(event) => select("priority", event.target.value)}>
            <option value="">Усі пріоритети</option>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}
          </select>
        </label>
        <label className={`${uiStyles.field} ${styles.area}`}>Сфера
          <select name="area" value={filters.area} onChange={(event) => onChange({ area: event.target.value })}>
            <option value="">Усі сфери</option><option value="none">Без сфери</option>
            {missingArea && <option value={filters.area}>{directory.loading ? "Сфера завантажується…" : directory.error ? "Список сфер недоступний" : "Недоступна сфера"}</option>}
            {directory.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </label>
        <label className={`${uiStyles.field} ${styles.sort}`}>Сортування
          <select name="sort" value={filters.sort} onChange={(event) => select("sort", event.target.value)}>
            <option value="newest">Спочатку нові</option><option value="oldest">Спочатку старі</option>
            <option value="deadline">Найближчий дедлайн</option><option value="priority">Найвищий пріоритет</option>
          </select>
        </label>
        <button type="button" className={`${uiStyles.secondaryButton} ${styles.reset}`} onClick={onReset}>Скинути</button>
      </fieldset>
      {directory.loading && <p role="status" className={uiStyles.fieldHint}>Завантаження сфер…</p>}
      {directory.error && <div role="alert" className={uiStyles.error}>
        <p>Не вдалося завантажити сфери. {directory.error}</p>
        <button type="button" className={uiStyles.secondaryButton} disabled={disabled || directory.loading} onClick={directory.reload}>Оновити список сфер</button>
      </div>}
    </div>
    {!loading && !error && <p role="status" className={styles.count}>Знайдено {found} із {total}</p>}
  </section>;
}
