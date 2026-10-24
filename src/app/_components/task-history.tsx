"use client";
import type { TaskHistoryEvent } from "@/lib/task-types";
import { describeTaskHistory, type HistoryChange } from "@/lib/task-history";
import { useSettings } from "../_hooks/use-settings";
import { formatDate } from "@/lib/format-date";
import styles from "./task-details.module.css";

function Changes({ changes }: { changes: HistoryChange[] }) {
  return <dl className={styles.changes}>
    {changes.map((change) => <div key={change.key}>
      <dt>{change.label}</dt>
      <dd>{change.initial ? change.after : <><span className={styles.srOnly}>Було: </span><span className={styles.previousValue}>{change.before}</span><span aria-hidden="true"> → </span><span className={styles.srOnly}>; стало: </span>{change.after}</>}</dd>
    </div>)}
  </dl>;
}

export function TaskHistory({ events }: { events: TaskHistoryEvent[] }) {
  const { settings: { timeZone } } = useSettings();
  if (events.length === 0) return <p>Історія задачі поки порожня.</p>;
  return <ol className={styles.timeline}>
    {describeTaskHistory(events, timeZone).map(({ event, description, context, shortChanges, details }) => <li key={event.id}>
      <div className={styles.eventHeader}>
        <p className={styles.eventTitle}>{description}</p>
        <time className={styles.eventDate} dateTime={event.timestamp}>{formatDate(event.timestamp, timeZone)}</time>
      </div>
      {context && <p className={styles.eventContext}>{context}</p>}
      {shortChanges.length > 0 && <Changes changes={shortChanges} />}
      {details.length > 0 && <details className={styles.eventDetails}>
        <summary>Подробиці</summary>
        <Changes changes={details} />
      </details>}
    </li>)}
  </ol>;
}
