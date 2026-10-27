"use client";
import { useEffect, useRef, useState } from "react";
import type { RoutineScheduleVersion } from "@/modules/tasks/routines/model/routine-types";
import { getRoutineScheduleVersions, routineError } from "@/modules/tasks/routines/api/routines";

export function useRoutineScheduleVersions(id: string) {
  const [data, setData] = useState<RoutineScheduleVersion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  async function reload() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    try {
      const versions = await getRoutineScheduleVersions(id, controller.signal);
      if (controller.signal.aborted) return null;
      setData(versions); return versions;
    } catch (failure) {
      if (!controller.signal.aborted) setError(routineError(failure));
      return null;
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    void getRoutineScheduleVersions(id, controller.signal).then((versions) => {
      if (!controller.signal.aborted) { setData(versions); setLoading(false); }
    }, (failure: unknown) => {
      if (!controller.signal.aborted) { setError(routineError(failure)); setLoading(false); }
    });
    return () => request.current?.abort();
  }, [id]);
  return { data, loading, error, reload };
}
