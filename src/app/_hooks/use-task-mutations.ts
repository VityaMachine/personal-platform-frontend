"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createSubtask, deleteSubtask, deleteTask, getTask, setTaskCompleted, updateSubtask, type Task } from "@/lib/tasks";
import type { InitialSubtaskInput, Subtask, SubtaskDetailsChange, SubtaskStatusChange } from "@/lib/task-types";

export type TaskMutationState = {
  pending?: "toggle" | "delete" | "subtask" | "refresh";
  refreshRequired?: boolean;
  error?: string;
  notice?: string;
};

const REFRESH_ERROR = "Зміну збережено, але дані не вдалося оновити. Повторіть завантаження даних.";

export function useTaskMutations(setTasks: Dispatch<SetStateAction<Task[]>>, disabled: boolean, onSubtaskCreated: (id: string) => void) {
  const [states, setStates] = useState<Record<string, TaskMutationState>>({});
  // Synchronous, per-parent locks also protect against clicks before rerender.
  // A saved change awaiting refresh keeps its lock until GET succeeds.
  const locks = useRef(new Set<string>());
  const refreshing = useRef(new Set<string>());
  const needsRefresh = useRef(new Map<string, string>());
  // Keep this intent through failed GETs; only fresh details reveal the new child.
  const expandAfterRefresh = useRef(new Set<string>());

  function setState(id: string, state: TaskMutationState) {
    setStates((previous) => ({ ...previous, [id]: state }));
  }

  async function refresh(id: string, notice: string, refreshError = needsRefresh.current.get(id) ?? REFRESH_ERROR) {
    refreshing.current.add(id);
    needsRefresh.current.set(id, refreshError);
    setState(id, { pending: "refresh", refreshRequired: true });
    try {
      const task = await getTask(id);
      setTasks((previous) => previous.map((item) => item.id === id ? task : item));
      if (expandAfterRefresh.current.delete(id)) onSubtaskCreated(id);
      needsRefresh.current.delete(id);
      locks.current.delete(id);
      setState(id, { notice });
    } catch {
      setState(id, { refreshRequired: true, error: refreshError });
    } finally {
      refreshing.current.delete(id);
    }
  }

  async function mutate(id: string, pending: "toggle" | "delete" | "subtask", action: () => Promise<unknown>, notice: string, refreshError = REFRESH_ERROR) {
    if (disabled || locks.current.has(id)) return false;
    locks.current.add(id);
    setState(id, { pending });
    try {
      await action();
    } catch {
      locks.current.delete(id);
      setState(id, { error: "Не вдалося зберегти зміну. Дані залишилися без змін. Спробуйте ще раз." });
      return false;
    }

    if (pending === "delete") {
      setTasks((previous) => previous.filter((task) => task.id !== id));
      locks.current.delete(id);
      setStates((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      return true;
    }
    await refresh(id, notice, refreshError);
    // The mutation succeeded even when refresh failed: callers must not resend it.
    return true;
  }

  return {
    states,
    hasLockedTasks: Object.values(states).some((state) => state.pending || state.refreshRequired),
    toggleTask: (task: Task) => mutate(task.id, "toggle", () => setTaskCompleted(task.id, task.status !== "DONE"), task.status === "DONE" ? "Задачу відкрито повторно." : "Задачу завершено."),
    deleteTask: (id: string) => mutate(id, "delete", () => deleteTask(id), "Задачу видалено."),
    changeSubtaskStatus: async (taskId: string, subtask: Subtask, change: SubtaskStatusChange) => {
      if (subtask.status === change.status) return true;
      // Omit cancellationNote when reopening; the backend retains its history.
      return mutate(taskId, "subtask", () => updateSubtask(taskId, subtask.id, change), "Статус підзадачі змінено.");
    },
    editSubtask: (taskId: string, subtaskId: string, change: SubtaskDetailsChange) =>
      mutate(taskId, "subtask", () => updateSubtask(taskId, subtaskId, change), "Підзадачу оновлено."),
    createSubtask: (taskId: string, input: InitialSubtaskInput) =>
      mutate(taskId, "subtask", async () => {
        await createSubtask(taskId, input);
        expandAfterRefresh.current.add(taskId);
      }, "Підзадачу додано.", "Підзадачу додано, але дані не вдалося оновити. Повторіть завантаження даних."),
    deleteSubtask: (taskId: string, subtaskId: string) =>
      mutate(taskId, "subtask", () => deleteSubtask(taskId, subtaskId), "Підзадачу видалено.",
        "Підзадачу видалено, але дані не вдалося оновити. Повторіть завантаження даних."),
    retryRefresh: async (id: string) => {
      if (disabled || !needsRefresh.current.has(id) || refreshing.current.has(id)) return;
      await refresh(id, "Дані задачі оновлено.");
    },
  };
}
