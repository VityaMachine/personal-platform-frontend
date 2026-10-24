import { formatDate } from "./format-date";
import { formatDuration } from "./format-duration";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "./task-labels";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskHistoryEvent } from "./task-types";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const descriptions: Record<string, string> = {
  CREATED: "Задачу створено", EDITED: "Задачу оновлено", STATUS_CHANGED: "Статус задачі змінено",
  ARCHIVED: "Задачу архівовано", UNARCHIVED: "Задачу повернуто з архіву", DELETED: "Задачу видалено",
  AREA_CHANGED: "Сферу змінено",
  SUBTASK_CREATED: "Підзадачу створено", SUBTASK_EDITED: "Підзадачу оновлено",
  SUBTASK_STATUS_CHANGED: "Статус підзадачі змінено", SUBTASK_DELETED: "Підзадачу видалено",
};
const fields: Record<string, string> = {
  title: "Назва", description: "Опис", status: "Статус", priority: "Пріоритет",
  plannedAt: "Планування", dueAt: "Дедлайн", estimatedDurationMinutes: "Тривалість",
  cancellationNote: "Причина скасування", archivedAt: "Дата архівування", deletedAt: "Дата видалення",
  area: "Сфера",
};

export type HistoryChange = { key: string; label: string; before: string; after: string; initial: boolean };

function needsDetails(change: HistoryChange) {
  return change.initial || ["description", "cancellationNote", "archivedAt", "deletedAt"].includes(change.key)
    || [change.before, change.after].some((value) => value.length > 100 || value.includes("\n"));
}

function fieldValue(key: string, value: unknown, timeZone: string): string {
  if (key === "area") {
    if (value === null) return "Без сфери";
    const name = record(value).name;
    return typeof name === "string" && name.trim() ? name : "Назву сфери не зафіксовано";
  }
  if (value === undefined) return "Не зафіксовано";
  if (value === null || value === "") return "Не вказано";
  if (key === "status") {
    const status = TASK_STATUSES.find((status) => status === value);
    return status ? TASK_STATUS_LABELS[status] : "Невідомий статус";
  }
  if (key === "priority") {
    const priority = TASK_PRIORITIES.find((priority) => priority === value);
    return priority ? TASK_PRIORITY_LABELS[priority] : "Невідомий пріоритет";
  }
  if (key.endsWith("At")) return typeof value === "string" ? formatDate(value, timeZone) : "Не вказано";
  if (key === "estimatedDurationMinutes") return typeof value === "number" && Number.isInteger(value) && value > 0 ? formatDuration(value) : "Не вказано";
  return typeof value === "string" ? value : "Не зафіксовано";
}

export function describeTaskHistory(events: TaskHistoryEvent[], timeZone = "UTC") {
  const names = new Map<string, string>();
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)).map((event) => {
    const metadata = record(event.metadata);
    const before = record(metadata.before);
    const after = record(metadata.after);
    const subtaskId = typeof metadata.subtaskId === "string" ? metadata.subtaskId : undefined;
    const childEvent = event.type.startsWith("SUBTASK_");
    // Most child events contain only changed fields. Resolve their historical
    // name from earlier snapshots, never from the current Task.subtasks array.
    const snapshotTitle = typeof before.title === "string" ? before.title : typeof after.title === "string" ? after.title : undefined;
    const title = childEvent ? snapshotTitle ?? (subtaskId ? names.get(subtaskId) : undefined) : undefined;
    if (childEvent && subtaskId && typeof after.title === "string") names.set(subtaskId, after.title);
    else if (childEvent && subtaskId && snapshotTitle) names.set(subtaskId, snapshotTitle);
    let description = Object.hasOwn(descriptions, event.type) ? descriptions[event.type] : "Зафіксовано подію задачі";
    if (event.type === "AREA_CHANGED") {
      if (after.areaId === null || after.area === null) description = "Сферу прибрано";
      else if (before.areaId === null || before.area === null) description = "Сферу призначено";
    }
    const initial = event.type === "CREATED" || event.type === "SUBTASK_CREATED";
    const changes: HistoryChange[] = Object.hasOwn(descriptions, event.type) ? Object.entries(fields).flatMap(([key, label]) => {
      if (key === "area" && event.type === "AREA_CHANGED") {
        if (!("area" in before) && !("area" in after) && !("areaId" in before) && !("areaId" in after)) return [];
        const snapshot = (value: Record<string, unknown>) => "area" in value ? value.area : value.areaId === null ? null : undefined;
        return [{ key, label, before: fieldValue(key, snapshot(before), timeZone), after: fieldValue(key, snapshot(after), timeZone), initial: false }];
      }
      if (!(key in before) && !(key in after)) return [];
      if (Object.is(before[key], after[key])) return [];
      if (initial && (after[key] == null || (typeof after[key] === "string" && !after[key].trim()))) return [];
      if (event.type === "SUBTASK_CREATED" && key === "title" && title) return [];
      return [{ key, label, before: fieldValue(key, before[key], timeZone), after: fieldValue(key, after[key], timeZone), initial }];
    }) : [];
    const shortChanges = changes.filter((change) => !needsDetails(change)).slice(0, 3);
    const details = changes.filter((change) => !shortChanges.includes(change));
    const childDescriptions: Record<string, string> = {
      SUBTASK_CREATED: `Підзадачу «${title}» створено`, SUBTASK_EDITED: `Підзадачу «${title}» оновлено`,
      SUBTASK_STATUS_CHANGED: `Статус підзадачі «${title}» змінено`, SUBTASK_DELETED: `Підзадачу «${title}» видалено`,
    };
    const singleChange = !childEvent && event.type !== "AREA_CHANGED" && shortChanges.length === 1 && details.length === 0 ? shortChanges[0] : null;
    return { event,
      description: singleChange ? `${singleChange.label}: ${singleChange.before} → ${singleChange.after}`
        : title && Object.hasOwn(childDescriptions, event.type) ? childDescriptions[event.type] : description,
      context: !childEvent && subtaskId ? "Після зміни підзадачі" : null,
      shortChanges: singleChange ? [] : shortChanges, details };
  });
}
