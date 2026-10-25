"use client";
import { useEffect, useState, type SetStateAction } from "react";
import { getArchivedTasks, getTasks, getTodayTasks, type Task } from "@/lib/tasks";
import { taskContextQuery, type TaskSection } from "@/lib/task-context";
import { useTaskContext } from "./use-task-context";

export function calendarSignature(timezones: string[], now = new Date()) {
  return timezones.map((timeZone) => new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now)).join("|");
}
export function useTaskList(section: TaskSection, areaRevision = 0) {
  const { context, ready } = useTaskContext();
  const [revision, setRevision] = useState(0);
  const key = section + ":" + taskContextQuery(context) + ":" + areaRevision + ":" + revision;
  const [result, setResult] = useState<{ key: string; tasks: Task[]; timezones: string[]; error: string | null } | null>(null);
  const current = ready && result?.key === key;
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const load = section === "archive" ? getArchivedTasks : section === "today" ? getTodayTasks : getTasks;
    // Today omits future occurrences. Read the current inventory as well so
    // calendar checks include their zones, without watching unrelated IANA zones
    // or reimplementing the backend's selection rules.
    const inventory = section === "today" ? getTasks(controller.signal, context) : null;
    void Promise.all([load(controller.signal, context), inventory]).then(
      ([tasks, allTasks]) => {
        const timezones = [...new Set([context.timezone, ...(allTasks ?? tasks).flatMap((task) => task.routineOccurrence ? [task.routineOccurrence.timezone] : [])])];
        if (!controller.signal.aborted) setResult({ key, tasks, timezones, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, tasks: [], timezones: [context.timezone],
          error: error instanceof Error ? error.message : "Не вдалося завантажити задачі.",
        });
      },
    );
    return () => controller.abort();
  }, [key, ready, section, context]);
  useEffect(() => {
    if (!ready) return;
    const watched = result?.key === key ? result.timezones : [context.timezone];
    let signature = calendarSignature(watched);
    const check = () => {
      if (document.visibilityState === "hidden") return;
      const next = calendarSignature(watched);
      if (next !== signature) { signature = next; setRevision((value) => value + 1); }
    };
    const timer = window.setInterval(check, 300_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [key, context, ready, result]);
  function setTasks(update: SetStateAction<Task[]>) {
    setResult((previous) => {
      if (!previous || previous.key !== key) return previous;
      const tasks = typeof update === "function" ? update(previous.tasks) : update;
      const timezones = [...new Set([...previous.timezones, ...tasks.flatMap((task) => task.routineOccurrence ? [task.routineOccurrence.timezone] : [])])];
      return { ...previous, error: null, tasks, timezones };
    });
  }
  return { tasks: current ? result.tasks : [], loading: !current,
    error: current ? result.error : null, setTasks,
    reload: () => setRevision((previous) => previous + 1), context, scopeKey: key };
}
