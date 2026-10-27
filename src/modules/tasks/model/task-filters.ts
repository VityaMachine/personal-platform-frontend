import type { TaskSection } from "./task-context";
import { isAreaId } from "../../../lib/area-validation";
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from "./task-types";

export const TASK_SORTS = ["newest", "oldest", "deadline", "priority"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];
export type TaskFilters = {
  q: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  area: string;
  sort: TaskSort;
};
export const DEFAULT_TASK_FILTERS: TaskFilters = { q: "", status: "", priority: "", area: "", sort: "newest" };
const keys = ["q", "status", "priority", "area", "sort"] as const;

export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  const area = params.get("area");
  return {
    q: params.get("q") ?? "",
    status: TASK_STATUSES.find((value) => value === params.get("status")) ?? "",
    priority: TASK_PRIORITIES.find((value) => value === params.get("priority")) ?? "",
    area: area === "none" ? area : isAreaId(area) ? area.toLowerCase() : "",
    sort: TASK_SORTS.find((value) => value === params.get("sort")) ?? "newest",
  };
}

export function serializeTaskFilters(params: URLSearchParams, filters: TaskFilters): URLSearchParams {
  const result = new URLSearchParams(params);
  const normalized = parseTaskFilters(new URLSearchParams(filters));
  keys.forEach((key) => result.delete(key));
  // Preserve the search draft, including spaces while typing. Matching trims it.
  if (normalized.q) result.set("q", normalized.q);
  if (normalized.status) result.set("status", normalized.status);
  if (normalized.priority) result.set("priority", normalized.priority);
  if (normalized.area) result.set("area", normalized.area);
  if (normalized.sort !== "newest") result.set("sort", normalized.sort);
  return result;
}

export function sameTaskFilters(left: TaskFilters, right: TaskFilters) {
  return keys.every((key) => left[key] === right[key]);
}

export function taskSectionHref(params: URLSearchParams, section: TaskSection | boolean) {
  const result = new URLSearchParams(params);
  result.delete("view");
  if (section === "today" || section === "backlog") result.set("view", section);
  if (section === true || section === "archive") result.set("archived", "true");
  else result.delete("archived");
  const query = result.toString();
  return query ? `/?${query}` : "/";
}

const priorityRank: Record<TaskPriority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const idAsc = (left: Task, right: Task) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
const newest = (left: Task, right: Task) => Date.parse(right.createdAt) - Date.parse(left.createdAt);

/** Partition an already filtered and sorted list; relative order stays intact. */
export function groupTaskList(tasks: Task[], section: TaskSection): { id: string; title: string | null; tasks: Task[] }[] {
  if (section !== "today") return [{ id: "all", title: null, tasks }];
  return [
    { id: "todo", title: "До виконання", tasks: tasks.filter((task) => task.status !== "DONE") },
    { id: "done", title: "Виконано сьогодні", tasks: tasks.filter((task) => task.status === "DONE") },
  ].filter((group) => group.tasks.length > 0);
}

export function selectTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  const query = filters.q.trim().toLocaleLowerCase("uk-UA");
  return tasks.filter((task) => (!query || task.title.toLocaleLowerCase("uk-UA").includes(query))
    && (!filters.status || task.status === filters.status)
    && (!filters.priority || task.priority === filters.priority)
    && (!filters.area || (filters.area === "none" ? task.areaId === null : task.areaId === filters.area)))
    .sort((left, right) => {
      let comparison = 0;
      if (filters.sort === "oldest") comparison = -newest(left, right);
      else if (filters.sort === "deadline") {
        if (left.dueAt === null) comparison = right.dueAt === null ? 0 : 1;
        else if (right.dueAt === null) comparison = -1;
        else comparison = Date.parse(left.dueAt) - Date.parse(right.dueAt);
      } else if (filters.sort === "priority") comparison = priorityRank[right.priority] - priorityRank[left.priority];
      else comparison = newest(left, right);
      return comparison || (filters.sort === "deadline" || filters.sort === "priority" ? newest(left, right) : 0) || idAsc(left, right);
    });
}
