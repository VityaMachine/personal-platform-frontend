import { ApiError } from "../../../shared/api/api";

export type TaskRemovalOutcome = { status: "deleted" | "missing" } | { status: "error"; message: string; uncertain: boolean };
export type TaskRemovalCheckOutcome = { status: "missing" | "present" } | { status: "error"; message: string };

export function taskRemovalError(error: unknown): Extract<TaskRemovalOutcome, { status: "error" }> {
  const uncertain = !(error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408);
  return { status: "error", uncertain, message: uncertain
    ? "Немає підтвердження видалення. Запит міг виконатися. Перевірте актуальний стан задачі перед повторним підтвердженням."
    : "Не вдалося видалити задачу. " + error.message };
}
