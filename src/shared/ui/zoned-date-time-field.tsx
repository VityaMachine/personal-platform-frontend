import uiStyles from "./controls.module.css";
import type { Ref } from "react";
import { localDateCandidates, sameInstant } from "@/shared/dates/zoned-date";

export function ZonedDateTimeField({ id, name, label, value, timeZone, choice, original, error, disabled, required, inputRef, hint, onChange, onChoice }: {
  id: string; name: string; label: string; value: string; timeZone: string; choice?: string; original?: string | null;
  error?: string; disabled: boolean; required?: boolean; inputRef?: Ref<HTMLInputElement>; hint?: string;
  onChange: (value: string) => void; onChoice: (iso: string) => void;
}) {
  const { candidates } = value ? localDateCandidates(value, timeZone) : { candidates: [] };
  const currentChoice = choice ?? candidates.find((candidate) => sameInstant(candidate.iso, original))?.iso ?? "";
  return <div className={uiStyles.field}>
    <label htmlFor={id}>{label}</label>
    <input ref={inputRef} id={id} name={name} type="datetime-local" step="0.001" required={required} value={value} disabled={disabled}
      aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} onChange={(e) => onChange(e.target.value)} />
    <span id={`${id}-hint`} className={uiStyles.fieldHint}>{hint ?? `Дата й час у поясі ${timeZone}.`}</span>
    {candidates.length > 1 && <>
      <label htmlFor={`${id}-offset`}>Уточніть час: годинник переводиться назад</label>
      <select id={`${id}-offset`} value={currentChoice} disabled={disabled} onChange={(e) => onChoice(e.target.value)} aria-invalid={Boolean(error) && !currentChoice}>
        <option value="">Виберіть UTC-зсув</option>
        {candidates.map((candidate, index) => <option key={candidate.iso} value={candidate.iso}>UTC{candidate.offset} — {index === 0 ? "перше" : "друге"} входження</option>)}
      </select>
    </>}
    {error && <span id={`${id}-error`} className={uiStyles.fieldError}>{error}</span>}
  </div>;
}
