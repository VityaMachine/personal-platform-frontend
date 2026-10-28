# Другий етап впорядкування frontend

Початковий `git status --short` був порожнім. Перенесення виконано через `git mv`; commit/push не виконувалися. Секретні `.env`, backend, prod і деплой не змінювалися.

## Фактичні перенесення

У таблиці всі шляхи відносні до `src/`; групи в дужках означають окремі файли з тими самими іменами.

| Звідки | Куди |
| --- | --- |
| `lib/areas.ts` | `entities/areas/api/areas.ts` |
| `lib/{area-types,area-validation}.ts` | `entities/areas/model/` |
| `app/_hooks/use-areas.tsx` | `entities/areas/model/use-areas.tsx` |
| `app/_components/{area-select,areas-modal,delete-area-dialog}.tsx` | `entities/areas/ui/` |
| `app/_components/areas.module.css` | `entities/areas/ui/areas.module.css` |
| `lib/{settings,settings-store,settings-storage,theme}.ts` | `modules/settings/model/` |
| `app/_hooks/use-settings.tsx` | `modules/settings/model/use-settings.tsx` |
| `app/settings/{settings-screen.tsx,settings.module.css}` | `modules/settings/ui/` |
| `lib/app-access.ts` | `application/access/model/app-access.ts` |
| `app/_components/{app-access.tsx,app-access.module.css}` | `application/access/ui/` |
| `lib/api.ts` | `shared/api/api.ts` |
| `lib/{format-date,zoned-date}.ts` | `shared/dates/` |
| `lib/format-duration.ts` | `shared/lib/format-duration.ts` |
| `lib/history-traversal-guard.ts` | `shared/navigation/history-traversal-guard.ts` |
| `app/_hooks/use-history-traversal-guard.tsx` | `shared/navigation/use-history-traversal-guard.tsx` |
| `app/_hooks/use-open-dialog.ts` | `shared/hooks/use-open-dialog.ts` |
| `app/_components/{discard-changes-dialog,zoned-date-time-field}.tsx` | `shared/ui/` |

Явні точки входу Areas: `public.ts` для типів/API/валідації та клієнтський `ui.ts` для provider/hook і UI. Settings: клієнтські `preferences.ts` і `screen.ts`, чистий `preferences-runtime.ts` та `theme.ts` для bootstrap layout. Немає нових `index.ts` або re-exports за старими шляхами. `app/settings/page.tsx` зберігає наявну тонку обгортку Suspense.

## Тимчасові залежності

- Settings і Tasks/Routines використовують `app/_components/tasks-shell.tsx`; його композиція та Tasks-навігація збережені. Shell імпортує LogoutButton з application/access.
- Settings, Areas, access і shared UI використовують незмінений `app/page.module.css`.
- `AreasModal` зберігає `tasksLoading`, `tasksError`, `reloadTasks`; provider Areas зберігає `taskRevision`, який споживає Tasks.
- Settings відкриває керування Areas. Спільний HTTP-клієнт зберігає старі тексти 404/409 зі згадками задач відповідно до вимоги не змінювати тексти.

Порядок монтування: HistoryTraversalProvider → SettingsProvider → AppAccessProvider → AreasProvider → сторінки. Gate, межі provider, URL, сховища та формати даних збережені.

## Виконані перевірки

- `npm run build` — успішно в ізольованій копії поточних вихідних файлів без `.env`, із тестовими API URL/паролем; маршрути `/`, `/routines`, `/settings` зібрані. Початкова підготовка копії в системному tmp з junction до залежностей не підійшла для Turbopack; успішна копія була вкладеною в workspace, використовувала встановлені залежності й незмінений Next config. Тимчасові копії в workspace видалені.
- `npm run lint`, `npm run typecheck` — успішно.
- `node --test tests/*.test.mjs` — 14/14 успішно.
- `tests/routine-schedule-browser.mjs` — успішно: 11 груп, 133 моковані API-запити, порожній список runtime errors. Серед сценаріїв retries, невизначені результати, точні payload, блокування, чернетки, фокус, генерація, автоматизація та 1440/390 light/dark.
- `tests/app-access-browser.mjs` — початковий запуск дійшов до фінальної перевірки errors та впав із двома `CDP handler failed`. Це не зараховано як успішний запуск; точну причину помилок встановити не вдалося. Діагностична копія з додатковим логуванням помилок та незмінними assertions пройшла; наступний запуск оригінального скрипта також пройшов. Перевірені URL/query, відсутність запитів до входу, точний пароль, F5, storage/інша вкладка/недоступне сховище, guarded logout, 1440/390 light/dark.
- Окремий запуск доступу з `ACCESS_MISSING_ONLY=1` і frontend без пароля — успішно: всі три маршрути закриті, запитів даних немає.
- `tests/areas-settings-browser.mjs` — успішно: відкриття, завантаження сфери, чернетка Settings перед переходом до Areas, продовження/відкидання чернетки Areas, початковий і повернений фокус, light/dark і timezone після F5, query. Чотири моковані GET, мутацій API немає, список errors порожній.
- `git diff --check HEAD` — успішно; пошук застарілих імпортів перенесених файлів — збігів немає.
- Порівняння AST реалізацій і CSS для 77 змінених/перенесених файлів з HEAD — без змін runtime-коду або правил CSS після виключення імпортів, exports і type aliases та нормалізації CRLF.

Браузер використовував окремий headless Edge/CDP-профіль. Реального API не було; довільні зовнішні запити блокувалися. Це перевірка на fixtures, без інтеграції з backend і без порівняння скріншотів із попередньою збіркою. Assertions наявних браузерних скриптів не змінювалися; наявна обробка Invalid InterceptionId у Routines також не змінювалася.

## Зміни поза перенесенням та імпортами

- Предметні `DateField`/`DateOptions` механічно винесені з `zoned-date.ts` у `modules/tasks/model/task-date-options.ts`; їхні визначення збережені. Технічні перетворення дат не залежать від Tasks.
- Додані перелічені явні точки входу, README, цей звіт і браузерний сценарій Areas/Settings. Бізнес-логіка, залежності, CSS та наявні тексти не змінювалися.
