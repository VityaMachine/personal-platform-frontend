"use client";

import { useEffect, useState, type SetStateAction } from "react";
import { getArchivedTasks, getTasks, type Task } from "@/lib/tasks";

export function useTaskList(archived: boolean) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    archived: boolean;
    revision: number;
    tasks: Task[];
    error: string | null;
  } | null>(null);
  const [scope, setScope] = useState({ archived, revision });
  if (scope.archived !== archived || scope.revision !== revision) {
    setScope({ archived, revision });
    setResult(null);
  }
  const current = result?.archived === archived && result.revision === revision;

  useEffect(() => {
    const controller = new AbortController();
    const load = archived ? getArchivedTasks : getTasks;
    void load(controller.signal).then(
      (tasks) => {
        if (!controller.signal.aborted) setResult({ archived, revision, tasks, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({
          archived, revision, tasks: [],
          error: error instanceof Error ? error.message : "Не вдалося завантажити задачі.",
        });
      },
    );
    return () => controller.abort();
  }, [archived, revision]);

  function setTasks(update: SetStateAction<Task[]>) {
    setResult((previous) => {
      if (!previous || previous.archived !== archived || previous.revision !== revision) return previous;
      return { ...previous, error: null, tasks: typeof update === "function" ? update(previous.tasks) : update };
    });
  }

  return {
    tasks: current ? result.tasks : [],
    loading: !current,
    error: current ? result.error : null,
    setTasks,
    reload: () => setRevision((previous) => previous + 1),
  };
}
