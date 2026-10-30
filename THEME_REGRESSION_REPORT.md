# Виправлення світлої теми

Git на початку був чистим. Локальних AGENTS.md у workspace та батьківських каталогах не знайдено. Згенеровані Next.js інструкції в ізольованій тестовій копії прочитано разом із локальним керівництвом CSS. Сторонні зміни не перезаписувалися.

## Першопричина

У застосунку немає окремого ThemeProvider: SettingsProvider викликає applyTheme для збереженого значення. Head bootstrap застосовує його до першого paint через CSSOM. Для explicit light/dark вставляється правило :root:root із color-scheme та aliases палітри; для system правило прибирається, працює глобальний prefers-color-scheme. Специфічність :root:root вища за :root глобального media query.

Редизайн додав інший шлях вибору кольору: light-dark() у AppShell, Today, підсумку та статусах. У фактичному dev CSS Lightning CSS перетворює, наприклад:

```css
--shell-surface: light-dark(#fafbfa, #151d20);
/* compiled */
--shell-surface: var(--lightningcss-light, #fafbfa)
                 var(--lightningcss-dark, #151d20);
```

Службові змінні компілятора визначалися статичним CSS біля color-scheme: light/dark і перемикалися media query ОС. Динамічне правило, вставлене applyTheme через CSSOM, не проходить компілятор: воно оновлювало color-scheme та старі tokens, але не ці службові перемикачі.

Регресію відтворено до виправлення: OS dark + збережена light давали html color-scheme=light, світлу форму rgb(255, 255, 255), але sidebar rgb(21, 29, 32). Це відповідає скриншотам. Проблема не в збереженні select чи перевазі media query над explicit color-scheme; розходилися два механізми палітри. Попередня перевірка лише color-scheme не могла виявити це розходження.

## Виправлення

- Усі 30 кольорових tokens редизайну перенесено до централізованої light/dark палітри globals.css зі збереженням значень кольорів.
- Bootstrap і runtime тепер перемикають повний набір із 76 tokens. Один список themeTokens використовується обома шляхами.
- AppShell успадковує shell tokens із документа; Today має лише семантичні aliases до today tokens. Підсумок і статуси також використовують централізовані tokens.
- Компоненти більше не містять light-dark() та не залежать від приватних змінних Lightning CSS.
- Не додано !important, локальних дубльованих light/dark палітр, suppressHydrationWarning, змін конфігурації браузера чи приховування індикаторів.
- Компонування, кольори погодженого дизайну та бізнес-логіка збережені. Зміна option без збереження, підтвердження залишення/відкидання чернетки та збереження теми працюють за чинним сценарієм; нової поведінки preview не вводилося.

## Змінені файли

| Файл | Зміна |
| --- | --- |
| src/app/globals.css | Централізовані light/dark значення та system aliases для tokens редизайну |
| src/modules/settings/model/theme.ts | Повний спільний список tokens для bootstrap/runtime |
| src/application/shell/app-shell.module.css | Прибрано локальну палітру light-dark |
| src/modules/tasks/ui/today.module.css | Aliases до централізованих today tokens |
| src/modules/tasks/ui/task-status-summary.module.css | Tokens кольорів секторів та підписів |
| src/modules/tasks/ui/tasks.module.css | Tokens кольорів статусів Today |
| tests/today-design-browser.mjs | Перевірки computed colors у чинному сценарії; режим повної theme matrix; console error checks |
| tests/theme-browser-checks.mjs | Матриця тем, маршрутів, діалогів, F5 і збереження |
| tests/theme.test.mjs | Повнота палітри, рівність bootstrap/runtime, очищення explicit override для system |
| tests/app-shell-browser.mjs | Очікування готовності desktop/mobile DOM після resize перед перевіркою навігації |
| THEME_REGRESSION_REPORT.md | Цей звіт |

Браузерний harness перехоплює лише mock API, блокує сторонню мережу й очікує завершення перехоплень перед навігацією. Помилка CDP Invalid InterceptionId допускається лише за незалежно підтвердженого Network.loadingFailed(canceled=true) для того самого request; невідомі помилки, console errors та runtime exceptions залишаються помилками тесту. У фінальних dev/prod theme matrix таких cancellation races не було.

## Матриця браузера

Окремий headless Edge, API повністю мокований. Dev Turbopack перевірено в ізольованій копії без env-файлів; production build — із тестовими process env overrides. Початковий користувацький dev server на 3000 не зупинявся й не переналаштовувався. API, backend, залежності, env-файли та deployment не змінювалися.

