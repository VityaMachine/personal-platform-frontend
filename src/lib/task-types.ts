export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "PAUSED", "POSTPONED", "DONE", "CANCELED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

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

export type Task = {
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
};

/** Titles: trimmed, 1–160 chars. Durations: positive int32 minutes.
 * Input dates must include a timezone. Omission uses defaults on creation and
 * preserves existing values on update; null clears only explicitly nullable fields.
 */
export type CreateTaskInput = {
  title: string;
  description?: string | null;
  plannedAt?: string;
  priority?: TaskPriority;
  dueAt: string;
  estimatedDurationMinutes: number;
};

type StatusInput =
  | { status: "CANCELED"; cancellationNote: string }
  | { status?: Exclude<TaskStatus, "CANCELED">; cancellationNote?: string };

type AtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>> }[keyof T];

type TaskChanges = {
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
