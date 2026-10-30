import type { TaskSection } from "./model/task-context";

const taskPaths = {
  current: "/tasks",
  today: "/tasks/today",
  backlog: "/tasks/backlog",
  archive: "/tasks/archive",
  routines: "/tasks/routines",
} as const;

/** Module ownership includes nested Tasks routes, but never similarly named paths. */
export function isTasksPathname(pathname: string): boolean {
  return pathname === taskPaths.current || pathname.startsWith(`${taskPaths.current}/`);
}

export function taskSectionFromPathname(pathname: string): TaskSection {
  if (pathname === taskPaths.today) return "today";
  if (pathname === taskPaths.backlog) return "backlog";
  if (pathname === taskPaths.archive) return "archive";
  return "current";
}

/** Canonical paths determine the section. Legacy selectors never travel onward. */
export function cleanTaskQuery(query: string): string {
  const params = new URLSearchParams(query);
  params.delete("view");
  params.delete("archived");
  return params.toString();
}

export function taskHref(section: TaskSection | "routines", query = ""): string {
  const cleaned = cleanTaskQuery(query);
  return taskPaths[section] + (cleaned ? `?${cleaned}` : "");
}

/** Tasks owns section URLs and preservation of filters and unrelated query keys. */
export function taskNavigationHrefs(query: string): Record<TaskSection, string> {
  return {
    current: taskHref("current", query),
    today: taskHref("today", query),
    backlog: taskHref("backlog", query),
    archive: taskHref("archive", query),
  };
}

export type LegacyTaskSearchParams = Record<string, string | string[] | undefined>;

/** Next's searchParams arrays retain the first-value semantics of URLSearchParams.get. */
export function resolveLegacyTasksUrl(pathname: string, query: URLSearchParams | LegacyTaskSearchParams): string | null {
  if (pathname !== "/" && pathname !== "/routines") return null;
  const params = query instanceof URLSearchParams ? new URLSearchParams(query) : new URLSearchParams();
  if (!(query instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
    }
  }
  if (pathname === "/routines") return taskHref("routines", params.toString());
  const section = params.get("archived") === "true" ? "archive"
    : params.get("view") === "today" ? "today"
    : params.get("view") === "backlog" ? "backlog"
    : ["q", "status", "priority", "area", "sort", "view", "archived"].some(key => params.has(key)) ? "current"
    : "today";
  return taskHref(section, params.toString());
}
