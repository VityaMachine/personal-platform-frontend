"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getTask, getTaskHistory } from "@/lib/tasks";

import { useTaskContext } from "./use-task-context";

type Result<T> = { taskId: string; attempt: number } & (
  | { data: T; error: null }
  | { data: null; error: string }
);

function useDetailsResource<T>(taskId: string, load: (id: string, signal: AbortSignal) => Promise<T>, contextKey = "", ready = true) {
  const [attempt, setAttempt] = useState(0);
  const resourceId = `${taskId}:${contextKey}`;
  const [scope, setScope] = useState({ taskId: resourceId, attempt });
  const [result, setResult] = useState<Result<T> | null>(null);
  // Hide previous content before committing a different ID or retry.
  if (scope.taskId !== resourceId || scope.attempt !== attempt) {
    setScope({ taskId: resourceId, attempt });
    setResult(null);
  }
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void load(taskId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ taskId: resourceId, attempt, data, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ taskId: resourceId, attempt, data: null,
          error: error instanceof ApiError && error.status === 404
            ? "Задачу не знайдено. Можливо, її вже видалено."
            : error instanceof Error ? error.message : "Не вдалося завантажити дані. Спробуйте ще раз.",
        });
      },
    );
    return () => controller.abort();
  }, [taskId, resourceId, attempt, load, ready]);

  const current = result?.taskId === resourceId && result.attempt === attempt;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    retry: () => setAttempt((previous) => previous + 1),
  };
}

export function useTaskDetails(taskId: string) {
  const { context, ready } = useTaskContext();
  const load = useCallback((id: string, signal: AbortSignal) => getTask(id, signal, context), [context]);
  const task = useDetailsResource(taskId, load, JSON.stringify(context), ready);
  const history = useDetailsResource(taskId, getTaskHistory);
  return { task, history };
}
