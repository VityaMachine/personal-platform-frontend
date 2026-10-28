"use client";

import taskStyles from "./tasks.module.css";

import type { Task } from "@/modules/tasks/model/task-types";
import { formatRoutineBasis } from "@/modules/tasks/routines/model/routine-format";
import { useSettings } from "../../settings/preferences";

// These are local calendar dates, not instants. Keep them in their own calendar.
export function formatOccurrenceDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function RoutineOccurrence({ task }: { task: Task }) {
  const { settings } = useSettings();
  const occurrence = task.routineOccurrence;
  if (!occurrence) return null;
  return <p className={taskStyles.taskPriority}>
    <strong>Повторювана</strong> · <time dateTime={occurrence.startDate}>{formatOccurrenceDate(occurrence.startDate)}</time>
    {occurrence.endDate !== occurrence.startDate && <> — <time dateTime={occurrence.endDate}>{formatOccurrenceDate(occurrence.endDate)}</time></>}
    {occurrence.localTime && <> · {occurrence.localTime}</>}
    {occurrence.timezone !== settings.timeZone && <> · {occurrence.timezone}</>}
    {occurrence.basisType && occurrence.basisAt && <> · {formatRoutineBasis(occurrence, occurrence.timezone)}</>}
  </p>;
}
