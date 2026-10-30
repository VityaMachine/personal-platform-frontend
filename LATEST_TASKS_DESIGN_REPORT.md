# Оновлення Today, оболонки та карток Tasks

Візуальний орієнтир — останній макет із поточного запиту. Цей звіт замінює попередні описи вигляду цих компонентів у TODAY_DESIGN_REPORT.md і TASK_INTERACTIONS_REPORT.md.

## Реалізація

- Оновлено ліву навігацію: активна зелена поверхня, іконки списків, відступи, нижні Settings/Logout. Чинний SVG-знак збережено. Порядок пунктів, згортання Tasks, окрема модалка Areas, mobile drawer, guards і маршрути збережені.
- Today отримав теплі світлі поверхні, компактний підсумок із горизонтальною смугою, рядок фільтрів у порядку пошук → статус → сфера → пріоритет → сортування. Палітра централізована в globals.css; bootstrap/runtime light/dark/system не змінювалися.
- У всіх чотирьох списках додаткові дії Task доступні через одну кнопку «⋯». Порядок: Деталі, Редагувати, доступний Пропустити, Архівувати/Відновити, розділювач, Видалити. Чекбокс і статус залишаються на картці. Для підзадач також використано компактне меню редагування/видалення.
- Меню використовує portal, fixed-позиціювання, перевірку меж viewport, оновлення при scroll/resize/ResizeObserver, один активний власник. Підтримано Enter/Space, стрілки, Home/End, Escape, звичайний Tab, закриття зовні й після дії. Назва кнопки містить назву задачі. Діалог отримує стабільну кнопку, а не демонтований menuitem.
- Окремий рядок «Підзадачі · виконано X із Y» має chevron, aria-expanded, aria-controls і focus. DONE рахується серед невидалених підзадач; CANCELED входить лише в Y. Для Y=0 рядок відсутній; додавання першої підзадачі доступне.
- Початкове розгортання записується один раз за Task ID у стабільному Tasks workspace: Today, крім DONE, відкрито; інші списки згорнуті. Ручний вибір переживає фільтри, оновлення та переходи. localStorage не додано.
- Згортання приховує вміст без демонтування власника редактора. Діалоги винесено в окремий DOM portal зі збереженням Today tokens. Це запобігає втраті модального шару при переміщенні тієї самої картки між групами. Чернетка підзадачі перевірена під час DONE/оновлення/згортання; при прихованому opener фокус повертається на кнопку картки.

Backend, API-контракти, залежності, env-файли, реальні дані та deployment не змінювалися. /api/tasks/search, нові фільтри дат і пагінацію не підключено. Commit/push не виконувалися. Початковий git status був чистим; наявний dev-сервер користувача не зупинявся.

## Змінені файли

| Група | Файли |
| --- | --- |
| Tokens | src/app/globals.css |
| Оболонка | src/application/shell/app-shell.tsx; app-shell.module.css; shell-icon.tsx |
| Стан workspace | src/modules/tasks/screens/tasks-screen.tsx |
| Картки й підзадачі | src/modules/tasks/ui/task-card.tsx; task-subtask-list.tsx; edit-subtask-dialog.tsx; tasks.module.css |
| Нові компоненти | src/modules/tasks/ui/task-menu.tsx; task-menu.module.css; task-dialog-portal.tsx |
| Today і фільтри | src/modules/tasks/ui/today.module.css; task-status-summary.module.css; task-filters-panel.tsx; task-filters-panel.module.css |
| Браузерні перевірки | tests/today-design-browser.mjs; task-menu-checks.mjs (новий); task-interactions-checks.mjs; theme-browser-checks.mjs; app-shell-browser.mjs; task-routing-browser.mjs |
| Звіт | LATEST_TASKS_DESIGN_REPORT.md |

## Перевірки

Тестова production-збірка використовувала лише process overrides: mock.invalid і окремий тестовий пароль. Env-файли не редагувалися. Headless Edge/CDP перехоплював API; реальний backend не використовувався. Браузерні набори виконувалися послідовно через спільне браузерне сховище.

