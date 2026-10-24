"use client";

import type { AreaReference } from "@/lib/area-types";
import { useAreas } from "../_hooks/use-areas";
import styles from "../page.module.css";

export function AreaSelect({ id, value, onChange, disabled, currentArea, error }: {
  id: string; value: string; onChange: (value: string) => void; disabled: boolean;
  currentArea?: AreaReference | null; error?: string;
}) {
  const directory = useAreas();
  const missing = value && !directory.areas.some((area) => area.id === value);
  return <div>
    <label className={styles.field} htmlFor={id}>Сфера
      <select id={id} name="areaId" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}>
        <option value="">Без сфери</option>
        {missing && <option value={value}>{currentArea?.id === value ? currentArea.name : "Обрана сфера недоступна"}</option>}
        {directory.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
      </select>
    </label>
    <div id={`${id}-hint`} className={styles.fieldHint}>
      {directory.loading && <span role="status">Завантаження сфер… </span>}
      {directory.error && <p role="alert">Не вдалося завантажити сфери. Можна продовжити без сфери.</p>}
      {missing && !directory.loading && !directory.error && <p>Обраної сфери немає у списку. Перевірте вибір або виберіть «Без сфери».</p>}
      <button type="button" className={styles.addSubtaskButton} disabled={disabled || directory.loading} onClick={directory.reload}>Оновити список сфер</button>
    </div>
    {error && <span id={`${id}-error`} className={styles.fieldError}>{error}</span>}
  </div>;
}
