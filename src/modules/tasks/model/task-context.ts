import type { Settings } from "../../settings/preferences-runtime";
import type { Task } from "./task-types";

export type TaskContext = { timezone: string; overdueMode: Settings["todayOverdueMode"]; overdueDays: number };
export type TaskSection = "current" | "today" | "backlog" | "archive";
export function taskContext(settings: Pick<Settings, "timeZone" | "todayOverdueMode" | "todayOverdueDays">): TaskContext {
  return { timezone: settings.timeZone, overdueMode: settings.todayOverdueMode, overdueDays: settings.todayOverdueDays };
}
export function taskContextQuery(context: TaskContext): string {
  return new URLSearchParams({ timezone: context.timezone, overdueMode: context.overdueMode, overdueDays: String(context.overdueDays) }).toString();
}
export function taskInSection(task: Task, section: TaskSection) {
  return task.deletedAt === null && (section === "archive" ? task.archivedAt !== null : task.archivedAt === null && (section === "today" ? task.isToday : section === "backlog" ? task.isBacklog : true));
}
