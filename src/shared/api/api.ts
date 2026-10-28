/** message is safe for UI. Server diagnostics are retained separately. */
export class ApiError extends Error {
  readonly name = "ApiError";

  constructor(
    message: string,
    public readonly status: number,
    public readonly apiMessage?: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

function userMessage(status: number): string {
  switch (status) {
    case 400: return "Перевірте введені дані та спробуйте ще раз.";
    case 401: return "Увійдіть, щоб продовжити.";
    case 403: return "Недостатньо прав для цієї дії.";
    case 404: return "Задачу або підзадачу не знайдено. Оновіть список.";
    case 409: return "Не вдалося зберегти зміни через поточний стан задачі. Оновіть список.";
    case 413: return "Обсяг надісланих даних завеликий.";
    case 429: return "Забагато запитів. Спробуйте пізніше.";
    default: return "Не вдалося виконати запит. Спробуйте ще раз.";
  }
}

async function readJson(response: Response, signal?: AbortSignal): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    return undefined;
  }
}

async function request(path: string, options: RequestInit): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Не налаштовано адресу API. Вкажіть NEXT_PUBLIC_API_URL у .env.local та перезапустіть frontend.");
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, cache: "no-store" });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new Error("Не вдалося з’єднатися з API. Перевірте з’єднання та спробуйте ще раз.");
  }
  if (!response.ok) {
    const body = await readJson(response, options.signal ?? undefined);
    const error = typeof body === "object" && body !== null && "error" in body ? body.error : undefined;
    const record = typeof error === "object" && error !== null ? error : undefined;
    throw new ApiError(
      userMessage(response.status),
      response.status,
      record && "message" in record && typeof record.message === "string" ? record.message : undefined,
      record && "details" in record ? record.details : undefined,
      response.headers.get("X-Request-Id") ?? undefined,
    );
  }
  return response;
}

export async function requestDto<T>(
  path: string,
  validate: (value: unknown) => value is T,
  options: RequestInit = {},
): Promise<T> {
  const response = await request(path, options);
  const data = await readJson(response, options.signal ?? undefined);
  if (!validate(data)) {
    throw new ApiError("API повернув неочікуваний формат даних. Спробуйте оновити список.", response.status,
      undefined, undefined, response.headers.get("X-Request-Id") ?? undefined);
  }
  return data;
}

export async function requestDelete(path: string, signal?: AbortSignal): Promise<void> {
  // DELETE returns 204; never attempt to read a JSON body.
  await request(path, { method: "DELETE", signal });
}

export function jsonRequest(method: "POST" | "PATCH", input: unknown, signal?: AbortSignal): RequestInit {
  return { method, signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) };
}
