# Третій етап впорядкування frontend

Початковий `git status --short` був порожнім. Сторонніх змін не було. Commit/push не виконувалися; секретні `.env`, backend, реальні дані й деплой не використовувалися.

## Композиція та залежності

- Через `git mv` перенесено `src/app/_components/tasks-shell.tsx` до `src/application/shell/app-shell.tsx`; компонент перейменовано на `AppShell`, старого файла/re-export немає.
- `activeItem` замінює boolean-пропси активного пункту. Фіксовані пункти меню, URL та збереження query залишилися попередніми. `src/modules/tasks/routes.ts` надає вузький `taskNavigationHrefs`; побудова URL Tasks і правила збереження фільтрів залишаються в Tasks. Application не імпортує його внутрішні model/hooks/UI.
- Серверний `src/application/providers.tsx` збирає HistoryTraversalProvider → SettingsProvider → AppAccessProvider → AreasProvider → сторінки. Root layout лишився серверним; власні client boundaries providers збережені. Gate не монтує AreasProvider, AppShell та екрани до входу.
- Єдине місце монтування `AreasModal` й стан opener тепер у AppShell. Кожен активний екран використовує цей компонент композиції. Нового route layout, глобального shell/provider стану, реєстру модулів або нових маршрутів немає.
- Екрани передають AppShell перевірку переходів і запиту відкриття Areas. Tasks враховує loading/pending, creating і locks, включно з refreshRequired. Перехід між розділами Tasks зберігає попереднє відкладене застосування. Routines зберігає modalLock та pending GET редактора; Settings зберігає dirty request/confirm і свій HistoryTraversal blocker. AppShell не реєструє додаткових blockers. Logout враховує блокування екрана та власну відкриту AreasModal.
- Areas має нейтральну `changeRevision` після кожного успішного commit. `taskRevision`, `tasksLoading`, `tasksError`, `reloadTasks` прибрані. AreasModal приймає лише opener/onClose. Імпортів Tasks/Routines у `entities/areas` немає.
- Tasks і Routines споживають ревізію та самі завантажують залежні списки. Помилки GET і кнопки retry залишені на цих екранах; вони доступні після закриття Areas. Успішна мутація Areas не стає невдалою через помилку наступного GET; retry виконує лише читання.

## Життєвий цикл

Providers та екрани не отримали нових умов монтування чи ключів. AppShell лишився всередині поточного екрана, як попередній TasksShell; він не став постійним layout між маршрутами. AreasModal змінила власника, але монтується при відкритті та демонтується при закритті/демонтуванні екрана. Чернетка Areas зберігається при відкладеній зміні розділу Tasks через Back.

Змінився момент читання Routines після зміни Areas: ревізія запускає GET одразу, а не при закритті модалки. Без змін закриття Areas більше не робить зайвий GET Routines. Нейтральна ревізія також сповіщає про створення сфери, тому Tasks/Routines перечитуються й після POST; це не призначає нову сферу задачам. Під час GET списки проходять свій наявний loading-цикл; для Routines це тепер може статися до закриття Areas. Ніякого нового монтування екрана через це немає.

## Додаткові зміни

- Цільовий браузерний сценарій виявив проблему `CreateTaskModal`: після Back натискання Escape відкривало discard-підтвердження, але native dialog уже закривався. Окрема збірка вихідних файлів попереднього HEAD на тих самих моках відтворила проблему. Додано локальний `onKeyDown` для Escape з preventDefault/stopPropagation і викликом наявного requestClose. Dirty/pending перевірки та тексти не змінені. Сценарій з незмінною вимогою двох відкритих діалогів тепер проходить, як і продовження/відкидання чернетки.
- У `tests/app-access-browser.mjs` покращено діагностику помилок CDP: зберігаються назва події та code/message помилки без параметрів запиту. Assertions і критерії успіху не змінені, помилки не ігноруються.
- Додані `tests/shell-routes.test.mjs` і `tests/app-shell-browser.mjs`; оновлений README. Нових залежностей немає. CSS, API/DTO, localStorage, предметні правила та часові обчислення не змінені.

## Перевірки

