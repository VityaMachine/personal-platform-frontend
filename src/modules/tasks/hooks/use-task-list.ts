"use client";
import { useEffect, useState, useSyncExternalStore, type SetStateAction } from "react";
import { getArchivedTasks, getBacklogTasks, getTasks, getTodayTasks, type Task } from "@/modules/tasks/api/tasks";
import { taskContextQuery, type TaskSection } from "@/modules/tasks/model/task-context";
import { MAX_REFRESH_DELAY, nextTaskRefresh } from "@/modules/tasks/model/task-refresh";
import { useTaskContext } from "./use-task-context";
import { subscribeTaskListInvalidation, taskListVersion, taskListServerVersion } from "@/modules/tasks/model/task-list-invalidation";

type Result = { key: string; observedAt: number; tasks: Task[]; inventory: Task[]; inventoryWarning: string | null; error: string | null };

export function useTaskList(section: TaskSection, areaRevision = 0) {
  const { context, ready } = useTaskContext();
  const [revision, setRevision] = useState(0);
  const dataVersion = useSyncExternalStore(subscribeTaskListInvalidation, taskListVersion, taskListServerVersion);
  const key = section + ":" + taskContextQuery(context) + ":" + areaRevision + ":" + revision + ":" + dataVersion;
  const [result, setResult] = useState<Result | null>(null);
  const current = ready && result?.key === key;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const observedAt = Date.now();
    const load = section === "archive" ? getArchivedTasks : section === "today" ? getTodayTasks : section === "backlog" ? getBacklogTasks : getTasks;
    // One inventory request for omitted future tasks and occurrence timezones.
    // Its failure must not prevent the selected list from being available.
    const inventory = section === "today" || section === "backlog" ? getTasks(controller.signal, context) : null;
    void Promise.allSettled([load(controller.signal, context), inventory]).then(([selected, base]) => {
      if (controller.signal.aborted) return;
      const tasks = selected.status === "fulfilled" ? selected.value : [];
      setResult({ key, observedAt, tasks,
        inventory: base.status === "fulfilled" ? base.value ?? tasks : tasks,
        inventoryWarning: base.status === "rejected" ? "Не вдалося завантажити поточні задачі для автоматичного оновлення. Часові межі й часові пояси прихованих задач невідомі. Скористайтеся «Оновити список»; повернення до вкладки також оновлює дані." : null,
        error: selected.status === "rejected" ? selected.reason instanceof Error ? selected.reason.message : "Не вдалося завантажити задачі." : null,
      });
    });
    return () => controller.abort();
  }, [key, ready, section, context]);

  useEffect(() => {
    if (!current) return;
    let timer: number | undefined;
    let refreshRequested = false;
    const refresh = () => {
      if (refreshRequested) return;
      refreshRequested = true;
      window.clearTimeout(timer);
      setRevision((value) => value + 1);
    };
    // Include boundaries crossed while the response was in flight.
    const boundary = nextTaskRefresh(result.inventory, context.timezone, result.observedAt);
    const schedule = () => {
      if (document.visibilityState === "hidden") return;
      const remaining = boundary - Date.now();
      if (remaining <= 0) { refresh(); return; }
      timer = window.setTimeout(schedule, Math.min(remaining, MAX_REFRESH_DELAY));
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== "hidden") refresh();
    };
    const onFocus = () => { if (document.visibilityState !== "hidden") refresh(); };
    if (!result.error) schedule();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [current, key, context, result]);

  function observeTask(task: Task | string) {
    setResult((previous) => {
      if (!previous || previous.key !== key) return previous;
      const id = typeof task === "string" ? task : task.id;
      const inventory = previous.inventory.filter((item) => item.id !== id);
      if (typeof task !== "string" && task.archivedAt === null && task.deletedAt === null) inventory.push(task);
      return { ...previous, inventory };
    });
  }
  function setTasks(update: SetStateAction<Task[]>) {
    setResult((previous) => {
      if (!previous || previous.key !== key) return previous;
      const tasks = typeof update === "function" ? update(previous.tasks) : update;
      return { ...previous, error: null, tasks };
    });
  }
  return { tasks: current ? result.tasks : [], loading: !current,
    error: current ? result.error : null, inventoryWarning: current ? result.inventoryWarning : null,
    setTasks, observeTask, reload: () => setRevision((previous) => previous + 1), context, scopeKey: key };
}
