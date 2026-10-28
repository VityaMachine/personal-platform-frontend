# Четвертий етап: маршрути Tasks і сумісність URL

Початковий `git status --short` був порожнім. Сторонніх змін не було. Commit/push не виконувалися. Секретні `.env`, backend, API-контракти, реальні дані й деплой не використовувалися та не змінювалися.

## Фактичне дерево маршрутів

```text
src/
  proxy.ts                         # тільки / та /routines: HTTP 307 до рендерингу
  app/
    layout.tsx                     # попередні ApplicationProviders і access gate
    page.tsx                       # legacy /: серверний fallback redirect
    routines/page.tsx              # legacy /routines: серверний fallback redirect
    settings/page.tsx              # /settings: без зміни адреси
    tasks/
      (lists)/
        layout.tsx                 # один TasksScreen для чотирьох списків
        page.tsx                   # /tasks
        today/page.tsx             # /tasks/today
        backlog/page.tsx           # /tasks/backlog
        archive/page.tsx           # /tasks/archive
      routines/page.tsx            # /tasks/routines: RoutinesScreen
```

Група `(lists)` не входить до URL. Її layout підключає готовий екран модуля, а тонкі сторінки списків повертають null як route slots. Routines і Settings розміщені поза workspace списків. Root layout, порядок providers та їхні client/server boundaries не змінені; новий layout списків серверний.

## Контракт URL і redirects

Публічний контракт залишається в `src/modules/tasks/routes.ts`: `taskHref`, `taskNavigationHrefs`, `taskSectionFromPathname`, `cleanTaskQuery`, `resolveLegacyTasksUrl`. Старі query-based `taskSection`/`taskSectionHref` видалені з model, їхніх споживачів немає.

Для старого `/`:

1. `params.get("archived") === "true"` → `/tasks/archive`.
2. Інакше `params.get("view") === "today"` → `/tasks/today`.
3. Інакше `params.get("view") === "backlog"` → `/tasks/backlog`.
4. Інакше наявність хоча б одного q/status/priority/area/sort/view/archived, навіть без значення, → `/tasks`.
5. Інакше → `/tasks/today`.

Для `/routines` ціль завжди `/tasks/routines`: pathname має пріоритет над перемикачами. Обидва правила видаляють усі view/archived, зберігаючи решту query за змістом, включно з порожніми та повторними параметрами. Повторні перемикачі зберігають попередню семантику першого значення: наприклад, archived=false&archived=true не означає архів.

`src/proxy.ts` має matcher лише для двох legacy pathname й повертає HTTP 307 через спільний resolver. Це потрібно, оскільки redirect лише зі сторінки при streaming міг повертатися як HTTP 200 із клієнтським переходом; цю поведінку виявила HTTP-перевірка й реалізацію виправлено. Compatibility-сторінки містять fallback на той самий resolver, а не окремі правила. Кожна ціль одразу канонічна й не перенаправляється знову.

Внутрішня навігація AppShell, посилання Routines і дія після невизначеного результату генерації використовують канонічні адреси. Остання, як і раніше, відкриває поточні задачі без перенесення query форми генерації. Інші переходи меню зберігають фільтри/unknown/repeated query, прибираючи legacy selectors; це стосується й посилання на Settings. Зміни фільтрів очищають selectors, залишають поточний pathname і не запускають GET Tasks.

На нових адресах view/archived не впливають на розділ і не викликають redirect: вони зникають при наступному побудованому переході або зміні фільтра. Backend як і раніше отримує `/tasks`, `/tasks?view=today`, `/tasks?view=backlog`, `/tasks?archived=true` та попередні параметри контексту.

## Стан списків і переходи

Стан живе в тому самому клієнтському `TasksPage` та його наявних hooks усередині TasksScreen у shared layout: applied section, expandedTaskIds, owners, creating/pending, filters, useTaskList і useTaskMutations. `usePathname` та `useSearchParams` читають актуальний URL у клієнті; shared layout не передає section через props.

При звичайному переході між чотирма списками layout і workspace не демонтуються. GET нового розділу проходить наявний loading-цикл; розкриття підзадач лишається за ID. При відкритій формі/діалозі, pending або refreshRequired новий pathname може вже відображатися в адресному рядку після Back/Forward, але застосований розділ і власники форм зберігаються до звільнення блокувань. Тест перевіряє тотожність DOM-власника картки та діалогу, чернетку й відкладене перемикання.

При дозволеному переході до Routines/Settings workspace демонтується; усі екрани платформи не утримуються змонтованими. F5 виконує звичайне нове монтування. Access gate не монтує workspace, AreasProvider чи Routines до входу. Areas лишається незалежною entity; її єдиний власник модалки — AppShell.

Scope/request/revision guards, AbortController, календарні обчислення, інвалідація після генерації та retry-логіка не змінені. Це також перевірено відсутністю diff у API, useTaskList, useTaskMutations, task-refresh та task-list-invalidation.

## Додаткова локальна зміна

Перевірка редагування Task → Back/Forward → Escape виявила, що клавіша доходить до input, але native cancel після history traversal може не надходити. EditTaskModal тепер синхронно викликає наявний requestClose на Escape з preventDefault/stopPropagation, як CreateTaskModal. Dirty/pending-перевірки, тексти та підтвердження не змінені. Нової системи фокуса або навігаційних blockers немає. Продовження редагування, фокус і явний discard перевірені реальними CDP pointer/key events.

