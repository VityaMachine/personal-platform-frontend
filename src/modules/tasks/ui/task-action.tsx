"use client";

import { useId, type MouseEventHandler, type ReactNode } from "react";
import styles from "./task-action.module.css";

const icons: Record<string, ReactNode> = {
  skip: <><path d="m4 5 11 7L4 19Zm15 0v14" /></>,
  details: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
  archive: <><path d="M4 8v12h16V8M3 3h18v5H3Zm6 9h6" /></>,
  restore: <><path d="M4 13v7h16V8M3 3h18v5H3Zm9 13V9m-3 3 3-3 3 3" /></>,
  edit: <path d="m16 3 5 5L8 21H3v-5L16 3Z M13 6l5 5" />,
  delete: <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />,
};

export function TaskAction({ icon, label, accessibleLabel, disabled, ariaDisabled, compact, onClick }: {
  icon: keyof typeof icons; label: string; accessibleLabel: string; disabled?: boolean; ariaDisabled?: boolean; compact?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  const tooltipId = useId();
  return <button type="button" className={`${styles.action} ${icon === "delete" ? styles.danger : ""}`}
    data-task-action={icon} data-compact={compact || undefined} disabled={disabled} aria-disabled={ariaDisabled}
    aria-label={accessibleLabel} aria-describedby={tooltipId} onClick={onClick}>
    <svg className={styles.icon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[icon]}</svg>
    <span className={styles.label}>{label}</span>
    <span className={styles.tooltip} id={tooltipId} role="tooltip" aria-label={label} data-tooltip={label} />
  </button>;
}
