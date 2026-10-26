import type { AreaReference } from "./area-types";
import type { TaskPriority } from "./task-types";

export type WeeklySelection = { type: "DAYS"; weekdays: number[] }
  | { type: "WINDOW"; startWeekday: number; endWeekday: number };
export type MonthlySelection = { type: "DAY"; day: number; shortMonthPolicy: "SKIP" | "CLAMP" }
  | { type: "WINDOW"; startDay: number; endDay: number; shortMonthPolicy: "SKIP" | "CLAMP" }
  | { type: "LAST_DAY" };
export type RoutineSchedule = {
  version: 1;
  localTime: string | null;
  recurrence: { type: "DAILY"; intervalDays: number }
    | { type: "AFTER_COMPLETION"; intervalDays: number }
    | { type: "WEEKLY"; intervalWeeks: number; selection: WeeklySelection }
    | { type: "MONTHLY"; intervalMonths: number; selection: MonthlySelection };
};
export type RoutineEndCondition = { type: "NEVER" } | { type: "UNTIL_DATE"; date: string } | { type: "COUNT"; count: number };
export type RoutineSubtask = { id: string; routineId: string; title: string; estimatedDurationMinutes: number; position: number };
export type Routine = {
  id: string; title: string; description: string | null; priority: TaskPriority;
  areaId: string | null; area: AreaReference | null; estimatedDurationMinutes: number;
  subtasks: RoutineSubtask[]; timezone: string; startDate: string; schedule: RoutineSchedule;
  endCondition: RoutineEndCondition; pausedAt: string | null; deletedAt: string | null;
  createdAt: string; updatedAt: string;
};
export type RoutinePreviewOccurrence = {
  occurrenceKey: string; startDate: string; endDate: string; timezone: string;
  localTime: string | null; instant: string | null; diagnostics: string[];
};
export type RoutinePreview = {
  routineId: string; timezone: string; from: string; to: string;
  occurrences: RoutinePreviewOccurrence[]; truncated: boolean; limitations: string[];
};
export type RoutinePreviewRange = { from: string; to: string };
export type RoutinePlanningInput = { occurrenceKey: string; plannedAt: string };
export type GenerateRoutineInput = { from: string; to: string; planning?: RoutinePlanningInput[] };
export type RoutineGenerationOccurrence = RoutinePreviewOccurrence & { existing: boolean };
export type RoutineGenerationPreview = {
  routineId: string; timezone: string; from: string; to: string; occurrences: RoutineGenerationOccurrence[];
};
export type RoutineGenerationLink = { occurrenceKey: string; taskId: string };
export type RoutineGenerationResult = {
  routineId: string; from: string; to: string; createdCount: number; existingCount: number;
  created: RoutineGenerationLink[]; existing: RoutineGenerationLink[];
};

type RoutineSubtaskInput = { title: string; estimatedDurationMinutes: number };
/** Editable template fields only. Pause/resume uses its dedicated wrapper. */
export type UpdateRoutineInput = Partial<Pick<Routine, "title" | "description" | "priority" | "areaId" | "estimatedDurationMinutes" | "timezone" | "startDate" | "schedule" | "endCondition">> & {
  subtasks?: RoutineSubtaskInput[];
};
export type CreateRoutineInput = {
  title: string; description?: string | null; priority?: TaskPriority; areaId?: string | null;
  timezone: string; startDate: string; schedule: RoutineSchedule; endCondition?: RoutineEndCondition;
} & (
  | { estimatedDurationMinutes: number; subtasks?: RoutineSubtaskInput[] }
  | { estimatedDurationMinutes?: never; subtasks: [RoutineSubtaskInput, ...RoutineSubtaskInput[]] }
);
