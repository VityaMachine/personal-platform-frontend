"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createHistoryTraversalGuard, type TraversalAttempt } from "@/lib/history-traversal-guard";

const Context = createContext<ReturnType<typeof createHistoryTraversalGuard> | null>(null);

export function HistoryTraversalProvider({ children }: { children: ReactNode }) {
  const [guard] = useState(createHistoryTraversalGuard);
  useLayoutEffect(() => guard.start(window), [guard]);
  return <Context.Provider value={guard}>{children}</Context.Provider>;
}

export function useHistoryTraversalGuard(dirty: boolean, confirm: (attempt: TraversalAttempt) => boolean) {
  const guard = useContext(Context);
  const latest = useRef({ dirty, confirm });
  useLayoutEffect(() => { latest.current = { dirty, confirm }; });
  useLayoutEffect(() => guard?.register({
    shouldBlock: () => latest.current.dirty,
    confirm: (attempt) => latest.current.confirm(attempt),
  }), [guard]);
}