| Перевірка | Результат |
| --- | --- |
| npm.cmd run build | PASS |
| npm.cmd run lint | PASS, без warnings |
| npm.cmd run typecheck | PASS |
| node --test tests/*.test.mjs | PASS, 26/26 |
| node tests/check-css-modules.mjs | PASS, 633 звернення, 14 CSS Modules |
| git diff --check HEAD | PASS |
| node tests/today-design-browser.mjs | PASS, 11 груп, 41 мокований API-запит, errors=[] |
| TASK_MENU_ONLY=1 node tests/today-design-browser.mjs | PASS, 29 мокованих API-запитів, errors=[] |
| THEME_MATRIX_ONLY=1 node tests/today-design-browser.mjs | PASS, 8 сценаріїв, 678 вимірювань кольорів, errors=[] |
| TASK_INTERACTIONS_ONLY=1 node tests/today-design-browser.mjs | PASS, 7 груп, 174 моковані API-запити, errors=[] |
| node tests/app-shell-browser.mjs | PASS, 15 груп, 70 мокованих API-запитів, errors=[] |
| node tests/task-routing-browser.mjs | PASS, 7 груп, 94 моковані API-запити, errors=[] |

Покриття: 1440/390 px, light/dark, низький viewport 400 px, explicit light при OS dark та навпаки, system і F5; клавіатурне меню, touch, перша/остання картки, stacking, scroll і resize, одне відкрите меню, outside click, Escape та повернення фокуса. Відкриття/скасування меню й діалогів не виконує мутацій; саме меню не виконує API-запитів.

Skip перевірено зі скасуванням, поверненням фокуса, 409 і повторним явним підтвердженням; подвійний submit дає один PATCH. Delete: подвійний submit дає один DELETE, pending блокує скасування/історію, 409 зберігає діалог, невизначена відповідь/5xx вимагає GET-перевірки, автоматичного повтору DELETE немає. Pending/refreshRequired та GET-only retry збережені.

Підзадачі: початкові значення Today/DONE/Current; ручний вибір через refresh, фільтри й переходи; DONE/reopen та групи; DONE/CANCELED/deleted у X/Y; створення й видалення; відкрита чернетка при згортанні й фактичному PATCH батька. Сортування, query, F5, Back/Forward, scroll, Current/Backlog/Archive, access gate, Areas, Settings/Routines guards і mobile drawer також перевірені. Повернення у вкладку дає 0 зайвих GET; календарні межі й інвалідація після мутацій працюють.

Під час перевірок виправлено втрату модального шару при переміщенні картки, успадковану стару сітку картки та відступи subgrid біля чекбоксів. Браузерні тести оновлено для вибору disclosure за aria-controls, оскільки aria-expanded тепер також має меню. Touch/resize assertions чекають завершення responsive layout.

## Скриншоти та порівняння з макетом

Усі чотири фінальні desktop/mobile light/dark зображення переглянуті, включно з повними mobile-сторінками. Також переглянуто меню біля країв у низькому viewport.

| Розмір | Light | Dark |
| --- | --- | --- |
| 1440 × 900 | [Desktop light](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-1440-light.png) | [Desktop dark](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-1440-dark.png) |
| 390, повна сторінка | [Mobile light](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-390-light-full.png) | [Mobile dark](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-390-dark-full.png) |
| Меню, висота 400 | [Desktop, перша картка](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/menu-edge-1440-light-first.png) | [Mobile, остання картка](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/menu-edge-390-dark-last.png) |

Відтворено ієрархію заголовків, світлі поверхні й тонкі межі, зелений активний пункт навігації, кольори підсумку, порядок фільтрів, положення статусу/меню та виразні вкладені блоки з вертикальною лінією. Dark використовує той самий стиль із чинною палітрою.

Свідомі відхилення: збережений чинний знак та узгоджена SVG-система; реальні підписи статусів і дат; описи, показники часу й доступне додавання першої підзадачі роблять деякі картки вищими. Відсотки залишаються на смузі та в легенді для малих секторів; чинні точні ширини й алгоритм округлення не змінювалися. Mobile зберігає drawer і згортання фільтрів, підзадачі компонуються у два рядки. Areas не має декоративного підменю. Порівняння візуальне, автоматичний pixel diff не виконувався.

## Обмеження

- Справжній browser zoom 200% недоступний через використаний headless CDP harness. Зміна viewport, deviceScaleFactor або pinch zoom не зараховувалися як його перевірка.
- API повністю мокований; реальний backend і реальні дані не перевірялися. Дату у fixtures зафіксовано для відтворюваності; календарні переходи перевірені окремими сценаріями.
- Розгортання зберігається в межах змонтованого Tasks workspace. Повне F5 починає новий workspace; постійне сховище навмисно не додано.

## Короткий ручний сценарій

1. Увійти, відкрити /tasks/today на 1440 px; перевірити підсумок, фільтри, групи й незалежний scroll списку. Змінити фільтри, натиснути F5, пройти Back/Forward.
2. На «⋯» перевірити Enter/Space, стрілки, Home/End, Tab, Escape; відкрити Delete/Skip, скасувати й перевірити фокус. Підтвердити збереження один раз, спробувати подвійне підтвердження й помилку на тестовому API.
3. Згорнути підзадачі, оновити список, перейти Current → Backlog → Today: ручний вибір має зберегтися. Завершити й відкрити Task повторно; перевірити групу та X/Y.
4. Відкрити редактор підзадачі, ввести чернетку; перевірити discard. Додати першу підзадачу й видалити її через підтвердження.
5. На 390 px і низькій висоті перевірити touch-меню першої/останньої картки, resize, довгі назви та drawer. Вибрати light при OS dark, dark при OS light і system. У звичайному браузері окремо перевірити справжній zoom 200%.