| Перевірка | Фактичний результат |
| --- | --- |
| `npm run build` | Успішно на ізольованій копії поточних вихідних файлів без `.env`, з тестовими API URL/паролем та наявними залежностями; `/`, `/routines`, `/settings` зібрані |
| `npm run lint` | Успішно |
| `npm run typecheck` | Успішно |
| `node --test tests/*.test.mjs` | 16/16: 14 попередніх + 2 перевірки контракту маршрутів зі збереженням фільтрів, пробілів пошуку, сторонніх повторених query-ключів та попередніх URL |
| `tests/app-shell-browser.mjs` | 9 груп, 64 моковані API-запити, errors=[] |
| `tests/routine-schedule-browser.mjs` | 11 груп, 133 моковані API-запити, runtimeErrors=[] |
| `tests/areas-settings-browser.mjs` | 3 групи, 4 моковані GET, errors=[] |
| `tests/app-access-browser.mjs` | Перший запуск дійшов до фінальної перевірки errors та впав із `CDP handler failed`; після додавання діагностики повтор пройшов. Початковий запуск не зарахований як успішний; його точну причину встановити не вдалося |
| Доступ без пароля (`ACCESS_MISSING_ONLY=1`) | Окремий frontend без пароля: всі три маршрути закриті, запитів даних немає |
| `git diff --check HEAD` | Успішно |
| Пошук застарілих імпортів/контрактів | У src/tests немає старих TasksShell/tasks-shell, taskRevision та пропсів Tasks у Areas; єдине звернення application до Tasks — публічний routes |
| CSS diff | Змін немає |

Новий браузерний сценарій перевіряє:

- відсутність shell/екрана/API до входу;
- перейменування Areas, pending, подвійне підтвердження, блокування закриття/навігації/logout і оновлення назви Tasks;
- DELETE очищає зв’язок Tasks; POST не призначає нову сферу; після помилок залежних GET повтор не повторює POST/PATCH/DELETE;
- нейтральна ревізія оновлює назви/зв’язки Routines, помилка та retry залишаються в Routines;
- pending GET редактора Routines блокує shell/Areas/logout до монтування діалогу;
- pending/refreshRequired Tasks без діалогу блокують переходи до інших модулів, Areas і logout; відкладений розділ, Back, власник і розкриті підзадачі зберігаються; повторюється тільки GET;
- Tasks draft → Back → Escape → продовження/discard, Forward; Settings dirty → Back → stay/discard → Forward; збереження query;
- чернетка єдиної AreasModal переживає Back між розділами Tasks до явного discard;
- 1440/390 px, light/dark: Tasks/Routines/Settings без горизонтального переповнення, прокручування Tasks, розміри Areas, Tab/Shift+Tab, повернення фокуса й body overflow.

Наявні сценарії додатково охоплюють storage/F5/іншу вкладку, dirty logout, тему/timezone, Routines mutations/retries/невизначені результати й генерацію. Screenshot-артефакти `app-shell-{width}-{theme}-{tasks,routines,settings,areas}.png` збережені в системному tmp; переглянуті мобільний Tasks/light, desktop Tasks/dark і мобільний Areas/dark. Це не автоматичне порівняння пікселів із попередньою збіркою.

Усі браузерні перевірки працювали через окремий headless Edge/CDP-профіль і перехоплений `mock.invalid`; сторонні запити блокувалися. Реальний API не перевірявся. Наявне ігнорування Invalid InterceptionId у Routines-скрипті не змінювалося. Тимчасові копії поточної/попередньої збірок і frontend без пароля видалені з workspace, тестові сервери та Edge зупинені.

## Залишені тимчасові залежності

- `src/app/page.module.css` і його поточні назви класів використовують AppShell, модулі, Areas, access та shared UI; CSS не розділявся.
- Екрани Tasks/Routines/Settings знають AppShell як компонент композиції. Application знає вузький публічний контракт маршрутів Tasks і фіксовані пункти застосунку.
- Спільний HTTP-клієнт зберігає попередні тексти 404/409 зі згадками задач.

Залежності Areas від Tasks/Routines через типи, імпорти або callbacks більше немає.