| Режим | Desktop 1440 | Mobile 390 |
| --- | --- | --- |
| OS dark + explicit light | Пройшов | Пройшов |
| OS light + explicit dark | Пройшов | Пройшов |
| OS light + system → OS dark → OS light | Пройшов | Пройшов |
| OS dark + system → OS light → OS dark | Пройшов | Пройшов |

678 вимірювань фактичних backgroundColor/color на кожному повному прогоні матриці, плюс перевірки фону оболонки та color-scheme. Очікувані RGB беруться з оголошеної light/dark палітри вихідного CSS, а не з уже обчисленого token документа: неправильний вибір теми ОС не може дати хибний успіх.

Перевірено Settings, Today, Current Tasks, Routines, Areas на кожному маршруті, створення Task та вкладений discard dialog, mobile header/drawer, access gate без API до входу. Перевірено light → dark → light, live OS switching, збереження/F5, прямі переходи між маршрутами, незбережений option, Залишитися та Вийти без збереження. На explicit light/dark перемикання ОС не змінює палітру; system реагує одразу.

## Next.js «1 Issue»

У вихідному .next/dev/logs/next-development.log знайдено:

```text
A tree hydrated but some attributes of the server rendered HTML
didn't match the client properties.
<body
- cz-shortcut-listen="true"
>
```

Атрибут відсутній у коді застосунку. Це зовнішня DOM-ін’єкція перед hydration, типова для браузерного розширення; конкретне розширення користувацького профілю недоступне для перевірки.

Додатково виконано окремий контрольований dev-експеримент на екрані доступу без API:

1. Чистий профіль, без ін’єкції: console errors=[], атрибут відсутній.
2. Ін’єкція цього самого атрибута перед hydration: та сама помилка, кнопка Open issues overlay з 1 Issue; overlay відкрито та переглянуто.
3. Припинення ін’єкції та чистий reload: console errors=[], атрибут відсутній.

Цей Issue не пов’язаний із темою. Для усунення в користувацькому профілі потрібно припинити ін’єкцію атрибута — вимкнути для localhost розширення, яке модифікує body, та перезавантажити сторінку. Видалення індикатора, видалення атрибута застосунком або приглушення hydration warning не застосовувалися.

[Скриншот відтвореного Issue](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/theme-issue-injected.png).

## Фактичні перевірки

- npm.cmd run build — успішно.
- npm.cmd run lint — успішно, без warnings.
- npm.cmd run typecheck — успішно.
- node --test tests/*.test.mjs — 21/21.
- node tests/check-css-modules.mjs — 620 звернень, 12 модулів; exports/imports/composes коректні.
- THEME_MATRIX_ONLY=1 node tests/today-design-browser.mjs — dev Turbopack: 8 комбінацій, 678 вимірювань, 194 API-запити, errors=[]; production: 8 комбінацій, 678 вимірювань, 121 API-запит, errors=[].
- Звичайний today-design-browser — 11 груп, 43 API-запити, errors=[]; включає computed colors замість перевірки лише color-scheme.
- AppShell browser — 15 груп, 71 API-запит, errors=[]; меню, Areas, клавіатура, фокус, guards, Back/Forward, pending/refreshRequired та logout.
- git diff --check HEAD — успішно.

Артефакт обчислених кольорів: C:/Users/VVMachine/AppData/Local/Temp/pp-theme-colors.json.
Скриншоти theme-{1440,390}-os-{light,dark}-{light,dark,system}-{settings,today}.png збережено в C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/. Візуально переглянуто Settings 1440 та Today 390 під OS dark + explicit light.

| OS dark + explicit light | Settings | Today |
| --- | --- | --- |
| Desktop | [Скриншот](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/theme-1440-os-dark-light-settings.png) | [Скриншот](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/theme-1440-os-dark-light-today.png) |
| Mobile | [Скриншот](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/theme-390-os-dark-light-settings.png) | [Скриншот](C:/Users/VVMachine/AppData/Local/Temp/pp-today-design/theme-390-os-dark-light-today.png) |

Справжній backend та користувацький профіль браузера не змінювалися. Commit/push не виконувалися.

Коротка ручна перевірка: під темною ОС зберегти Світла, відкрити Today/Tasks/Routines/Areas та оновити F5; перейти Світла → Темна → Світла зі збереженням; для Системна перемкнути тему ОС без reload; змінити option без збереження й перевірити Залишитися/Вийти без збереження. Повторити на mobile. Якщо у власному профілі лишається Issue з cz-shortcut-listen, вимкнути його зовнішню ін’єкцію для localhost і виконати чисте перезавантаження.
