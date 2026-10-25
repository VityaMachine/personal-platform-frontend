"use client";
import { useMemo } from "react";
import { taskContext } from "@/lib/task-context";
import { useSettings } from "./use-settings";
export function useTaskContext() {
  const { settings, ready } = useSettings();
  const { timeZone, todayOverdueMode, todayOverdueDays } = settings;
  const context = useMemo(() => taskContext({ timeZone, todayOverdueMode, todayOverdueDays }), [timeZone, todayOverdueMode, todayOverdueDays]);
  return { context, ready };
}
