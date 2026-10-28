"use client";
import type { Task, TaskSummary } from "@/modules/tasks/model/task-types";
import { TASK_TIME_STATUSES } from "@/modules/tasks/model/task-types";
import { TASK_STATUS_LABELS } from "@/modules/tasks/model/task-labels";
import { useSettings } from "../../settings/preferences";
import { formatDate } from "@/shared/dates/format-date";
import { formatDuration, formatSeconds } from "@/shared/lib/format-duration";
import styles from "./task-time-summary.module.css";

function TimeHelp() {
  return <details className={styles.help}>
    <summary>Про показники часу</summary>
    <p>Вік задачі — календарний час від створення. Він зупиняється в статусах «Завершено», «Скасовано» та «Пропущено». Після повторного відкриття знову враховується весь час від створення, включно з періодом попереднього завершення чи пропуску.</p>
    <p>«У роботі» — накопичений час у статусі IN_PROGRESS («У роботі»), а не облік витраченої праці. Інтервали підзадач не додаються до часу задачі, оскільки можуть перекриватися.</p>
  </details>;
}

function HistoryNote({ summary }: { summary: TaskSummary }) {
  return summary.historyIncomplete ? <p className={styles.note}>Історія задачі неповна. Частина показників недоступна; наявні значення показано за доступними даними.</p> : null;
}

export function TaskTimeMetrics({ summary }: { summary: TaskSummary }) {
  return <div className={styles.compact}>
    <dl className={styles.metrics}>
      <div><dt>Вік задачі</dt><dd>{formatSeconds(summary.ageSeconds)}</dd></div>
      <div><dt>У роботі</dt><dd>{formatSeconds(summary.inProgressSeconds)}</dd></div>
    </dl>
    <TimeHelp />
    <HistoryNote summary={summary} />
  </div>;
}

export function TaskTimeSummary({ task }: { task: Task }) {
  const { settings: { timeZone } } = useSettings();
  const { summary } = task;
  return <section className={styles.panel} aria-label="Підсумок часу">
    <h3>Підсумок часу</h3>
    <dl className={styles.metrics}>
      <div><dt>Вік задачі</dt><dd>{formatSeconds(summary.ageSeconds)}</dd></div>
      {summary.timeToCompletionSeconds !== null && <div><dt>Час до завершення</dt><dd>{formatSeconds(summary.timeToCompletionSeconds)}</dd></div>}
    </dl>
    <dl className={`${styles.metrics} ${styles.comparison}`} aria-label="Порівняння планової тривалості й часу у роботі">
      <div><dt>Планова тривалість</dt><dd>{formatDuration(task.estimatedDurationMinutes)}</dd></div>
      <div><dt>У роботі</dt><dd>{formatSeconds(summary.inProgressSeconds)}</dd></div>
    </dl>
    <h4 className={styles.distributionHeading}>Час у статусах</h4>
    <dl className={styles.metrics}>
      {TASK_TIME_STATUSES.map((status) => <div key={status}>
        <dt>{TASK_STATUS_LABELS[status]}</dt><dd>{formatSeconds(summary.statusDurationsSeconds[status])}</dd>
      </div>)}
    </dl>
    <TimeHelp />
    <HistoryNote summary={summary} />
    <p className={styles.note}>Розраховано: <time dateTime={summary.asOf}>{formatDate(summary.asOf, timeZone)}</time>. Дані наведено на цей момент.</p>
  </section>;
}
