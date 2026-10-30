# Tasks: дії картки, календарне оновлення та видалення

Початковий Git чистий; локальних AGENTS.md у workspace й батьківських папках не знайдено. Переглянуто спільну картку, деталі, API wrapper, мутації, інвалідацію, календарні межі та guards. Сторонніх змін на початку не було.

## Зміни

### Дії спільної картки

Пропустити, Деталі, Архівувати/Повернути з архіву, Редагувати та Видалити використовують один TaskAction. На ширині понад 760 px видно текст; до 760 px — SVG-іконки 20 px у кнопках 44×44 px. На touch мінімальна висота також 44 px. На дію залишається один button; прихованих копій і додаткових Tab-зупинок немає.

Кожна кнопка має aria-label із дією та назвою задачі. Підказка доступна через aria-describedby, відображається при hover/focus; title не використовується як доступна назва. Клавіатурна підказка має пріоритет над підказкою іншої кнопки під курсором. Видалення використовує danger tokens. На mobile рядок додавання підзадачі відділений від іконок, щоб п’ять дій не розпадалися через довгий текст.

Збережені правила skip для occurrence/архіву/SKIPPED, доступність деталей, archive/restore, блокування edit/status, pending та refreshRequired. Кольори тем використовують чинні tokens.

### Причина зайвих GET

useTaskList мав два безумовні шляхи: window focus викликав refresh(), а visibilitychange після повернення у visible також викликав refresh(). Це не залежало від проходження календарної межі. Звичайне перемикання вікон і фокус після модалок могли робити зайві читання.

Тепер watchTaskRefresh використовує ту саму межу nextTaskRefresh для таймера, focus і visibilitychange:

- до межі — перевстановлює лише один таймер на залишок часу, без GET;
- у hidden — прибирає таймер;
- при поверненні — перевіряє фактичний час і оновлює лише якщо межа вже минула;
- спільний requested guard дає один refresh навіть за одночасних подій або вже поставленого в чергу старого timer callback;
- cleanup прибирає таймер і listeners; polling не додано.

Чинна модель меж plannedAt/dueAt/півночі з timezone occurrence, DST і максимальним setTimeout не змінена. Враховуються межі, пройдені під час запиту, завдяки observedAt. Для Today/Backlog одне оновлення означає два штатні GET: вибраний список та inventory. Це не два refresh.

AbortController, перевірки scope/key, інвалідація генерації, Areas revision, реакція на timezone/overdue settings, ручне оновлення та власники відкритих форм збережені. Помилка списку не запускає автоматичного retry на звичайний focus; залишається явна кнопка повтору. Попередження про недоступну inventory більше не обіцяє безумовного оновлення після повернення.

Аудит решти listeners: TodayDate використовує focus/visibility лише для дати заголовка й не читає Tasks API. Guards/beforeunload та Routines events не прибиралися.

### Підтвердження Task DELETE

Єдиний DeleteTaskDialog використовується всіма розділами спільної картки. У деталях Task дії видалення немає; інших UI-точок прямого Task DELETE не знайдено.

Перед запитом показуються «Видалити задачу?», конкретна назва та пояснення: задача позначається видаленою і зникає зі списків, дані фізично не видаляються; відновлення в цьому інтерфейсі відсутнє. Soft delete звірено read-only із сусіднім backend: tasks.service.remove оновлює deletedAt та створює дію DELETED. Backend не редагувався.

Початковий фокус — Скасувати. Native modal, явний Tab/Shift+Tab trap, body scroll lock, native cancel guard, клавіатурний Escape guard, HistoryTraversal та beforeunload під час запиту захищають діалог. Подвійний submit блокується синхронним inFlight та блокуванням мутації батьківської картки. Cancel/Escape до підтвердження не виконують API-запитів.

Після успіху картка прибирається, статус повідомляє про результат, фокус переходить у доступну область списку з aria-labelledby. При скасуванні фокус повертається на кнопку відкриття. Довга назва в діалозі переноситься.

409 та інші визначені 4xx залишають діалог із помилкою й можливістю нового явного підтвердження. Network/408/5xx вважаються невизначеним результатом: не стверджується, що дані не змінилися. Повторний DELETE заблокований до явної GET-перевірки стану; невизначеність зберігається після закриття/повторного відкриття. GET може підтвердити наявність задачі або її відсутність (404/deletedAt). Невдала перевірка повторюється лише як GET. Після підтвердженої наявності новий DELETE потребує нового явного підтвердження. Автоматичного повтору немає.

Підтвердження Subtask і Routine не змінені.

## Змінені файли

| Файл | Призначення |
| --- | --- |
| src/modules/tasks/ui/task-action.tsx | Один button на дію, іконки, labels і tooltip |
| src/modules/tasks/ui/task-action.module.css | Responsive text/icons, target size, focus, danger |
| src/modules/tasks/ui/task-card.tsx | Спільні дії та відкриття Task delete confirmation |
| src/modules/tasks/ui/delete-task-dialog.tsx | Діалог, pending/guards, uncertainty/check, фокус |
| src/modules/tasks/ui/tasks.module.css | Рядок дій, tooltip priority, перенесення назви |
| src/modules/tasks/model/task-removal.ts | Типи результатів і класифікація невизначеності |
| src/modules/tasks/hooks/use-task-mutations.ts | Резервування видалення, DELETE/check, stale-scope handling |
| src/modules/tasks/screens/tasks-screen.tsx | Підключення callbacks, оголошення результату, list focus ref |
| src/modules/tasks/model/task-refresh-scheduler.ts | Узгодження focus/visibility/timer |
| src/modules/tasks/hooks/use-task-list.ts | Календарний scheduler та актуальне попередження inventory |
| tests/task-refresh.test.mjs | 5 модульних тестів scheduler/DST/uncertainty |
| tests/task-interactions-checks.mjs | Нова браузерна матриця дій, видалення, GET і чернеток |
| tests/today-design-browser.mjs | Режим TASK_INTERACTIONS_ONLY та mock DELETE/clock |
| tests/routine-schedule-browser.mjs | Відкриття чинного mobile drawer перед перевіркою переходу до Tasks |
| README.md | Актуальна поведінка оновлення та підтвердження |
| TASK_INTERACTIONS_REPORT.md | Цей звіт |

