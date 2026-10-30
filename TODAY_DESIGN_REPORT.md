# Оновлення дизайну «Сьогодні»

Початковий Git був чистим. Локальних AGENTS.md у workspace та батьківських каталогах не знайдено. Чинні AppShell, access gate, guards, workspace, картки, підсумок, фільтри та календарне оновлення переглянуто перед змінами.

## Зміни та межі

- Спільна оболонка: нейтральний фон, компактна панель 248 px, векторний знак платформи, узгоджені SVG-іконки, м’який зелений активний стан, відокремлені нижні дії. Порядок, канонічні маршрути, згортання, aria-current і поведінка mobile drawer збережені.
- «Сьогодні»: окремий варіант компонування через layout="today". Дата використовує налаштований timezone та оновлюється при зміні дня, поверненні у вкладку або зміні timezone. Оновлено заголовок, кнопки, підсумок, фільтри, картки й підзадачі.
- Підсумок: ті самі чотири категорії, той самий підрахунок до фільтрації та алгоритм округлення. Смуга висотою 32 px обмежена 900 px і коротша за контент. Відсотки також є біля лічильників — пояснення залишається видимим, коли малий сектор не вміщує напис. Збережено aria-label/title та розкриття складу неактивних.
- Картки мають одну реалізацію дій, мутацій і діалогів. У Today показники часу перенесені в доступний з клавіатури розкривний блок; усі дії залишаються доступними. Підзадачі вирівняні за колонками; на вузькій картці переходять у кілька рядків.
- Current, Backlog, Archive, Routines, Areas і Settings не отримали нового компонування. Спільні візуальні зміни — лише оболонка, бренд та навігація. Палітра й стилі карток/підсумку/фільтрів Today обмежені явним варіантом.
- API, предметні правила, guards, календарний refresh, залежності, env-файли, backend та deployment не змінювалися. Commit/push не виконувалися.

## Змінені файли

| Область | Файли |
| --- | --- |
| Оболонка | src/application/shell/app-shell.tsx, app-shell.module.css, shell-icon.tsx |
| Іконка виходу | src/application/access/ui/app-access.tsx |
| Екран | src/modules/tasks/screens/tasks-screen.tsx |
| Картки | src/modules/tasks/ui/task-card.tsx, tasks.module.css |
| Фільтри | src/modules/tasks/ui/task-filters-panel.tsx, task-filters-panel.module.css |
| Підсумок | src/modules/tasks/ui/task-status-summary.tsx, task-status-summary.module.css |
| Стилі та дата Today | src/modules/tasks/ui/today.module.css, today-date.tsx |
| Браузерні тести | tests/today-design-browser.mjs, task-routing-browser.mjs, app-shell-browser.mjs |
| Звіт | TODAY_DESIGN_REPORT.md |

У routing-тесті додано явний desktop viewport, відкриття mobile drawer перед вибором маршруту та очікування переходу між desktop/mobile DOM. У shell-тесті уточнено, що 720 px — перевірка компонування, а не справжнього zoom.

## Фактичні перевірки

