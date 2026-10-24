"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getTask, getTaskHistory } from "@/lib/tasks";

type Result<T> = { taskId: string; attempt: number } & (
  | { data: T; error: null }
  | { data: null; error: string }
);

function useDetailsResource<T>(taskId: string, load: (id: string, signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState({ taskId, attempt });
  const [result, setResult] = useState<Result<T> | null>(null);
  // Hide previous content before committing a different ID or retry.
  if (scope.taskId !== taskId || scope.attempt !== attempt) {
    setScope({ taskId, attempt });
    setResult(null);
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(taskId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ taskId, attempt, data, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ taskId, attempt, data: null,
          error: error instanceof ApiError && error.status === 404
            ? "Задачу не знайдено. Можливо, її вже видалено."
            : error instanceof Error ? error.message : "Не вдалося завантажити дані. Спробуйте ще раз.",
        });
      },
    );
    return () => controller.abort();
  }, [taskId, attempt, load]);

  const current = result?.taskId === taskId && result.attempt === attempt;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    retry: () => setAttempt((previous) => previous + 1),
  };
}

export function useTaskDetails(taskId: string) {
  const task = useDetailsResource(taskId, getTask);
  const history = useDetailsResource(taskId, getTaskHistory);
  return { task, history };
}