## Фактичні перевірки

| Перевірка | Результат |
| --- | --- |
| npm.cmd run build | Успішно |
| npm.cmd run lint | Успішно, без warnings |
| npm.cmd run typecheck | Успішно |
| node --test tests/*.test.mjs | 26/26 |
| node tests/check-css-modules.mjs | 631 звернення, 13 модулів, imports/exports/composes коректні |
| TASK_INTERACTIONS_ONLY=1 node tests/today-design-browser.mjs | 7 груп, 16 route/size/theme комбінацій; 10 явних DELETE; 56 спискових GET; 174 API-запити; errors=[] |
| node tests/today-design-browser.mjs | 11 груп; 41 API-запит; errors=[] |
| node tests/app-shell-browser.mjs | 15 груп; 72 API-запити; errors=[] |
| node tests/task-routing-browser.mjs | 7 груп; 94 API-запити; errors=[] |
| node tests/routine-schedule-browser.mjs | 12 груп; 145 API-запитів; runtimeErrors=[] |
| git diff --check HEAD | Успішно |

Нова матриця перевіряє усі дії Today/Current/Backlog/Archive на 1440/390 у light/dark; текст/іконки й 44 px; назви, danger color, hover/focus hints, Enter, Tab/Shift+Tab, Escape, повернення фокуса; archive/restore, details/edit/skip. Відкриття/скасування/Escape видалення — 0 API-запитів. Подвійний submit — 1 DELETE, pending блокує cancel/Escape і tracked history traversal. Перевірено успіх, 409, 5xx, втрату відповіді з виконаним і невиконаним видаленням, повторне відкриття uncertainty, failed GET check, focus після видалення.

Для часу перевірено справжнє перемикання CDP-вкладки на about:blank і повернення: visibility вихідної вкладки стала hidden, нових GET — 0. Додатково перевірено одночасні hidden/visible/focus події (0 GET), ручний refresh (одна пара), Today plannedAt та midnight, Backlog plannedAt, збереження тієї самої відкритої чернетки, timezone/overdue update і відсутність GET для зміни лише теми. Unit-тест викликає вже поставлений у чергу timer callback разом із focus/visibility, перевіряє cleanup, MAX_REFRESH_DELAY, DST та midnight occurrence timezone.

Чинні набори підтвердили мутації та GET-only refresh retry, інвалідацію Areas після rename/delete/create, інвалідацію Tasks після успішної/невизначеної генерації без повторного POST, subtask/Task status regression, SKIPPED, групи Today, stale response/AbortSignal, F5/query/Back/Forward, workspace й чернетки. Ручні та календарні GET збережені.

Скриншоти дій збережені в C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/task-actions-{1440,390}-{light,dark}-{today,tasks,backlog,archive}.png; desktop/light Today і mobile/dark Today візуально переглянуті.

## Обмеження та межі

- Усі записи виконано лише на мокованому API http://mock.invalid, з тестовим паролем. Реальні дані/API не використовувалися; env-файли, залежності, deployment і backend не змінювалися.
- Календарний integration-тест керує Date, visibilityState та подіями focus/visibilitychange у справжньому браузері. Звичайне перемикання вкладок окремо перевірено через native CDP target activation; фізичне перемикання вікон ОС не виконувалося. Таймери також перевіряє чинний routing-сценарій; точний race старого callback перевірено модульно. Справжній browser zoom не перевірявся.
- History-перевірка pending використовує tracked записи поточного документа. Для виходу з документа є beforeunload; показ системного prompt залежить від браузера та user activation.
- Наявна обробка скасованих CDP-перехоплень у старому Routines harness не змінювалася. У новому Tasks-прогоні console/runtime/interception errors відсутні; підтверджених cancellation races — 0.
- Окремого чинного списку майбутніх робіт/roadmap не знайдено. Ідея для майбутнього: Settings може дозволяти звичайне підтвердження, введення слова «видалити» або власного слова. Ці режими, зберігання й універсальний конструктор зараз не реалізовані.
- /api/tasks/search не реалізовувався. Commit/push не виконувалися.

## Короткий ручний сценарій

1. Відкрити Today/Current/Backlog/Archive на 1440 px: усі п’ять доступних дій текстові; в архіві перевірити Повернути з архіву. На 390 px перевірити іконки, Tab/Enter, hover/focus hints і danger-стан.
2. Відкрити Видалити для конкретної задачі; Escape і Скасувати повинні дати 0 DELETE та повернути фокус. Повторно відкрити й двічі підтвердити під затримкою — 1 DELETE; до відповіді діалог залишається відкритим.
3. Успіх прибирає картку й переводить фокус у список. На 409 діалог показує помилку; при втраті відповіді пропонує GET-перевірку, без автоматичного повтору DELETE.
4. У Network очистити список запитів і переключити вкладку без проходження межі — нових Tasks GET немає. Кнопка оновлення працює. Після відомої plannedAt/півночі має бути одна потрібна пара GET для Today/Backlog.
5. Залишити відкриту чернетку під час календарного оновлення; перевірити її збереження. Перевірити мутацію підзадачі, зміну Areas, timezone/overdue settings та повернення до Tasks після генерації.
