import { Temporal } from "@js-temporal/polyfill";
import type { Task } from "./task-types";

// Refresh boundaries only. Membership always comes from the API.
export function nextTaskRefresh(tasks: readonly Task[], timezone: string, now = Date.now()) {
  const instant = Temporal.Instant.fromEpochMilliseconds(now);
  const zones = new Set([timezone, ...tasks.flatMap((task) => task.routineOccurrence ? [task.routineOccurrence.timezone] : [])]);
  let next = Infinity;
  for (const zone of zones) {
    next = Math.min(next, instant.toZonedDateTimeISO(zone).add({ days: 1 }).startOfDay().epochMilliseconds);
  }
  for (const task of tasks) {
    for (const value of [task.plannedAt, task.dueAt]) {
      const timestamp = value === null ? NaN : Date.parse(value);
      if (timestamp > now) next = Math.min(next, timestamp);
    }
  }
  return next;
}
export const MAX_REFRESH_DELAY = 2_147_483_647;
