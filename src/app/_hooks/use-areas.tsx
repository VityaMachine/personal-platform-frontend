"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getAreas, type Area } from "@/lib/areas";

function useAreaDirectory() {
  const [attempt, setAttempt] = useState(0);
  const [taskRevision, setTaskRevision] = useState(0);
  const [result, setResult] = useState<{ attempt: number; areas: Area[]; error: string | null } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    void getAreas(request.signal).then((areas) => {
      if (!request.signal.aborted) setResult({ attempt, areas, error: null });
    }, (error: unknown) => {
      if (!request.signal.aborted) setResult((previous) => ({ attempt, areas: previous?.areas ?? [],
        error: error instanceof Error ? error.message : "Не вдалося завантажити сфери.",
      }));
    });
    return () => request.abort();
  }, [attempt]);

  function commit(area: Area | null, id?: string) {
    // A GET started before a successful write must never replace its result.
    controller.current?.abort();
    setResult((previous) => ({ attempt, error: null,
      areas: area ? [...(previous?.areas ?? []).filter((item) => item.id !== area.id), area]
        : (previous?.areas ?? []).filter((item) => item.id !== id),
    }));
    setAttempt((value) => value + 1);
    if (id) setTaskRevision((value) => value + 1);
  }
  return { areas: result?.areas ?? [], loading: result?.attempt !== attempt,
    error: result?.attempt === attempt ? result.error : null,
    reload: () => setAttempt((value) => value + 1), commit, taskRevision };
}

const AreasContext = createContext<ReturnType<typeof useAreaDirectory> | null>(null);
export function AreasProvider({ children }: { children: ReactNode }) {
  const directory = useAreaDirectory();
  return <AreasContext.Provider value={directory}>{children}</AreasContext.Provider>;
}
export function useAreas() {
  const directory = useContext(AreasContext);
  if (!directory) throw new Error("AreasProvider is required");
  return directory;
}
