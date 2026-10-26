import type { AreaReference } from "./area-types";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "PAUSED", "POSTPONED", "DONE", "CANCELED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type PostponeTaskChange = { status: "POSTPONED"; plannedAt: string | null; dueAt?: string | null };
export type TaskStatusChange =
  | { status: Exclude<TaskStatus, "CANCELED" | "POSTPONED"> }
  | { status: "CANCELED"; cancellationNote: string }
  | PostponeTaskChange;
export type SubtaskStatusChange =
  | { status: Exclude<TaskStatus, "CANCELED"> }
  | { status: "CANCELED"; cancellationNote: string };
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TIME_STATUSES = ["TODO", "IN_PROGRESS", "PAUSED", "POSTPONED"] as const;
export type TaskSummary = {
  asOf: string;
  ageSeconds: number | null;
  inProgressSeconds: number | null;
  timeToCompletionSeconds: number | null;
  statusDurationsSeconds: Record<(typeof TASK_TIME_STATUSES)[number], number | null>;
  historyIncomplete: boolean;
  historyIssues: string[];
};

/** JSON timestamps are ISO 8601 strings, never Date objects. */
export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  estimatedDurationMinutes: number;
  cancellationNote: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type RoutineOccurrence = {
  id: string;
  routineId: string;
  occurrenceKey: string;
  startDate: string;
  endDate: string;
  timezone: string;
  localTime: string | null;
  instant: string | null;
  occurrenceNumber: number | null;
  previousOccurrenceId: string | null;
  basisCompletedAt: string | null;
};

export type Task = {
  isToday: boolean;
  isBacklog: boolean;
  /** Verified current completion from the backend; never inferred locally. */
  completedAt: string | null;
  routineOccurrence: RoutineOccurrence | null;
  areaId: string | null;
  area: AreaReference | null;
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  plannedAt: string | null;
  dueAt: string | null;
  estimatedDurationMinutes: number;
  cancellationNote: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Compatibility field supplied by the mapper: status === "DONE". */
  isCompleted: boolean;
  subtasks: Subtask[];
  summary: TaskSummary;
};

/** History metadata is JSON with partial before/after snapshots. Older or
 * future events may omit it or have an unknown shape; inspect before use. */
export type TaskHistoryEvent = {
  id: string;
  taskId: string;
  type: string;
  timestamp: string;
  metadata?: unknown;
};

/** Titles: trimmed, 1–160 chars. Durations: positive int32 minutes.
 * Input dates must include a timezone. Omission uses defaults on creation and
 * preserves existing values on update; null clears only explicitly nullable fields.
 */
export type InitialSubtaskInput = {
  title: string;
  estimatedDurationMinutes: number;
};

export type CreateTaskInput = {
  areaId?: string | null;
  title: string;
  description?: string | null;
  plannedAt?: string;
  priority?: TaskPriority;
  dueAt: string;
} & (
  | { estimatedDurationMinutes: number; subtasks?: never }
  | { estimatedDurationMinutes?: never; subtasks: [InitialSubtaskInput, ...InitialSubtaskInput[]] }
);

type StatusInput =
  | { status: "CANCELED"; cancellationNote: string }
  | { status?: Exclude<TaskStatus, "CANCELED">; cancellationNote?: string };

type AtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>> }[keyof T];

export type SubtaskDetailsChange = AtLeastOne<Pick<Subtask, "title" | "estimatedDurationMinutes">>;

export type TaskDetailsChange = AtLeastOne<Pick<Task, "areaId" | "title" | "description" | "priority" | "plannedAt" | "dueAt" | "estimatedDurationMinutes">>;

type TaskChanges = {
  areaId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  plannedAt: string | null;
  dueAt: string | null;
  estimatedDurationMinutes: number;
  cancellationNote: string;
  archived: boolean;
};

/** Nonempty PATCH. CANCELED requires a trimmed, nonempty note.
 * Legacy isCompleted maps true → DONE, false → TODO; never combine with status.
 * Duration cannot be edited while the task has subtasks (409).
 * Entering POSTPONED without plannedAt clears plannedAt on the backend.
 */
export type UpdateTaskInput = Partial<TaskChanges> & (
  | (StatusInput & { status: TaskStatus; isCompleted?: never })
  | { isCompleted: boolean; status?: never }
  | (AtLeastOne<TaskChanges> & { status?: never; isCompleted?: never })
);

/** Omitted status defaults to TODO. Notes cannot be null or blank. */
export type CreateSubtaskInput = {
  title: string;
  estimatedDurationMinutes: number;
} & StatusInput;

type SubtaskChanges = {
  title: string;
  estimatedDurationMinutes: number;
  cancellationNote: string;
};

/** Subtask writes on archived tasks return 409 and may update parent status/duration. */
export type UpdateSubtaskInput = Partial<SubtaskChanges> & (
  | (StatusInput & { status: TaskStatus })
  | (AtLeastOne<SubtaskChanges> & { status?: never })
);
