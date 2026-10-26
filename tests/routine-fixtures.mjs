export const routineId = "11111111-1111-4111-8111-111111111111";
export const taskId = "22222222-2222-4222-8222-222222222222";
export const configuration = {
  timezone: "Europe/Kyiv", startDate: "2026-01-01",
  schedule: { version: 1, localTime: "09:00", recurrence: { type: "DAILY", intervalDays: 1 } }, endCondition: { type: "NEVER" },
};
export const routine = {
  id: routineId, title: "Mock Routine", description: null, priority: "MEDIUM", areaId: null, area: null,
  estimatedDurationMinutes: 30, subtasks: [], ...configuration, pausedAt: null, deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};
export function version(number, effectiveDate, effectiveAt, calendar = configuration) {
  return { ...calendar, id: `33333333-3333-4333-8333-${String(number).padStart(12, "0")}`, routineId, number,
    effectiveDate, effectiveAt, effectiveTimezone: "Europe/Kyiv", createdAt: "2026-01-01T00:00:00.000Z" };
}
export const versions = [version(1, "2026-01-01", "2025-12-31T22:00:00.000Z"),
  version(2, "2026-10-01", "2026-09-30T21:00:00.000Z"), version(3, "2090-11-01", "2090-10-31T22:00:00.000Z")];
export const range = { from: "2090-11-01", to: "2090-11-05" };
export const occurrence = { occurrenceKey: "new:schedule:3", startDate: range.from, endDate: range.from, timezone: "Europe/Kyiv",
  localTime: "09:00", instant: "2090-11-01T07:00:00.000Z", diagnostics: [], existing: false,
  basisType: null, basisAt: null, basisCompletedAt: null };
export const existing = { ...occurrence, occurrenceKey: "stored-future", existing: true };
export const conflict = { code: "STORED_WINDOW_CONFLICT", occurrenceKey: "suppressed:schedule:3", retainedOccurrenceKey: existing.occurrenceKey, retainedTaskId: taskId };
export const generationPreview = { routineId, timezone: "Europe/Kyiv", ...range, occurrences: [occurrence, existing], conflicts: [conflict] };
export const generationResult = { routineId, ...range, createdCount: 1, existingCount: 1,
  created: [{ occurrenceKey: occurrence.occurrenceKey, taskId: "44444444-4444-4444-8444-444444444444" }],
  existing: [{ occurrenceKey: existing.occurrenceKey, taskId }], conflicts: [conflict] };
export const futureTask = {
  ...routine, id: taskId, status: "TODO", cancellationNote: null, skipNote: null, skippedAt: null, completedAt: null,
  isCompleted: false, isToday: false, isBacklog: false, plannedAt: "2090-11-01T08:00:00.000Z", dueAt: null, archivedAt: null,
  routineOccurrence: { ...existing, id: "55555555-5555-4555-8555-555555555555", routineId,
    scheduleVersionId: versions[0].id, occurrenceNumber: null, previousOccurrenceId: null },
  summary: { asOf: "2026-10-26T12:00:00.000Z", ageSeconds: 1, inProgressSeconds: 0, timeToCompletionSeconds: null,
    statusDurationsSeconds: { TODO: 1, IN_PROGRESS: 0, PAUSED: 0, POSTPONED: 0 }, historyIncomplete: false, historyIssues: [] },
};
