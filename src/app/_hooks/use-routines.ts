"use client";
import { useEffect, useRef, useState } from "react";
import { getRoutines, getRoutine, setRoutinePaused, routineError } from "@/lib/routines";
import type { Routine } from "@/lib/routine-types";

export function useRoutines(onUpdated: (routine: Routine) => void) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; data: Routine[]; error: string | null } | null>(null);
  const [states, setStates] = useState<Record<string, { pending?: boolean; error?: string; notice?: string }>>({});
  const locks = useRef(new Map<string, AbortController>());
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    void getRoutines(controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ attempt, data, error: null });
    }, (error: unknown) => {
      if (!controller.signal.aborted) setResult({ attempt, data: [], error: routineError(error) });
    });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const active = locks.current;
    return () => { active.forEach((controller) => controller.abort()); active.clear(); };
  }, []);
  async function toggle(routine: Routine) {
    if (locks.current.has(routine.id)) return null;
    const controller = new AbortController(); locks.current.set(routine.id, controller);
    setStates((previous) => ({ ...previous, [routine.id]: { pending: true } }));
    try {
      const saved = await setRoutinePaused(routine.id, routine.pausedAt === null, controller.signal);
      if (controller.signal.aborted) return null;
      request.current?.abort();
      setResult((previous) => previous ? { ...previous, data: previous.data.map((item) => item.id === saved.id ? saved : item) } : previous);
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
    states, toggle, pending: Object.values(states).some((state) => state.pending), reload: () => setAttempt((value) => value + 1) };
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
