import type { Routine } from "@/lib/routine-types";
import { formatRoutineDate, formatRoutineEnd, formatRoutineSchedule, formatShortMonth } from "@/lib/routine-format";
import { TASK_PRIORITY_LABELS } from "@/lib/task-labels";
import { formatDuration } from "@/lib/format-duration";
import { formatDate } from "@/lib/format-date";
import styles from "./routines.module.css";

export function RoutineFacts({ routine, detailed = false }: { routine: Routine; detailed?: boolean }) {
  const shortMonth = formatShortMonth(routine.schedule);
  return <>
    <span className={styles.status} data-paused={routine.pausedAt !== null}>{routine.pausedAt ? "На паузі" : "Активний"}</span>
    <dl className={styles.facts}>
      <div><dt>Розклад</dt><dd>{formatRoutineSchedule(routine.schedule)}</dd></div>
      <div><dt>Початок</dt><dd><time dateTime={routine.startDate}>{formatRoutineDate(routine.startDate)}</time></dd></div>
      <div><dt>Завершення розкладу</dt><dd>{formatRoutineEnd(routine.endCondition)}</dd></div>
      <div><dt>Час виконання</dt><dd>{routine.schedule.localTime ?? "Без заданого часу"} · {routine.timezone}</dd></div>
      <div><dt>Сфера</dt><dd>{routine.area?.name ?? "Без сфери"}</dd></div>
      <div><dt>Пріоритет</dt><dd>{TASK_PRIORITY_LABELS[routine.priority]}</dd></div>
      <div><dt>Тривалість</dt><dd>{formatDuration(routine.estimatedDurationMinutes)}</dd></div>
      <div><dt>Шаблонів підзадач</dt><dd>{routine.subtasks.length}</dd></div>
      {detailed && <>
        <div><dt>Створено</dt><dd>{formatDate(routine.createdAt, routine.timezone)}</dd></div>
        <div><dt>Оновлено</dt><dd>{formatDate(routine.updatedAt, routine.timezone)}</dd></div>
        {routine.pausedAt && <div><dt>Пауза від</dt><dd>{formatDate(routine.pausedAt, routine.timezone)}</dd></div>}
        <div><dt>Ідентифікатор шаблону</dt><dd>{routine.id}</dd></div>
      </>}
    </dl>
    {detailed && shortMonth && <p className={styles.hint}>{shortMonth}</p>}
  </>;
}
