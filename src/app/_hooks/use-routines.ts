"use client";
import { useEffect, useRef, useState } from "react";
import { getRoutines, getRoutine, setRoutinePaused, deleteRoutine, routineError } from "@/lib/routines";
import { ApiError } from "@/lib/api";
import type { Routine } from "@/lib/routine-types";

export type RoutineRemovalOutcome = { status: "deleted" | "missing" } | { status: "error"; message: string; uncertain: boolean };
export type RoutineRemovalCheckOutcome = { status: "missing" | "present" } | { status: "error"; message: string };

export function useRoutines(onUpdated: (routine: Routine) => void) {
  const [attempt, setAttempt] = useState(0);
  const attemptRef = useRef(0);
  const [result, setResult] = useState<{ attempt: number; data: Routine[]; error: string | null } | null>(null);
  const [states, setStates] = useState<Record<string, { pending?: boolean; error?: string; notice?: string }>>({});
  const locks = useRef(new Map<string, AbortController>());
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    const startedAt = revision.current;
    void getRoutines(controller.signal).then((data) => {
      if (!controller.signal.aborted && request.current === controller && revision.current === startedAt) setResult({ attempt, data, error: null });
    }, (error: unknown) => {
      if (!controller.signal.aborted && request.current === controller && revision.current === startedAt) setResult({ attempt, data: [], error: routineError(error) });
    });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const active = locks.current;
    return () => { active.forEach((controller) => controller.abort()); active.clear(); };
  }, []);
  function cancelList() { revision.current++; request.current?.abort(); }
  function commitList(update: (data: Routine[]) => Routine[]) {
    cancelList();
    setResult((previous) => ({ attempt: attemptRef.current, error: null, data: update(previous?.data ?? []) }));
  }
  function commitRemoved(id: string) {
    commitList((data) => data.filter((routine) => routine.id !== id));
    setStates((previous) => ({ ...previous, [id]: {} }));
  }
  async function remove(id: string): Promise<RoutineRemovalOutcome | null> {
    if (locks.current.has(id)) return null;
    const controller = new AbortController(); locks.current.set(id, controller);
    setStates((previous) => ({ ...previous, [id]: { pending: true } }));
    try {
      await deleteRoutine(id, controller.signal);
      if (controller.signal.aborted) return null;
      commitRemoved(id);
      return { status: "deleted" };
    } catch (error) {
      if (controller.signal.aborted) return null;
      if (error instanceof ApiError && error.status === 404) { commitRemoved(id); return { status: "missing" }; }
      const uncertain = !(error instanceof ApiError) || error.status >= 500;
      const message = uncertain
        ? "Не вдалося отримати підтвердження видалення. Видалення могло відбутися. Перевірте актуальний список перед наступною дією."
        : `Не вдалося видалити повторення. ${routineError(error)}`;
      setStates((previous) => ({ ...previous, [id]: { error: message } }));
      return { status: "error", message, uncertain };
    } finally { locks.current.delete(id); }
  }
  async function checkRemoval(id: string): Promise<RoutineRemovalCheckOutcome | null> {
    if (locks.current.has(id)) return null;
    const controller = new AbortController(); locks.current.set(id, controller);
    cancelList(); request.current = controller;
    const startedAt = revision.current;
    setStates((previous) => ({ ...previous, [id]: { pending: true } }));
    try {
      const data = await getRoutines(controller.signal);
      if (controller.signal.aborted || request.current !== controller || revision.current !== startedAt) return null;
      commitList(() => data);
      return { status: data.some((routine) => routine.id === id) ? "present" : "missing" };
    } catch (error) {
      if (controller.signal.aborted) return null;
      return { status: "error", message: error instanceof ApiError && error.status < 500 ? routineError(error) : "Не вдалося перевірити актуальний список. Попередній результат видалення залишається невідомим." };
    } finally {
      locks.current.delete(id);
      setStates((previous) => ({ ...previous, [id]: {} }));
    }
  }
  async function toggle(routine: Routine) {
    if (locks.current.has(routine.id)) return null;
    const controller = new AbortController(); locks.current.set(routine.id, controller);
    setStates((previous) => ({ ...previous, [routine.id]: { pending: true } }));
    try {
      const saved = await setRoutinePaused(routine.id, routine.pausedAt === null, controller.signal);
      if (controller.signal.aborted) return null;
      commitList((data) => data.map((item) => item.id === saved.id ? saved : item));
      onUpdated(saved);
      setStates((previous) => ({ ...previous, [saved.id]: { notice: saved.pausedAt ? "Шаблон призупинено." : "Шаблон відновлено." } }));
      return saved;
    } catch (error) {
      if (!controller.signal.aborted) setStates((previous) => ({ ...previous, [routine.id]: { error: `Не вдалося змінити паузу. ${routineError(error)}` } }));
      return null;
    } finally { locks.current.delete(routine.id); }
  }
  const current = result?.attempt === attempt;
  return { routines: current ? result.data : [], error: current ? result.error : null, loading: !current,
    addCreated: (routine: Routine) => {
      commitList((data) => [routine, ...data.filter((item) => item.id !== routine.id)]);
    },
    commitUpdated: (routine: Routine) => {
      commitList((data) => data.map((item) => item.id === routine.id ? routine : item));
      setStates((previous) => ({ ...previous, [routine.id]: {} }));
      onUpdated(routine);
    },
    states, toggle, remove, checkRemoval, isLocked: (id: string) => locks.current.has(id), pending: Object.values(states).some((state) => state.pending),
    reload: () => { cancelList(); setAttempt(++attemptRef.current); } };
}

export function useRoutineDetails(id: string, replacement?: Routine) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ id: string; attempt: number; data: Routine | null; error: string | null } | null>(null);
  useEffect(() => {
    if (replacement) return;
    const controller = new AbortController();
    void getRoutine(id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ id, attempt, data, error: null });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setResult({ id, attempt, data: null, error: routineError(error) });
    });
    return () => controller.abort();
  }, [id, attempt, replacement]);
  const current = result?.id === id && result.attempt === attempt;
  return { data: replacement ?? (current ? result.data : null), error: replacement ? null : current ? result.error : null,
    loading: !replacement && !current, retry: () => setAttempt((value) => value + 1) };
}
