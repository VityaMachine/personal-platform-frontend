import { taskSectionHref } from "./model/task-filters";
import type { TaskSection } from "./model/task-context";

/** Tasks owns section URLs and preservation of filters and unrelated query keys. */
export function taskNavigationHrefs(query: string): Record<TaskSection, string> {
  const params = new URLSearchParams(query);
  return {
    current: taskSectionHref(params, "current"),
    today: taskSectionHref(params, "today"),
    backlog: taskSectionHref(params, "backlog"),
    archive: taskSectionHref(params, "archive"),
  };
}
