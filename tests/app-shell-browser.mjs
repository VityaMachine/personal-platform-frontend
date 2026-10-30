// Test build only: mock.invalid API, APP_ACCESS_TEST_PASSWORD, dedicated CDP profile.
import assert from "node:assert/strict";
import { routine as routineFixture, futureTask } from "./routine-fixtures.mjs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const app = process.env.APP_URL ?? "http://127.0.0.1:3100";
const password = process.env.APP_ACCESS_TEST_PASSWORD;
assert(password, "APP_ACCESS_TEST_PASSWORD is required");
const target = await (await fetch(`${process.env.CDP_URL ?? "http://127.0.0.1:9223"}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map(), errors = [], calls = [];
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const originalArea = { id: "11111111-1111-4111-8111-111111111111", name: "Mock Area", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") errors.push("Browser runtime exception");
  else if (message.method === "Fetch.requestPaused") void intercept(message.params).catch(error => errors.push(`CDP interception: ${error.message}`));
});
let area = structuredClone(originalArea), failList = null, failDetails = false, releaseMutation;
let taskAreaId = originalArea.id, routineAreaId = originalArea.id;
let holdEdit = false, releaseEdit;
let holdMutation = false;
const subtaskId = "77777777-7777-4777-8777-777777777777";
const subtask = { id: subtaskId, taskId: futureTask.id, title: "Mock Child", status: "TODO", estimatedDurationMinutes: 10,
  cancellationNote: null, createdAt: futureTask.createdAt, updatedAt: futureTask.updatedAt, deletedAt: null };
function task() { return { ...futureTask, title: "Mock Task", routineOccurrence: null, plannedAt: null, isToday: true, isBacklog: true,
  areaId: taskAreaId, area: area && taskAreaId === area.id ? { id: area.id, name: area.name } : null, subtasks: [subtask] }; }
function routine() { return { ...routineFixture, areaId: routineAreaId, area: area && routineAreaId === area.id ? { id: area.id, name: area.name } : null }; }
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  if (url.hostname !== "mock.invalid") {
    return cdp(url.origin === new URL(app).origin ? "Fetch.continueRequest" : "Fetch.failRequest", {
      requestId, ...(url.origin === new URL(app).origin ? {} : { errorReason: "BlockedByClient" }),
    });
  }
  const route = url.pathname, method = request.method;
  calls.push({ method, route, body: request.postData });
  let data, status = 200;
  if (method === "OPTIONS") status = 204;
  else if (route === "/areas" && method === "GET") data = area ? [area] : [];
  else if ((route === "/areas" && method === "POST") || (route === "/areas/" + originalArea.id && method === "PATCH")) {
    if (holdMutation) await new Promise(resolve => { releaseMutation = resolve; });
    area = { ...originalArea, name: JSON.parse(request.postData).name }; data = area;
    if (method === "POST") status = 201;
  } else if (route === "/areas/" + originalArea.id && method === "DELETE") { area = null; taskAreaId = null; routineAreaId = null; status = 204; }
  else if (method === "GET" && (route === "/tasks" || route === "/routines")) {
    if (failList === route) { status = 500; data = { error: { message: "Mock list failure" } }; }
    else data = route === "/routines" ? [routine()] : Array.from({ length: 24 }, (_, i) => i === 0 ? task() : { ...task(),
      id: "88888888-8888-4888-8888-" + String(i).padStart(12, "0"), subtasks: [], title: "Mock Task " + i });
  } else if (route === "/tasks/" + futureTask.id && method === "GET") {
    if (failDetails) { status = 500; data = { error: { message: "Mock details failure" } }; } else data = task();
  } else if (route === "/routines/" + routineFixture.id && method === "GET") {
    if (holdEdit) await new Promise(resolve => { releaseEdit = resolve; });
    data = routine();
  } else if (route === "/tasks/" + futureTask.id + "/subtasks/" + subtaskId && method === "PATCH") {
    if (holdMutation) await new Promise(resolve => { releaseMutation = resolve; });
    Object.assign(subtask, JSON.parse(request.postData)); data = subtask;
  } else throw Error("Unexpected mock API request: " + method + " " + route);
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
async function wait(expression) {
  for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await delay(50); }
  throw Error(`Condition timed out: ${expression}`);
}
async function fill(selector, value) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function click(label) {
  await wait(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(label)}||e.textContent.trim()===${JSON.stringify(label)}));return !!e&&!e.disabled})()`);
  await evaluate(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(label)}||e.textContent.trim()===${JSON.stringify(label)}));if(!e||e.disabled)throw Error('Unavailable button');e.click();})()`);
}
async function escape() {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
}

const passed = [];
const taskCard = `[data-task-id="${futureTask.id}"]`;
const areasButton = "[...document.querySelectorAll('nav button')].find(e=>e.textContent.trim()==='Сфери')";
const logoutButton = "[...document.querySelectorAll('nav button')].find(e=>e.textContent.trim()==='Вийти')";
const mutationCount = () => calls.filter(call => ["POST", "PATCH", "DELETE"].includes(call.method)).length;
async function menu() {
  if (await evaluate("matchMedia('(max-width:760px)').matches&&!document.querySelector('#mobile-navigation')")) {
    await wait("document.querySelector('button[aria-label=\"Відкрити меню\"]')!==null");
    await evaluate("document.querySelector('button[aria-label=\"Відкрити меню\"]').click()");
    await wait("document.querySelector('#mobile-navigation')!==null");
  }
  await wait("document.querySelector('nav')!==null");
}
async function link(label) {
  await menu();
  await evaluate(`(()=>{const e=[...document.querySelectorAll('nav a')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}));if(!e)throw Error('Missing link');e.click();})()`);
}
async function active(label) {
  await menu();
  await wait(`document.querySelector('nav a[aria-current="page"]')?.textContent.trim().endsWith(${JSON.stringify(label)})`);
  assert.equal(await evaluate("document.querySelectorAll('nav a[aria-current=page]').length"), 1);
  assert.equal(await evaluate("document.querySelectorAll('nav').length"), 1);
  if (await evaluate("!!document.querySelector('#mobile-navigation')")) {
    await escape(); await wait("!document.querySelector('#mobile-navigation')");
  }
}
async function openAreas() {
  await menu();
  await wait(`${areasButton}?.getAttribute('aria-disabled')==='false'`);
  await click("Сфери");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Mock Area')");
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
}
async function closeAreas() {
  await evaluate("document.querySelector('button[aria-label=\"Закрити керування сферами\"]').click()");
  await wait("!document.querySelector('dialog[open]')");
  await wait(`document.activeElement===(matchMedia('(max-width:760px)').matches?document.querySelector('button[aria-label="Відкрити меню"]'):${areasButton})`);
}
async function retryList(route, expected) {
  await closeAreas();
  await wait("document.querySelector('main [role=alert]')!==null");
  const before = mutationCount();
  failList = null;
  await click("Повторити завантаження");
  await wait(expected);
  assert.equal(mutationCount(), before, `${route} retry must not repeat an Areas mutation`);
}
async function rename(name) {
  await click("Перейменувати");
  await fill("dialog[open] input", name);
  await click("Зберегти назву");
  await wait(`document.querySelector('dialog[open]')?.innerText.includes(${JSON.stringify(name)})`);
}
async function removeArea() {
  await click("Видалити");
  await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Видалити сферу");
  await wait("document.querySelectorAll('dialog[open]').length===1");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Сфер ще немає')");
}
try {
  await cdp("Runtime.enable"); await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  const initial = await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: "localStorage.removeItem('personal-platform.access-password');localStorage.removeItem('personal-platform.settings')",
  });
  await cdp("Page.navigate", { url: `${app}/tasks?keep=stage3` });
  await wait("document.querySelector('#access-password')!==null");
  assert.equal(calls.length, 0);
  assert.equal(await evaluate("document.querySelector('nav')===null && document.querySelector('#tasks-heading')===null"), true);
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: initial.identifier });
  await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)})`,
  });
  await cdp("Page.navigate", { url: `${app}/tasks?keep=stage3&q=Mock&priority=MEDIUM` });
  await wait(`document.querySelector('${taskCard}')!==null`);
  await active("Поточні задачі");
  passed.push("Access gate: no shell, screen or Areas API before login");

  assert.deepEqual(await evaluate("[...document.querySelectorAll('#tasks-navigation a')].map(e=>e.textContent)"),
    ["Сьогодні", "Поточні задачі", "Беклог", "Архів", "Повторювані задачі"]);
  await evaluate("document.querySelector('[aria-controls=tasks-navigation]').click()");
  await click("Оновити список");
  await wait("document.querySelector('section[aria-labelledby=tasks-heading]')?.getAttribute('aria-busy')==='false'");
  assert.equal(await evaluate("document.querySelector('#tasks-navigation').hidden"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('#tasks-navigation a')].every(e=>e.getClientRects().length===0)"), true);
  await evaluate("document.querySelector('[aria-controls=tasks-navigation]').click()");
  passed.push("Canonical menu order; Tasks collapse hides links and survives rerender");

  await openAreas(); await click("Перейменувати"); await fill("dialog[open] input", "Renamed Area");
  holdMutation = true; failList = "/tasks";
  await click("Зберегти назву");
  await wait("document.querySelector('dialog[open] form')?.getAttribute('aria-busy')==='true'");
  assert.equal(await evaluate("document.querySelector('dialog[open] input').disabled"), true);
  const beforePending = mutationCount();
  await evaluate("document.querySelector('dialog[open] form').requestSubmit()");
  await link("Налаштування");
  assert.equal(await evaluate("location.pathname"), "/tasks");
  assert.equal(await evaluate(`${logoutButton}.disabled`), true);
  assert.equal(mutationCount(), beforePending);
  await escape(); assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
  assert(releaseMutation); holdMutation = false; releaseMutation();
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Сферу перейменовано.')");
  await wait("!document.querySelector('dialog[open] input').disabled");
  await retryList("/tasks", `document.querySelector('${taskCard}')?.innerText.includes('Renamed Area')`);
  assert.equal(mutationCount(), beforePending);
  passed.push("Areas PATCH: pending/double submit/navigation/logout blocked; Task GET failure retries GET only and updates name");

  // The same modal owner supports all three mutations; consumers own failed GETs.
  area.name = "Mock Area";
  await openAreas(); failList = "/tasks";
  const beforeDelete = mutationCount(); await removeArea();
  await retryList("/tasks", `document.querySelector('${taskCard}')!==null`);
  assert.equal(mutationCount(), beforeDelete + 1);
  assert.equal(await evaluate(`document.querySelector('${taskCard}').innerText.includes('Сфера:')`), false);
  await click("Сфери"); await wait("document.querySelector('dialog[open]')?.innerText.includes('Сфер ще немає')");
  failList = "/tasks"; await fill("dialog[open] input", "Created Area");
  const beforeCreate = mutationCount(); await click("Створити сферу");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Сферу створено.')");
  await retryList("/tasks", `document.querySelector('${taskCard}')!==null`);
  assert.equal(mutationCount(), beforeCreate + 1);
  assert.equal(await evaluate(`document.querySelector('${taskCard}').innerText.includes('Сфера:')`), false);
  passed.push("Areas DELETE clears Task relationship, POST keeps it unassigned; dependent GET retry never repeats DELETE/POST");

  area.name = "Mock Area";
  routineAreaId = area.id;
  await link("Повторювані задачі"); await active("Повторювані задачі");
  await wait("document.querySelector('#routines-heading')!==null");
  await openAreas(); failList = "/routines"; await rename("Routine Renamed Area");
  await retryList("/routines", "document.querySelector('main')?.innerText.includes('Routine Renamed Area')");
  area.name = "Mock Area";
  await openAreas(); failList = "/routines"; await removeArea();
  await retryList("/routines", "document.querySelector('main')?.innerText.includes('Без сфери')");
  passed.push("Areas neutral revision refreshes Routines on rename/delete; list errors and GET-only retry stay in Routines");

  holdEdit = true; await click("Редагувати");
  await wait("[...document.querySelectorAll('main button')].some(e=>e.textContent.trim()==='Завантаження…')");
  assert.equal(await evaluate("document.querySelector('dialog[open]')===null"), true);
  await link("Налаштування"); await link("Поточні задачі"); await click("Сфери");
  assert.equal(await evaluate("location.pathname"), "/tasks/routines");
  assert.equal(await evaluate(`${logoutButton}.disabled`), true);
  assert(releaseEdit); holdEdit = false; releaseEdit();
  await wait("document.querySelector('dialog[open]')!==null");
  await escape(); await wait("!document.querySelector('dialog[open]')");
  passed.push("Routines pending edit GET blocks navigation/Areas/logout before any dialog mounts");

  await link("Поточні задачі"); await active("Поточні задачі");
  await wait(`document.querySelector('${taskCard}')!==null`);
  await evaluate(`document.querySelector('${taskCard} button[aria-expanded]').click()`);
  await wait(`document.querySelector('${taskCard} input[aria-label="Завершити підзадачу: Mock Child"]')!==null`);
  holdMutation = true; failDetails = true;
  const beforeChild = mutationCount();
  await evaluate(`document.querySelector('${taskCard} input[aria-label="Завершити підзадачу: Mock Child"]').click()`);
  await wait(`document.querySelector('${taskCard}').getAttribute('aria-busy')==='true'`);
  assert.equal(await evaluate("document.querySelector('dialog[open]')===null"), true);
  await link("Налаштування"); await link("Повторювані задачі"); await click("Сфери");
  assert.equal(await evaluate("location.pathname"), "/tasks");
  assert.equal(await evaluate(`${logoutButton}.disabled`), true);
  assert.equal(await evaluate(`${areasButton}.getAttribute('aria-disabled')`), "true");
  assert(releaseMutation); holdMutation = false; releaseMutation();
  await wait(`document.querySelector('${taskCard}')?.innerText.includes('Зміну збережено, але дані не вдалося оновити')`);
  await link("Налаштування"); await link("Повторювані задачі"); await click("Сфери");
  assert.equal(await evaluate("location.pathname"), "/tasks");
  assert.equal(await evaluate(`${logoutButton}.disabled`), true);
  await link("Сьогодні");
  await wait("location.pathname==='/tasks/today'");
  await active("Поточні задачі"); // A locked screen defers applying the requested Task section.
  await evaluate("history.back()");
  await wait("location.pathname==='/tasks'");
  failDetails = false; await click("Повторити завантаження");
  await wait(`${areasButton}.getAttribute('aria-disabled')==='false'`);
  assert.equal(mutationCount(), beforeChild + 1);
  assert.equal(await evaluate(`document.querySelector('${taskCard} button[aria-expanded]').getAttribute('aria-expanded')`), "true");
  passed.push("Tasks pending/refreshRequired block shell/Areas/logout without dialogs; Back and deferred section retain owner/disclosure; retry is GET only");

  await link("Сьогодні"); await active("Сьогодні");
  await click("+ Нова задача"); await wait("document.querySelector('dialog[open] input[name=title]')!==null");
  await fill("dialog[open] input[name=title]", "Task draft");
  await evaluate("history.back()"); await wait("location.pathname==='/tasks'");
  assert.equal(await evaluate("document.querySelector('dialog[open] input[name=title]').value"), "Task draft");
  await active("Сьогодні");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Продовжити редагування"); await wait("document.querySelectorAll('dialog[open]').length===1");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Відкинути зміни"); await wait("!document.querySelector('dialog[open]')"); await active("Поточні задачі");
  await evaluate("history.forward()"); await active("Сьогодні");
  await link("Налаштування"); await active("Налаштування");
  await wait("document.querySelector('#settings-zone')!==null");
  await fill("#settings-zone", "Pacific/Honolulu");
  await evaluate("history.back()"); await wait("document.querySelector('dialog[role=alertdialog][open]')!==null");
  await click("Залишитися"); await wait("!document.querySelector('dialog[open]')");
  assert.equal(await evaluate("document.querySelector('#settings-zone').value"), "Pacific/Honolulu");
  await active("Налаштування");
  await evaluate("history.back()"); await wait("document.querySelector('dialog[role=alertdialog][open]')!==null");
  await click("Вийти без збереження"); await active("Сьогодні");
  await evaluate("history.forward()"); await active("Налаштування");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('keep')"), "stage3");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('q')"), "Mock");
  passed.push("Tasks draft survives Back until discard; Settings uses its existing Back/Forward confirmation; query survives all shell links");

  await link("Поточні задачі"); await active("Поточні задачі");
  await link("Сьогодні"); await active("Сьогодні");
  area = structuredClone(originalArea); await openAreas();
  await fill("dialog[open] input", "Area draft across history");
  await evaluate("history.back()"); await wait("location.pathname==='/tasks'");
  assert.equal(await evaluate("document.querySelector('dialog[open] input').value"), "Area draft across history");
  await active("Сьогодні");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Продовжити редагування"); await wait("document.querySelectorAll('dialog[open]').length===1");
  assert.equal(await evaluate("document.querySelector('dialog[open] input').value"), "Area draft across history");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Відкинути зміни"); await wait("!document.querySelector('dialog[open]')"); await active("Поточні задачі");
  passed.push("Single application-owned Areas dialog retains draft across Task Back and releases deferred navigation after discard");

  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const label of ["Поточні задачі", "Повторювані задачі", "Налаштування"]) {
      await link(label); await active(label);
      await wait("!document.querySelector('main section[aria-busy=true]')");
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=${width}`), true);
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(tmpdir(), `app-shell-${width}-${theme}-${label === "Налаштування" ? "settings" : label === "Поточні задачі" ? "tasks" : "routines"}.png`), Buffer.from(shot.data, "base64"));
    }
    await link("Поточні задачі"); await active("Поточні задачі");
    await wait("document.querySelector('section[aria-labelledby=tasks-heading]')?.getAttribute('aria-busy')==='false'");
    if (width === 1440) assert.equal(await evaluate("(()=>{const e=document.querySelector('section[aria-labelledby=tasks-heading]');e.scrollTop=200;return e.scrollTop>0})()"), true);
    else assert.equal(await evaluate("document.documentElement.scrollHeight>innerHeight"), true);
    area = structuredClone(originalArea); await openAreas();
    assert.equal(await evaluate("document.body.style.overflow"), "hidden");
    assert.equal(await evaluate("(()=>{const r=document.querySelector('dialog[open]').getBoundingClientRect();return r.width<=innerWidth&&r.height<=innerHeight})()"), true);
    const areaShot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(tmpdir(), `app-shell-${width}-${theme}-areas.png`), Buffer.from(areaShot.data, "base64"));
    for (let i = 0; i < 8; i++) {
      await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: i < 4 ? 0 : 8 });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      assert.equal(await evaluate("document.querySelector('dialog[open]').contains(document.activeElement)"), true);
    }
    await closeAreas();
    assert.equal(await evaluate("document.body.style.overflow"), "");
  }
  passed.push("1440/390 light/dark: three shell screens fit, Task scrolling works, Areas traps focus and restores opener/body overflow");

  await menu();
  assert.equal(await evaluate("document.body.style.overflow"), "hidden");
  for (let i = 0; i < 24; i++) {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: i < 12 ? 0 : 8 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.querySelector('#mobile-navigation').contains(document.activeElement)"), true);
  }
  await escape(); await wait("!document.querySelector('#mobile-navigation')");
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Відкрити меню");
  await menu();
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: 380, y: 200, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: 380, y: 200, button: "left", clickCount: 1 });
  await wait("!document.querySelector('#mobile-navigation')");
  await menu(); await click("Закрити меню");
  await wait("!document.querySelector('#mobile-navigation')");
  await menu();
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait("!document.querySelector('#mobile-navigation')");
  assert.equal(await evaluate("document.body.style.overflow"), "");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate("document.querySelector('#mobile-navigation')===null"), true);
  await openAreas();
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await closeAreas();
  await openAreas();
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  await closeAreas();
  passed.push("Mobile menu: Tab/Shift+Tab, Escape, backdrop, close button, focus return; resize with menu and Areas open");

  await link("Налаштування"); await active("Налаштування");
  await fill("#settings-zone", "Pacific/Honolulu");
  await link("Поточні задачі");
  await wait("document.querySelector('dialog[open]')!==null");
  await click("Залишитися"); await wait("!document.querySelector('dialog[open]')");
  assert.equal(await evaluate("document.querySelector('#settings-zone').value"), "Pacific/Honolulu");
  await link("Поточні задачі"); await click("Вийти без збереження");
  await wait("!document.querySelector('#mobile-navigation')");
  await active("Поточні задачі");
  passed.push("Mobile dirty Settings: stay retains menu/draft; confirmed navigation closes menu");

  await wait(`${areasButton}===undefined || ${areasButton}?.getAttribute('aria-disabled')==='false'`);
  await wait(`document.querySelector('${taskCard}')!==null`);
  if (await evaluate(`document.querySelector('${taskCard} button[aria-expanded]').getAttribute('aria-expanded')==='false'`)) {
    await evaluate(`document.querySelector('${taskCard} button[aria-expanded]').click()`);
  }
  holdMutation = true; releaseMutation = undefined;
  await evaluate(`document.querySelector('${taskCard} input[aria-label$="підзадачу: Mock Child"]').click()`);
  await wait(`document.querySelector('${taskCard}').getAttribute('aria-busy')==='true'`);
  await link("Налаштування");
  assert.equal(await evaluate("!!document.querySelector('#mobile-navigation')"), true);
  assert.equal(await evaluate("location.pathname"), "/tasks");
  for (let i = 0; i < 100 && !releaseMutation; i++) await delay(50);
  assert(releaseMutation); holdMutation = false; releaseMutation();
  await escape(); await wait("!document.querySelector('#mobile-navigation')");
  await wait(`document.querySelector('${taskCard}').getAttribute('aria-busy')==='false'`);
  passed.push("Mobile pending mutation keeps blocked navigation/menu and Task workspace intact");

  for (const width of [1440, 390, 720]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 400, deviceScaleFactor: 1, mobile: false });
    await menu();
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    assert.equal(await evaluate("(()=>{const n=document.querySelector('nav');const f=n.lastElementChild;const m=n.firstElementChild;return f.getBoundingClientRect().top>=m.getBoundingClientRect().bottom})()"), true);
    await active("Поточні задачі");
  }
  passed.push("Low 1440/390/720 × 400 viewports: footer never overlaps modules, no horizontal overflow (layout checks only, not native browser zoom)");
  await menu(); await click("Вийти");
  await wait("document.querySelector('#access-password')!==null");
  assert.equal(await evaluate("document.querySelector('nav')===null"), true);
  passed.push("Mobile logout returns to access gate");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, apiCalls: calls.length, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passed, errors, state: await evaluate("({path:location.pathname+location.search,dialogs:[...document.querySelectorAll('dialog')].map(e=>({open:e.open,text:e.innerText.slice(0,180)}))})") }, null, 2)); throw error;
} finally { await cdp("Page.close"); socket.close(); }
