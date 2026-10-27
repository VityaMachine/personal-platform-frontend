"use client";
import { useMemo } from "react";
import { taskContext } from "@/modules/tasks/model/task-context";
import { useSettings } from "../../../app/_hooks/use-settings";
export function useTaskContext() {
  const { settings, ready } = useSettings();
  const { timeZone, todayOverdueMode, todayOverdueDays } = settings;
  const context = useMemo(() => taskContext({ timeZone, todayOverdueMode, todayOverdueDays }), [timeZone, todayOverdueMode, todayOverdueDays]);
  return { context, ready };
}