CSS, дизайн, залежності, localStorage, DTO, предметні правила й timezone-обчислення не змінені. Тимчасова залежність від великого `app/page.module.css` залишена.

## Фактичні перевірки

| Перевірка | Результат |
| --- | --- |
| `npm run build` | Успішно: чотири списки, Routines, Settings; legacy сторінки dynamic, canonical сторінки static, Proxy присутній |
| `npm run lint` | Успішно |
| `npm run typecheck` | Успішно |
| `node --test tests/*.test.mjs` | 19/19, включно з усіма попередніми предметними тестами |
| Resolver/URL тести | Пріоритети, наявність порожніх параметрів, перші повторні значення, unknown view, archived=false, фільтри без view, unknown/repeated/encoded query, Next searchParams arrays, відсутність циклів, canonical builders |
| `tests/task-routing-browser.mjs` | 7 груп, 95 мокованих API-запитів, errors=[] |
| `tests/app-shell-browser.mjs` | 9 груп, 64 моковані API-запити, errors=[] на нових маршрутах |
| `tests/routine-schedule-browser.mjs` | 12 груп, 145 мокованих API-запитів, runtimeErrors=[]; додані переходи до Tasks після успішної/невизначеної генерації |
| `tests/app-access-browser.mjs` | Успішно: всі 6 canonical адрес до входу, точний пароль, F5/storage/інша вкладка/недоступне сховище, guarded logout, 1440/390 light/dark |
| `tests/areas-settings-browser.mjs` | 3 групи, 4 моковані GET, errors=[]; чернетки, тема/timezone після F5, фокус |
| Frontend без пароля | Окремий запуск `ACCESS_MISSING_ONLY=1`: всі 6 canonical адрес закриті, запитів даних немає |
| `git diff --check HEAD` | Успішно |
| Пошук старих внутрішніх URL | Збігів у UI немає; compatibility code, backend API modules і тести перевірені окремо |
| CSS diff | Порожній |

Новий routing-сценарій перевіряє 11 legacy URL через справжній HTTP 307 і відсутність наступного redirect; прямі адреси/F5; gate; pathname precedence; очищення selectors у навігації та фільтрах без зайвих GET; розкриття підзадач у всіх чотирьох списках; Back/Forward із тим самим власником форми та незміненою чернеткою; пізню відповідь після abort; автоматичні GET Today на plannedAt прихованої inventory-задачі та Backlog на UTC midnight; всі списки на 1440/390 light/dark.

AppShell-сценарій додатково перевіряє mutation → failed GET → GET-only retry, pending/refreshRequired без діалогу, відкладене застосування розділу, dirty Settings/Areas, focus/scroll/logout. Routines-сценарій перевіряє, що після успішної та невизначеної генерації канонічний `/tasks` виконує свіжий GET без повтору generate POST.

## Обмеження перевірок

- Build і browser працювали на ізольованій копії актуальних вихідних файлів без `.env`, з тестовим паролем, `NEXT_PUBLIC_API_URL=http://mock.invalid` та встановленими залежностями. Реального backend не було; коректність його відбору задач не перевірялася.
- Пізній результат перевірений локальним fetch mock, який навмисно ігнорує AbortSignal. Тест окремо підтверджує, що сигнал скасовано й stale DTO не замінює новий розділ. Календарний browser-тест використовує керований Date і реальні короткі timers у UTC, а не очікування до справжньої півночі чи повне покриття всіх DST-зон.
- Перші спроби нового routing-сценарію фіксували CDP `Invalid InterceptionId` від скасованих application/prefetch ресурсів; ці запуски не зараховані як успішні. Фінальна інфраструктура цього сценарію перехоплює лише mock API й окремо блокує сторонню мережу через Network allowlist; assertions errors=[] не послаблювалися. Використаний локальний Edge підтримує цей CDP Network API. Попереднє ігнорування Invalid InterceptionId у наявному Routines-скрипті не змінювалося.
- Скріншоти `task-routing-{1440,390}-{light,dark}-{current,today,backlog,archive}.png` збережені в системному tmp; переглянуті 390/dark Backlog і 1440/light Today. Автоматичного pixel comparison із попереднім комітом немає; CSS diff порожній.
- Тимчасові тестові копії видалені з workspace, сервери та окремий Edge/CDP-профіль зупинені. Історичні звіти попередніх етапів залишені як історичні документи.

## Виявлені зміни поведінки

- Голий `/` та `/` лише з unknown query тепер тимчасово ведуть у Today; наявність будь-якого старого параметра списку без валідного selector веде в Current. Це задане правило сумісності, а не незмінна майбутня роль кореня платформи.
- Адреса розділу тепер pathname; суперечливі legacy selectors у canonical query не змінюють екран. Фільтри й інші параметри зберігаються за попередніми правилами.
- Спільний layout додає стабільність між різними pathname чотирьох списків. Під час блокування URL може випереджати застосований розділ, як раніше при зміні query.
- Escape редактора Task тепер явно проходить його наявну close/discard-логіку після history traversal. Інших змін предметної поведінки не внесено.
