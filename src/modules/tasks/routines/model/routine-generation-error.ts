import { ApiError } from "../../../../lib/api";

export const GENERATION_UNCERTAIN_MESSAGE = "Не вдалося отримати результат. Запит міг виконатися. Повторний запуск за тим самим діапазоном не створить дублікатів";
const known: Record<string, string> = {
  "Invalid task data.": "Перевірте локальні дати й діапазон: максимум 366 днів включно.",
  "Planning contains an occurrence not available for this Routine and range. Refresh generation-preview and retry.": "Планування застаріло: виконання більше не доступне для цього шаблону й діапазону. Оновіть виконання, перевірте планування та повторіть створення явно.",
  "AFTER_COMPLETION planning accepts at most one occurrence.": "Для повторення після завершення або пропуску можна запланувати максимум одне нове виконання. Оновіть виконання та перевірте планування.",
  "Routine not found.": "Повторювану задачу не знайдено. Можливо, шаблон уже видалено.",
  "Area not found.": "Сферу шаблону не знайдено. Оновіть дані повторення перед новим запуском.",
  "Routine is paused. Resume it before generation.": "Повторення на паузі. Спочатку відновіть його, потім запустіть створення задач.",
  "The latest Task is not DONE. The completion chain is waiting for its completion.": "Попередню задачу ще не завершено. Наступне виконання залежить від її фактичного DONE.",
  "The latest Task is not DONE or SKIPPED. The completion chain is waiting for its result.": "Попередню задачу ще не завершено й не пропущено. Наступне виконання очікує на її фактичний результат.",
  "The latest Task is deleted. The completion chain is stopped; Tasks are not replaced.": "Попередню задачу видалено. Ланцюжок повторення зупинено; заміна автоматично не створюється.",
  "The latest Task is canceled. The completion chain is stopped.": "Попередню задачу скасовано. Ланцюжок повторення зупинено.",
  "Generation would create more than 100 new Tasks. Request a smaller range.": "Запит створив би понад 100 нових задач. Звузьте діапазон; часткова генерація не виконується.",
  "Routine has unresolved DST local times. No Tasks were generated.": "У розкладі є неоднозначний або неіснуючий локальний час через DST. Сервер відхилив генерацію.",
  "Routine has unresolved DST local times. No Task was generated.": "Локальний час виконання неоднозначний або не існує через DST. Сервер відхилив генерацію.",
  "Calendar configuration cannot change after generation. Create a new Routine; existing occurrences and Tasks are immutable snapshots.": "Розклад уже використовувався для створення задач. Його змінювати не можна; наявні виконання зберігають початкові налаштування.",
  "Requested occurrences start on or before the latest calendar configuration change. Generate only windows starting after that local date.": "Вікно починається до або в день останньої зміни розкладу. Виберіть період із пізнішим початком виконань.",
  "Occurrence starts on or before the latest configuration change. Generation requires a later start.": "Виконання починається до або в день останньої зміни розкладу. Для генерації потрібен пізніший початок.",
  "Routine changed concurrently. Retry the request.": "Шаблон одночасно змінювався. Перевірте його стан і повторіть запуск явно.",
  "The completion occurrence falls in a past pause. A separate decision is required; its date is not shifted or skipped.": "Наступне виконання припадає на минулу паузу. Його дата не переноситься автоматично; потрібне окреме рішення.",
};
export function routineGenerationFailure(error: unknown): { message: string; uncertain: boolean } {
  // Missing response, 5xx, or an invalid success DTO cannot establish whether a write committed.
  if (!(error instanceof ApiError) || error.status < 400 || error.status >= 500) return { message: GENERATION_UNCERTAIN_MESSAGE, uncertain: true };
  if (![400, 404, 409].includes(error.status)) return { message: error.message, uncertain: false };
  const message = error.apiMessage;
  if (message && Object.hasOwn(known, message)) return { message: known[message], uncertain: false };
  if (error.status === 409 && message) {
    if (/COUNT_HISTORY_UNCERTAIN|PAUSE_HISTORY_UNCERTAIN/i.test(message)) return { message: "Історія пауз або підрахунок запланованих виконань недостовірні. Сервер відхилив генерацію; потрібна перевірка історії повторення.", uncertain: false };
    if (/CALENDAR_RANGE_EXCEEDED|outside the supported calendar|Completion precedes Routine startDate/i.test(message)) return { message: "Дата наступного виконання виходить за підтримуваний календар або передує початку повторення. Сервер відхилив генерацію.", uncertain: false };
    if (/budget|cannot be generated completely/i.test(message)) return { message: "Розрахунок перевищує ліміт або не може бути завершений достовірно. Перевірте період та обмеження preview.", uncertain: false };
    if (/history|chain|requires repair/i.test(message)) return { message: "Історія розкладу або результатів виконань неповна чи суперечлива. Сервер відхилив генерацію; потрібна перевірка історії повторення.", uncertain: false };
  }
  // The backend documents error.message on rejected generate requests as safe UI text.
  return { message: message || (error.status === 404 ? "Повторювану задачу не знайдено." : error.message), uncertain: false };
}
