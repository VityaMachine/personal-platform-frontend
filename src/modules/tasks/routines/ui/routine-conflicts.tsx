import type { RoutineWindowConflict } from "@/modules/tasks/routines/model/routine-types";
import styles from "./routines.module.css";

export function RoutineConflicts({ conflicts }: { conflicts?: RoutineWindowConflict[] }) {
  if (!conflicts?.length) return null;
  const stored = conflicts.filter((entry) => entry.code === "STORED_WINDOW_CONFLICT").length;
  return <div className={styles.ruleDescription}>
    <p>Пропущено через перетин календарних вікон: {conflicts.length}. Ці виконання не створюються.</p>
    {stored > 0 && <p>{stored} — уже є задача з календарним вікном, що перетинається. Вона залишається без змін.</p>}
    {stored < conflicts.length && <p>{conflicts.length - stored} — вікно перетинається з іншим новим кандидатом; сервер залишив раніший.</p>}
  </div>;
}
