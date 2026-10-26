"use client";

import { useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { archiveTask, unarchiveTask, createSubtask, deleteSubtask, deleteTask, getTask, updateSubtask, updateTask, type Task } from "@/lib/tasks";
import type { InitialSubtaskInput, Subtask, SubtaskDetailsChange, SubtaskStatusChange, TaskDetailsChange, TaskStatusChange } from "@/lib/task-types";

import { taskInSection, type TaskContext, type TaskSection } from "@/lib/task-context";

type Scope = { context: TaskContext; scopeKey: string; section: TaskSection; reload: () => void; observeTask: (task: Task | string) => void };

export type TaskMutationState = {
  pending?: "toggle" | "delete" | "archive" | "subtask" | "refresh" | "edit" | "status";
  editing?: boolean;
  statusDialog?: boolean;
  refreshRequired?: boolean;
  error?: string;
  notice?: string;
};

const REFRESH_ERROR = "Зміну збережено, але дані не вдалося оновити. Повторіть завантаження даних.";

export function useTaskMutations(setTasks: Dispatch<SetStateAction<Task[]>>, disabled: boolean, onSubtaskCreated: (id: string) => void, scope: Scope) {
  const latest = useRef({ ...scope, setTasks });
  useLayoutEffect(() => { latest.current = { ...scope, setTasks }; });
  function applyTask(task: Task, requested: Scope) {
    if (latest.current.scopeKey !== requested.scopeKey) { latest.current.reload(); return; }
    latest.current.observeTask(task);
    latest.current.setTasks((previous) => taskInSection(task, requested.section)
      ? previous.some((item) => item.id === task.id) ? previous.map((item) => item.id === task.id ? task : item) : [task, ...previous]
      : previous.filter((item) => item.id !== task.id));
  }
  const [states, setStates] = useState<Record<string, TaskMutationState>>({});
  // Synchronous, per-parent locks also protect against clicks before rerender.
  // A saved change awaiting refresh keeps its lock until GET succeeds.
  const locks = useRef(new Set<string>());
  const refreshing = useRef(new Set<string>());
  const needsRefresh = useRef(new Map<string, string>());
  // Keep this intent through failed GETs; only fresh details reveal the new child.
  const expandAfterRefresh = useRef(new Set<string>());
  const dialogs = useRef(new Map<string, "edit" | "status">());
  const saving = useRef(new Set<string>());

  function setState(id: string, state: TaskMutationState) {
    setStates((previous) => ({ ...previous, [id]: state }));
  }

  async function refresh(id: string, notice: string, refreshError = needsRefresh.current.get(id) ?? REFRESH_ERROR) {
    refreshing.current.add(id);
    needsRefresh.current.set(id, refreshError);
    setState(id, { pending: "refresh", refreshRequired: true });
    try {
      const requested = latest.current;
      const task = await getTask(id, undefined, requested.context);
      applyTask(task, requested);
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

  async function mutate(id: string, pending: "toggle" | "delete" | "archive" | "subtask", action: () => Promise<unknown>, notice: string, refreshError = REFRESH_ERROR) {
    if (disabled || locks.current.has(id)) return false;
    locks.current.add(id);
    setState(id, { pending });
    let result: unknown;
    const requested = scope;
    try {
      result = await action();
    } catch {
      locks.current.delete(id);
      setState(id, { error: "Не вдалося зберегти зміну. Дані залишилися без змін. Спробуйте ще раз." });
      return false;
    }

    if (pending === "delete" || pending === "archive") {
      if (pending === "archive") applyTask(result as Task, requested);
      else if (latest.current.scopeKey !== requested.scopeKey) latest.current.reload();
      else { latest.current.observeTask(id); setTasks((previous) => previous.filter((task) => task.id !== id)); }
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

  function dialogState(kind: "edit" | "status"): TaskMutationState {
    return kind === "edit" ? { editing: true } : { statusDialog: true };
  }

  function beginDialog(id: string, kind: "edit" | "status") {
    if (disabled || locks.current.has(id)) return false;
    locks.current.add(id);
    dialogs.current.set(id, kind);
    setState(id, dialogState(kind));
    return true;
  }

  function endDialog(id: string, kind: "edit" | "status") {
    if (saving.current.has(id) || dialogs.current.get(id) !== kind) return;
    dialogs.current.delete(id);
    locks.current.delete(id);
    setState(id, {});
  }

  async function patchTask(id: string, input: TaskDetailsChange | TaskStatusChange, pending: "edit" | "status" | "toggle", owner?: "edit" | "status") {
    if (disabled || saving.current.has(id) || (owner ? dialogs.current.get(id) !== owner : locks.current.has(id))) return false;
    locks.current.add(id);
    saving.current.add(id);
    setState(id, { ...(owner ? dialogState(owner) : {}), pending });
    try {
      const task = await updateTask(id, input, undefined, scope.context);
      applyTask(task, scope);
      dialogs.current.delete(id);
      locks.current.delete(id);
      setState(id, { notice: pending === "edit" ? "Задачу оновлено." : "Статус задачі змінено." });
      return true;
    } catch {
      if (!owner) locks.current.delete(id);
      setState(id, { ...(owner ? dialogState(owner) : {}), error: "Не вдалося зберегти задачу. Спробуйте ще раз." });
      return false;
    } finally {
      saving.current.delete(id);
    }
  }

  return {
    states,
    hasLockedTasks: Object.values(states).some((state) => state.pending || state.refreshRequired || state.editing || state.statusDialog),
    beginTaskEdit: (id: string) => beginDialog(id, "edit"),
    endTaskEdit: (id: string) => endDialog(id, "edit"),
    editTask: (id: string, input: TaskDetailsChange) => patchTask(id, input, "edit", "edit"),
    beginTaskStatusDialog: (id: string) => beginDialog(id, "status"),
    endTaskStatusDialog: (id: string) => endDialog(id, "status"),
    changeTaskStatus: (task: Task, change: TaskStatusChange) => {
      if (task.status === change.status) return Promise.resolve(true);
      // Omit cancellationNote when leaving CANCELED: the backend retains its history.
      return patchTask(task.id, change, "status", change.status === "CANCELED" || change.status === "POSTPONED" || change.status === "SKIPPED" ? "status" : undefined);
    },
    toggleTask: (task: Task) => task.status === "SKIPPED" ? Promise.resolve(false) : patchTask(task.id, { status: task.status === "DONE" ? "TODO" : "DONE" }, "toggle"),
    deleteTask: (id: string) => mutate(id, "delete", () => deleteTask(id), "Задачу видалено."),
    changeArchived: (task: Task) => mutate(task.id, "archive", () => task.archivedAt ? unarchiveTask(task.id, undefined, scope.context) : archiveTask(task.id, undefined, scope.context), ""),
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
