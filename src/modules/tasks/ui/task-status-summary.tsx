import type { Task } from "@/modules/tasks/model/task-types";
import { summarizeTaskStatuses } from "@/modules/tasks/model/task-status-summary";
import { statusBarPercentages } from "@/modules/tasks/model/status-bar-percentages";
import styles from "./task-status-summary.module.css";

export function TaskStatusSummary({ tasks, loading, error }: {
  tasks: readonly Task[]; loading: boolean; error: boolean;
}) {
  if (loading || (error && tasks.length === 0)) return <section className={styles.summary} aria-label="Підсумок статусів">
    <p role="status" className={styles.pending}>{loading ? "Завантаження підсумку…" : "Підсумок недоступний: список не завантажено."}</p>
  </section>;

  const counts = summarizeTaskStatuses(tasks);
  const groups = [
    { id: "todo", label: "До виконання", count: counts.todo },
    { id: "inProgress", label: "У роботі", count: counts.inProgress },
    { id: "inactive", label: "Неактивні", count: counts.inactive },
    { id: "done", label: "Виконано", count: counts.done },
  ];
  const percentages = statusBarPercentages(groups.map((group) => group.count));
  return <section className={styles.summary} aria-label="Підсумок статусів">
    <div className={styles.counters}>
      <p className={styles.total}>Усього задач <strong>{counts.total}</strong></p>
      <dl className={styles.groups}>
        {groups.map((group) => <div key={group.id} className={styles.group}>
          <dt>{group.label}</dt><dd>{group.count}</dd>
        </div>)}
      </dl>
    </div>
    <div className={styles.bar} role="group" aria-label={counts.total ? "Частки статусів задач" : "Частки статусів: задач немає"}>
      {groups.map((group, index) => {
        if (group.count === 0) return null;
        const share = group.count / counts.total * 100;
        const description = `${group.label}: ${group.count} із ${counts.total} задач — ${share}% (частка ${group.count}/${counts.total}).`;
        return <span key={group.id} className={`${styles.segment} ${styles[group.id]}`}
          style={{ width: `${share}%` }} role="img" aria-label={description} title={description}>
          <span className={styles.segmentLabel} aria-hidden="true">{percentages[index]}%</span>
        </span>;
      })}
    </div>
    <details className={styles.inactiveDetails}>
      <summary>Склад неактивних</summary>
      <p>Скасовано: {counts.statuses.CANCELED} · На паузі: {counts.statuses.PAUSED} · Відкладено: {counts.statuses.POSTPONED} · Пропущено: {counts.statuses.SKIPPED}</p>
    </details>
  </section>;
}
