export type Task = {
  id: string | number;
  title: string;
  description?: string | null;
  isCompleted: boolean;
};

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Не налаштовано адресу API. Вкажіть NEXT_PUBLIC_API_URL у .env.local та перезапустіть frontend.");
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, cache: "no-store" });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error("Не вдалося з’єднатися з API. Перевірте з’єднання та спробуйте ще раз.");
  }
  if (!response.ok) throw new Error(`API повернув помилку (${response.status}). Спробуйте ще раз.`);
  return response;
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return (typeof task.id === "string" || typeof task.id === "number")
    && typeof task.title === "string"
    && typeof task.isCompleted === "boolean"
    && (task.description == null || typeof task.description === "string");
}

export async function getTasks(signal?: AbortSignal): Promise<Task[]> {
  const response = await request("/tasks", { signal });
  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data) || !data.every(isTask)) throw new Error("API повернув неочікуваний формат списку задач.");
  return data;
}

export async function createTask(task: { title: string; description?: string }): Promise<void> {
  await request("/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(task) });
}

export async function setTaskCompleted(id: Task["id"], isCompleted: boolean): Promise<void> {
  await request(`/tasks/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isCompleted }) });
}

export async function deleteTask(id: Task["id"]): Promise<void> {
  await request(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
