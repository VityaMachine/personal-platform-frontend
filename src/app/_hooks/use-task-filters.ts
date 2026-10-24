"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_TASK_FILTERS, parseTaskFilters, sameTaskFilters, serializeTaskFilters, type TaskFilters } from "@/lib/task-filters";

export function useTaskFilters(blocked: boolean) {
  const params = useSearchParams();
  const requested = params.toString();
  const [applied, setApplied] = useState(requested);
  // Next.js integrates native history with useSearchParams. Ignore intermediate
  // router renders while typing quickly, and defer history changes behind forms.
  if (!blocked && requested !== applied && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).toString() === requested) {
    setApplied(requested);
  }
  const filters = parseTaskFilters(new URLSearchParams(applied));

  function navigate(next: TaskFilters | Partial<TaskFilters>, reset = false) {
    if (blocked || document.querySelector("dialog[open]")) return;
    const current = new URLSearchParams(window.location.search);
    const value = reset ? DEFAULT_TASK_FILTERS : { ...parseTaskFilters(current), ...next };
    const query = serializeTaskFilters(current, value).toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (query !== current.toString()) {
      // Native history updates do not scroll or request server data. Search uses
      // replace so each letter does not create a browser-history entry.
      if (!reset && "q" in next) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    }
    setApplied(query);
  }
  return { filters, change: (next: Partial<TaskFilters>) => navigate(next),
    reset: () => navigate(DEFAULT_TASK_FILTERS, true),
    deferred: blocked && !sameTaskFilters(filters, parseTaskFilters(new URLSearchParams(requested))) };
}
