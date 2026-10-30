// Dedicated test build + headless Chromium; every API response is mocked.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { futureTask, routine } from "./routine-fixtures.mjs";
import { assertThemeColor, runThemeMatrix } from "./theme-browser-checks.mjs";

const app = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = process.env.APP_ACCESS_TEST_PASSWORD;
assert(password, "APP_ACCESS_TEST_PASSWORD is required");
const screenshots = process.env.TODAY_SCREENSHOTS ?? path.join(tmpdir(), "pp-today-design");
await mkdir(screenshots, { recursive: true });
const target = await (await fetch(`${process.env.CDP_URL ?? "http://127.0.0.1:9223"}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map(), calls = [], errors = [], passed = [], intercepting = new Set();
const cancelledNetworkRequests = new Set(), cancelledInterceptions = [];
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? "Runtime exception");
  else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map(arg => arg.value ?? arg.description ?? "").join(" "));
  else if (message.method === "Network.loadingFailed" && message.params.canceled) cancelledNetworkRequests.add(message.params.requestId);
  else if (message.method === "Fetch.requestPaused") {
    const request = intercept(message.params).catch(async error => {
      // React legitimately aborts obsolete list/Areas requests. Accept a CDP
      // fulfillment race only when Network independently confirms cancellation.
      if (error.message.includes("Invalid InterceptionId")) {
        await delay(50);
        if (cancelledNetworkRequests.has(message.params.networkId)) {
          cancelledInterceptions.push(message.params.request.url); return;
        }
      }
      errors.push(error.message);
    }).finally(() => intercepting.delete(request));
    intercepting.add(request);
  }
});
const now = "2026-10-30T09:00:00.000Z";
const area = { id: "11111111-1111-4111-8111-111111111111", name: "Особисте", createdAt: now, updatedAt: now };
function fixture(index, status = "TODO") {
  const id = index === 0 ? futureTask.id : "88888888-8888-4888-8888-" + String(index).padStart(12, "0");
  return { ...structuredClone(futureTask), id,
    title: ["Підготувати план на тиждень", "Похід на масаж", "Передати показники", "Купити продукти", "Прочитати розділ книги",
      "Завершити робочий звіт", "Перевірити бюджет", "Перенесена зустріч", "Ранкова зарядка", "Відповісти на лист"][index] ?? "Задача " + index,
    description: index === 0 ? "Проаналізувати минулий тиждень, визначити пріоритети та запланувати ключові задачі." : null,
    status, isCompleted: status === "DONE", completedAt: status === "DONE" ? now : null, isToday: true, isBacklog: true,
    plannedAt: index < 2 ? "2026-10-30T08:00:00.000Z" : null, dueAt: index === 2 ? "2026-10-29T18:00:00.000Z" : null,
    createdAt: new Date(Date.parse(now) - index * 60_000).toISOString(), updatedAt: now,
    priority: index === 0 ? "HIGH" : "MEDIUM", areaId: index < 2 ? area.id : null, area: index < 2 ? { id: area.id, name: area.name } : null,
    routineOccurrence: index === 1 ? { ...futureTask.routineOccurrence, startDate: "2026-10-30", endDate: "2026-10-30", instant: "2026-10-30T08:00:00.000Z" } : null,
    subtasks: index !== 0 ? [] : Array.from({ length: 2 }, (_, i) => ({
      id: "77777777-7777-4777-8777-" + String(i).padStart(12, "0"), taskId: id,
      title: i ? "Визначити пріоритети" : "Переглянути минулий тиждень", status: i ? "TODO" : "DONE",
      estimatedDurationMinutes: i ? 30 : 15, cancellationNote: null, createdAt: now, updatedAt: now, deletedAt: null,
    })),
  };
}
const baseline = () => ["TODO", "TODO", "TODO", "TODO", "TODO", "IN_PROGRESS", "IN_PROGRESS", "PAUSED", "DONE", "DONE"].map((s, i) => fixture(i, s));
let tasks = baseline(), mode = "normal", heldList, heldMutation, failDetails = false, holdMutation = false;
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  if (url.hostname !== "mock.invalid") return cdp(url.origin === new URL(app).origin ? "Fetch.continueRequest" : "Fetch.failRequest",
    { requestId, ...(url.origin === new URL(app).origin ? {} : { errorReason: "BlockedByClient" }) });
  const route = url.pathname, method = request.method;
  calls.push({ route, method, query: url.search, body: request.postData });
  let data, status = 200;
  if (method === "OPTIONS") status = 204;
  else if (route === "/areas") data = [area];
  else if (route === "/routines") data = [routine];
  else if (route === "/tasks" && method === "GET") {
    if (url.searchParams.get("view") === "today") {
      if (mode === "hold") await new Promise(resolve => { heldList = resolve; });
      if (mode === "error") { status = 500; data = { error: { message: "Mock today failure" } }; }
      else data = mode === "empty" ? [] : tasks.filter(task => task.isToday);
    } else data = tasks;
  } else if (route.startsWith("/tasks/")) {
    const task = tasks.find(t => t.id === route.split("/")[2]);
    assert(task, "Known mock task");
    if (method === "PATCH") {
      if (holdMutation) await new Promise(resolve => { heldMutation = resolve; });
      const change = JSON.parse(request.postData);
      const entity = route.includes("/subtasks/") ? task.subtasks.find(s => s.id === route.split("/").at(-1)) : task;
      Object.assign(entity, change);
      if ("isCompleted" in change) entity.status = change.isCompleted ? "DONE" : "TODO";
      if ("status" in change) entity.isCompleted = change.status === "DONE";
      if (entity === task) {
        task.completedAt = task.status === "DONE" ? now : null;
        task.skippedAt = task.status === "SKIPPED" ? now : null;
        task.skipNote = task.status === "SKIPPED" ? change.skipNote ?? null : null;
        task.isToday = task.status !== "SKIPPED";
        task.isBacklog = task.status !== "SKIPPED";
      }
      data = entity;
    } else if (failDetails) { status = 500; data = { error: { message: "Mock refresh failure" } }; }
    else data = task;
  } else throw Error("Unexpected mock request " + method + " " + route);
  await cdp("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [
    { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
    { name: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" }, { name: "Access-Control-Allow-Headers", value: "Content-Type" },
  ], body: status === 204 ? "" : Buffer.from(JSON.stringify(data)).toString("base64") });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? "Evaluation failed");
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settleApi() {
  for (let i = 0; i < 200; i++) {
    if (!intercepting.size) { await delay(100); if (!intercepting.size) return; }
    await delay(50);
  }
  throw Error("Mock API interception did not settle");
}
async function wait(expression) {
  for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await delay(50); }
  throw Error("Timed out: " + expression);
}
async function click(label) {
  const find = `(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;return [...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}||e.getAttribute('aria-label')===${JSON.stringify(label)})})()`;
  await wait(`!!${find}&&!${find}.disabled`);
  await evaluate(`${find}.click()`);
}
async function fill(selector, value) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function key(key, modifiers = 0) {
  const code = key === "Tab" ? 9 : key === "Escape" ? 27 : 0;
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: code, modifiers });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code, modifiers });
}
async function viewport(width, height = 900) {
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}
async function menu() {
  if (await evaluate("matchMedia('(max-width:760px)').matches&&!document.querySelector('#mobile-navigation')")) await click("Відкрити меню");
}
async function go(label) {
  await menu();
  await evaluate(`[...document.querySelectorAll('nav a')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`);
  await wait(`document.querySelector('h1')?.textContent===${JSON.stringify(label)}`);
}
const list = "section[aria-labelledby=tasks-heading]";
const first = `[data-task-id="${futureTask.id}"]`;
async function ready() { await wait(`document.querySelector('${list}')?.getAttribute('aria-busy')==='false'`); }
async function refresh() { await click("Оновити список"); await ready(); }
async function screenshot(name, full = false) {
  await evaluate("document.fonts.ready"); await delay(100);
  const shot = await cdp("Page.captureScreenshot", { format: "png", ...(full ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: await evaluate("document.documentElement.scrollHeight"), scale: 1 } } : {}) });
  await writeFile(path.join(screenshots, name + ".png"), Buffer.from(shot.data, "base64"));
}
try {
  await cdp("Runtime.enable"); await cdp("Page.enable"); await viewport(1440);
  await cdp("Network.enable");
  await cdp("Network.setBlockedURLs", { urlPatterns: [
    { urlPattern: app + "/*", block: false }, { urlPattern: app.replace(/^http/, "ws") + "/*", block: false },
    { urlPattern: "http://mock.invalid/*", block: false }, { urlPattern: "*://*:*/*", block: true },
  ] });
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "http://mock.invalid/*", requestStage: "Request" }] });
  if (process.env.THEME_MATRIX_ONLY) {
    await runThemeMatrix({ app, password, cdp, evaluate, wait, click, fill, viewport, screenshot, calls, settle: settleApi });
  } else {
  const gate = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.clear()" });
  await cdp("Page.navigate", { url: app + "/tasks/today?keep=design" });
  await wait("document.querySelector('#access-password')!==null"); assert.equal(calls.length, 0);
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: gate.identifier });
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
    localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});
    localStorage.setItem('personal-platform.settings',JSON.stringify({version:1,timeZone:'Europe/Kyiv',language:'uk',theme:'system',todayOverdueMode:'limited',todayOverdueDays:3}));
    const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[${JSON.stringify(now)}]))}static now(){return NativeDate.parse(${JSON.stringify(now)})}};
  ` });
  await cdp("Page.navigate", { url: app + "/tasks/today?keep=design" }); await ready();
  await wait("document.querySelector('time[datetime=\"2026-10-30\"]')!==null");
  assert.equal(await evaluate("document.querySelector('time[datetime=\"2026-10-30\"]').textContent"), "пʼятниця, 30 жовтня");
  const labels = await evaluate("[...document.querySelectorAll('[aria-label=\"Підсумок статусів\"] [role=img]')].map(e=>e.textContent.trim())");
  assert.deepEqual(labels, ["50%", "20%", "10%", "20%"]);
  await evaluate(`document.querySelector('${first} button[aria-expanded]').click()`);
  passed.push("Access gate has no API requests; Today date follows configured timezone; four original categories show 50/20/10/20");

  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await viewport(width); await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    assert.equal(await evaluate("(()=>{const b=document.querySelector('[aria-label=\"Частки статусів задач\"]');return b.clientHeight>=32&&b.clientWidth<b.parentElement.clientWidth})()"), true);
    if (width === 1440) assert.equal(await evaluate(`(()=>{const e=document.querySelector('${list}');e.scrollTop=500;const ok=e.scrollTop>0;e.scrollTop=0;return ok})()`), true);
    else assert.equal(await evaluate("document.documentElement.scrollHeight>innerHeight"), true);
    await screenshot(`today-${width}-${theme}`);
    if (width === 390) await screenshot(`today-${width}-${theme}-full`, true);
  }
  passed.push("1440/390 light/dark screenshots; narrow bar with legible fallback percentages; independent desktop list and mobile document scrolling");
  await evaluate("document.querySelector('section[aria-label=\"Пошук, фільтри й сортування задач\"] button[aria-expanded]').click()");
  await fill("input[name=q]", "масаж"); await wait("document.querySelectorAll('[data-task-id]').length===1");
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
  await screenshot("today-390-dark-filters"); await click("Скинути");
  await viewport(1440);
  await fill("input[name=q]", "масаж"); await wait("document.querySelectorAll('[data-task-id]').length===1");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[aria-label=\"Підсумок статусів\"] [role=img]')].map(e=>e.textContent.trim())"), labels);
  await wait("location.search.includes('q=')"); await cdp("Page.reload"); await ready();
  assert.equal(await evaluate("document.querySelector('input[name=q]').value"), "масаж");
  await click("Скинути"); await wait("document.querySelectorAll('[data-task-id]').length===10");
  await fill("select[name=status]", "DONE"); await wait("document.querySelectorAll('[data-task-id]').length===2"); await click("Скинути");
  await fill("select[name=area]", "none"); await wait("document.querySelectorAll('[data-task-id]').length===8"); await click("Скинути");
  await fill("select[name=priority]", "HIGH"); await wait("document.querySelectorAll('[data-task-id]').length===1"); await click("Скинути");
  await fill("select[name=sort]", "oldest"); await wait("document.querySelector('[data-task-id]')?.textContent.includes('Перенесена зустріч')");
  await fill("select[name=sort]", "deadline"); await wait("document.querySelector('[data-task-id]')?.textContent.includes('Передати показники')");
  await fill("select[name=sort]", "priority"); await wait("document.querySelector('[data-task-id]')?.textContent.includes('Підготувати план')");
  await fill("select[name=sort]", "newest"); await wait("document.querySelector('[data-task-id]')?.textContent.includes('Підготувати план')");
  await click("Скинути"); await fill("input[name=q]", "no matches"); await wait("document.querySelector('main').innerText.includes('За цими умовами задач не знайдено')");
  await click("Скинути");
  passed.push("Search/status/area/priority/sorting/reset, URL and F5 work; summary stays before filtering; no-results state");

  await evaluate(`window.__card=document.querySelector('${first}');document.querySelector('${first} button[aria-expanded]').click()`);
  await evaluate(`document.querySelector('${first} > div > input[type=checkbox]').click()`);
  await wait(`document.querySelector('${first} select[aria-label^="Статус задачі"]').value==='DONE'`);
  assert.equal(await evaluate(`document.querySelector('${first}')===window.__card`), true);
  assert.equal(await evaluate(`document.querySelector('${first} button[aria-expanded]').getAttribute('aria-expanded')`), "true");
  assert.equal(await evaluate(`(()=>{let e=document.querySelector('${first}');while(e=e.previousElementSibling){if(e.querySelector('h2'))return e.textContent.includes('Виконано сьогодні')}return false})()`), true);
  await evaluate(`document.querySelector('${first} > div > input[type=checkbox]').click()`);
  await wait(`document.querySelector('${first} select[aria-label^="Статус задачі"]').value==='TODO'`);
  const recurring = `[data-task-id="${tasks[1].id}"]`;
  await fill(`${recurring} select[aria-label^="Статус задачі"]`, "SKIPPED");
  await wait("document.querySelector('dialog[open] textarea[name=skipNote]')!==null");
  await fill("dialog[open] textarea", "Mock skip reason"); await click("Пропустити"); await wait("!document.querySelector('dialog[open]')");
  await wait(`document.querySelector('${recurring}')===null`);
  await go("Поточні задачі"); await ready();
  await wait(`document.querySelector('${recurring} select').value==='SKIPPED'`);
  assert.equal(await evaluate(`document.querySelector('${recurring} > div > input[type=checkbox]')===null`), true);
  await fill(`${recurring} select`, "TODO"); await wait(`document.querySelector('${recurring} > div > input[type=checkbox]')!==null`);
  await go("Сьогодні"); await ready();
  await evaluate(`(()=>{const e=document.querySelector('${first} button[aria-expanded]');if(e.getAttribute('aria-expanded')==='false')e.click()})()`);
  passed.push("Complete/reopen keeps card identity/disclosure across groups; SKIPPED saves note and leaves Today under existing rules; Current shows SKIPPED without checkbox and allows reopening");

  holdMutation = true; failDetails = true;
  await evaluate(`document.querySelector('${first} input[aria-label^="Завершити підзадачу"]').click()`);
  await wait(`document.querySelector('${first}').getAttribute('aria-busy')==='true'`);
  await go("Сьогодні");
  assert(heldMutation); holdMutation = false; heldMutation();
  await wait(`document.querySelector('${first}').innerText.includes('Зміну збережено, але дані не вдалося оновити')`);
  const patchesBeforeRetry = calls.filter(call => call.method === "PATCH").length;
  failDetails = false; await click("Повторити завантаження"); await wait(`!document.querySelector('${first} [role=alert]')`);
  assert.equal(calls.filter(call => call.method === "PATCH").length, patchesBeforeRetry);
  passed.push("Subtask pending and refreshRequired remain visible; retry refresh sends GET only");

  await go("Поточні задачі"); await ready(); await go("Сьогодні"); await ready();
  await click("+ Нова задача"); await fill("dialog[open] input[name=title]", "Draft must survive");
  await evaluate("history.back()"); await wait("location.pathname==='/tasks'");
  assert.equal(await evaluate("document.querySelector('dialog[open] input[name=title]').value"), "Draft must survive");
  await evaluate("history.forward()"); await wait("location.pathname==='/tasks/today'");
  await key("Escape"); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Продовжити редагування"); await key("Escape"); await click("Відкинути зміни"); await wait("!document.querySelector('dialog[open]')");
  passed.push("Workspace, draft, dialog and Back/Forward remain intact across canonical routes");

  mode = "hold"; await click("Оновити список"); await wait("document.querySelector('main').innerText.includes('Завантаження задач…')");
  assert(heldList); mode = "error"; heldList(); await ready();
  await wait("document.querySelector('main [role=alert]')!==null");
  mode = "empty"; await click("Повторити завантаження"); await ready();
  assert.equal(await evaluate("document.querySelector('main').innerText.includes('На сьогодні задач немає')"), true);
  mode = "normal"; tasks = Array.from({ length: 100 }, (_, i) => fixture(i, i === 99 ? "DONE" : "TODO")); await refresh();
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Підсумок статусів\"]').innerText.includes('1%')"), true);
  tasks = [fixture(0), fixture(1, "IN_PROGRESS"), fixture(2, "DONE")]; await refresh();
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[aria-label=\"Підсумок статусів\"] [role=img]')].map(e=>e.textContent.trim())"), ["34%", "33%", "33%"]);
  passed.push("Loading, failed load/retry, empty list, tiny 1% sector fallback and existing 34/33/33 rounding");

  tasks = baseline();
  tasks[0].title = "Дуже довга назва без втрати доступних дій " + "Надзвичайнодовгеслово".repeat(12);
  tasks[0].area.name = "Дуже довга назва сфери ".repeat(6).slice(0, 80);
  tasks[0].subtasks = Array.from({ length: 24 }, (_, i) => ({ ...fixture(0).subtasks[0],
    id: "77777777-7777-4777-8777-" + String(i).padStart(12, "0"), title: "Довга підзадача ".repeat(8), status: i % 2 ? "TODO" : "DONE" }));
  await refresh();
  await evaluate(`document.querySelector('${first} button[aria-expanded]').click()`);
  for (const width of [1440, 390]) {
    await viewport(width, 400);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    await screenshot(`today-stress-${width}`);
  }
  passed.push("Long unbroken titles, long area, missing optional fields, 24 subtasks, low 1440/390 × 400: no horizontal overflow");
  await viewport(1440);
  for (const label of ["Поточні задачі", "Беклог", "Архів", "Повторювані задачі", "Налаштування"]) {
    await go(label);
    assert.equal(await evaluate("!!document.querySelector('main').className.match(/today_main/)"), false);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
  }
  passed.push("Other five screens retain their layout and fit the shared shell");
  await fill("#settings-zone", "Pacific/Honolulu"); await click("Зберегти");
  await go("Сьогодні"); await ready();
  await wait("document.querySelector('time[datetime=\"2026-10-29\"]')!==null");
  passed.push("Changing configured timezone updates Today calendar date (Kyiv Oct 30 → Honolulu Oct 29)");
  await go("Налаштування");
  for (const theme of ["light", "dark", "system"]) {
    await fill("#settings-theme", theme); await click("Зберегти");
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme === "dark" ? "light" : "dark" }] });
    await wait(`getComputedStyle(document.documentElement).colorScheme===${JSON.stringify(theme === "system" ? "dark" : theme)}`);
    const effectiveTheme = theme === "system" ? "dark" : theme;
    await assertThemeColor(evaluate, effectiveTheme, "div:has(> main)", "backgroundColor", "shell-page");
    await assertThemeColor(evaluate, effectiveTheme, "h1", "color", "text");
    await assertThemeColor(evaluate, effectiveTheme, "#settings-theme", "backgroundColor", "input");
  }
  passed.push("Explicit light/dark overrides opposite system preference; system theme follows emulated OS");
  }
  await settleApi(); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, apiCalls: calls.length, errors, confirmedCancelledInterceptions: cancelledInterceptions.length, screenshots, zoom: "Native 200% browser zoom is not exposed by this CDP harness; viewport resizing is not a zoom test." }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passed, errors, calls: calls.slice(-6), state: await evaluate("({url:location.href,text:document.querySelector('main')?.innerText.slice(0,700),dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.innerText)})") }, null, 2));
  throw error;
} finally { await cdp("Page.close"); socket.close(); }