| Перевірка | Результат |
| --- | --- |
| npm.cmd run build | Успішно |
| npm.cmd run lint | Успішно, без warnings |
| npm.cmd run typecheck | Успішно |
| node --test tests/*.test.mjs | 19/19 |
| node tests/check-css-modules.mjs | 620 звернень, 12 модулів; коректні exports/imports/composes |
| node tests/today-design-browser.mjs | 11 груп; 43 моковані API-запити; errors=[] |
| node tests/app-shell-browser.mjs | 15 груп; 71 мокований API-запит; errors=[] |
| node tests/task-routing-browser.mjs | 7 груп; 96 мокованих API-запитів у фінальному запуску; errors=[] |
| git diff --check HEAD | Успішно |

Використано окремий headless Edge/CDP і production build з тестовим паролем та process override NEXT_PUBLIC_API_URL=http://mock.invalid. Env-файли не редагувалися. API перехоплювався тестами; сторонні мережеві запити блокувалися.

Today-перевірки: 1440/390 light/dark, низькі viewport-и 1440/390 × 400, довгі нерозривні назви, допустима довга назва сфери, відсутні optional-поля, 24 підзадачі, відсутність горизонтального переповнення; прокручування desktop-списку та mobile-сторінки; пошук, усі чотири сортування, статус, сфера, пріоритет, reset, query і F5; loading/error/retry/empty/no-results; розподіл 50/20/10/20, малий сектор 1%, округлення 34/33/33; complete/reopen з тим самим DOM-власником і disclosure; SKIPPED з причиною та чинним вилученням із Today; pending/refreshRequired і GET-only retry; чернетка та Back/Forward; зміна timezone Kyiv → Honolulu; explicit light/dark та system.

Shell-перевірки: порядок і активність, згортання після ререндеру, gate без API до входу, Areas та залежні refresh, pending-операції, query, Back/Forward, Escape, Tab/Shift+Tab, backdrop, кнопка закриття, повернення фокуса, resize з відкритими меню/Areas, нижні дії без перекриття, logout. Routing-перевірки: прямі входи/F5, 11 legacy redirect-випадків, стабільний workspace, чернетка, AbortSignal/stale response та автооновлення Today/Backlog на часових межах.

## Скриншоти й порівняння

Готові зображення збережені в C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/.

| Розмір | Light | Dark |
| --- | --- | --- |
| Desktop 1440 × 900 | [Переглянути](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-1440-light.png) | [Переглянути](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-1440-dark.png) |
| Mobile 390 × 900 | [Переглянути](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-390-light.png) | [Переглянути](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/today-390-dark.png) |

Також збережено mobile-full, mobile з розгорнутими фільтрами та stress-зображення низьких viewport-ів. Усі чотири основні зображення візуально переглянуті.

Порівняно з прикріпленим макетом відтворено палітру, ієрархію заголовка й дати, білі поверхні з тонкими межами, акцент навігації, кольори чотирьох категорій, компактний рядок фільтрів та вирівняні підзадачі. Смуга коротша за макет згідно з окремою вимогою. Реальні дії показані явним рядком, тому картки вищі; декоративне меню з трьома крапками не додавалося. Дані, підписи статусів та occurrence відповідають контрактам застосунку, а не текстам макета. Мобільні фільтри зберігають чинне розкриття. Це візуальне порівняння, не автоматична pixel-diff перевірка.

## Обмеження

- Справжній browser zoom 200% недоступний через використаний CDP-інструмент. Вузький viewport, deviceScaleFactor чи pinch zoom не зараховувалися як така перевірка.
- Дані повністю моковані; поведінка справжнього backend і реальні дані не перевірялися. Час у Today-тесті фіксований для відтворюваних скриншотів; календарні межі додатково перевіряє чинний routing-тест.
- В одному повторному routing-запуску очікування фокуса після серії Back/Forward завершилося timeout; наступний повний запуск пройшов. Тест тепер явно виводить CDP-вкладку на передній план; фінальний повний запуск із цим кроком також пройшов. Assertions фокуса не послаблено.

## Короткий ручний сценарій

1. Відкрити /tasks/today на 1440 px. Перевірити дату, чотири лічильники, фільтри й окреме прокручування списку. Змінити пошук та сортування, оновити F5.
2. Розгорнути підзадачі; завершити та повторно відкрити задачу. Перевірити переміщення між групами та збереження розгортання. Для occurrence перевірити Пропустити, причину та вилучення з Today.
3. Відкрити редактор, змінити назву, натиснути Back/Forward; перевірити чернетку, діалог підтвердження та фокус.
4. На 390 px перевірити меню через Tab/Shift+Tab, Escape і backdrop; відкрити Areas, закрити, перевірити фокус. Змінити ширину з відкритою панеллю та модалкою.
5. Перемкнути light/dark/system і timezone. Перевірити Current, Backlog, Archive, Routines та Settings. Окремо вручну встановити справжній zoom 200% у браузері.
