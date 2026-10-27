// Optional real-browser suite, no added dependencies. Start frontend and a headless Chromium/Edge
// with --remote-debugging-port=9223 and a dedicated temporary --user-data-dir first.
// APP_URL=http://localhost:3000 node tests/routine-schedule-browser.mjs
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { routine as fixture, routineId, versions as initialVersions, configuration, generationPreview, generationResult, range, futureTask } from "./routine-fixtures.mjs";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const originalTask = JSON.stringify(futureTask);
const debugUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const target = await (await fetch(`${debugUrl}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let sequence = 0;
const pending = new Map(), handlers = new Map(), calls = [], errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
  } else for (const handler of handlers.get(message.method) ?? []) void Promise.resolve(handler(message.params)).catch((error) => {
    if (!error.message.includes("Invalid InterceptionId")) errors.push(error.message);
  });
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const on = (method, handler) => handlers.set(method, [...handlers.get(method) ?? [], handler]);
const evaluate = async (expression) => {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " " + result.exceptionDetails.exception?.description);
  return result.result.value;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression, label = expression) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(`Timeout: ${label}\n${await evaluate("document.body.innerText")}`);
}
const scope = `(Array.from(document.querySelectorAll('dialog[open]')).at(-1) || document)`;
async function tap(expression) {
  // Let any outcome-focus animation frame finish before scrolling to the next target.
  await delay(50);
  const point = await evaluate(`(() => { const e=${expression}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}
async function click(text) {
  const expression = `[...${scope}.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)})`;
  assert(await evaluate(`!!(${expression}) && !(${expression}).disabled`), `Unavailable button: ${text}`);
  await tap(expression);
}
async function fill(selector, value) {
  await evaluate(`(() => { const input = ${scope}.querySelector(${JSON.stringify(selector)}); if (!input) throw new Error('No input '+${JSON.stringify(selector)}); input.focus(); const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
}
const bodyIncludes = (text) => `document.body?.innerText.includes(${JSON.stringify(text)})`;
let routine, versions, postMode, failVersionGet, failRoutineGet, releasePost, generationMode, generationPosts, patchMode;
function reset() {
  routine = structuredClone(fixture); versions = structuredClone(initialVersions); postMode = "success";
  failVersionGet = false; failRoutineGet = false; releasePost = null; generationMode = "initial"; generationPosts = [];
  patchMode = "success";
}
reset();
on("Runtime.exceptionThrown", (event) => errors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
on("Page.javascriptDialogOpening", () => cdp("Page.handleJavaScriptDialog", { accept: true }));
on("Fetch.requestPaused", async ({ requestId, request, resourceType }) => {
  const url = new URL(request.url), method = request.method;
  const apiRequest = url.pathname.startsWith("/api/") || ((resourceType === "Fetch" || resourceType === "XHR") && !url.searchParams.has("_rsc") && /^\/(routines|areas|tasks)(\/|$)/.test(url.pathname));
  if (!apiRequest) {
    if (request.url.startsWith(appUrl) || url.protocol === "data:") await cdp("Fetch.continueRequest", { requestId });
    else await cdp("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
    return;
  }
  let response = [], status = 200;
  const route = url.pathname.replace(/^\/api/, "");
  calls.push({ route, method, body: request.postData });
  if (method === "OPTIONS") status = 204;
  else if (route === "/areas") response = [];
  else if (route === "/routines" && method === "GET") response = [routine];
  else if (route.endsWith("/schedule-versions")) {
    if (method === "GET") {
      if (failVersionGet) { status = 500; response = { error: { message: "Mock GET failed" } }; }
      else response = versions;
    } else {
      if (postMode === "delayed") await new Promise((resolve) => { releasePost = resolve; });
      if (postMode === "400" || postMode === "409") { status = Number(postMode); response = { error: { message: postMode === "409" ? "effectiveDate must be strictly later than the latest schedule version." : "Invalid input.", details: [{ path: ["schedule", "localTime"] }] } }; }
      else if (postMode === "uncertain") { await cdp("Fetch.failRequest", { requestId, errorReason: "ConnectionClosed" }); return; }
      else {
        const input = JSON.parse(request.postData), number = versions.length + 1;
        const created = { ...versions.at(-1), ...input, number, id: `33333333-3333-4333-8333-${String(number).padStart(12, "0")}`,
          effectiveAt: `${input.effectiveDate.slice(0, 8)}${input.effectiveDate.slice(8)}T00:00:00Z` };
        // Fixtures use November dates in Europe/Kyiv: local midnight is previous-day 22:00Z.
        const date = new Date(`${input.effectiveDate}T00:00:00Z`); date.setUTCHours(-2); created.effectiveAt = date.toISOString();
        versions.push(created); routine = { ...routine, timezone: input.timezone, startDate: input.startDate, schedule: input.schedule, endCondition: input.endCondition };
        response = created; status = 201;
        if (postMode === "success-get-fail") failVersionGet = true;
        if (postMode === "success-routine-get-fail") failRoutineGet = true;
      }
    }
  } else if (route.endsWith("/generation-preview")) {
    response = { ...generationPreview, from: url.searchParams.get("from"), to: url.searchParams.get("to"),
      occurrences: generationMode === "changed" ? [{ ...generationPreview.occurrences[0], occurrenceKey: "replacement:schedule:4" }, generationPreview.occurrences[1]] : generationPreview.occurrences };
  } else if (route.endsWith("/preview")) response = { ...generationPreview, from: url.searchParams.get("from"), to: url.searchParams.get("to"), truncated: false, limitations: [] };
  else if (route.endsWith("/generate")) {
    generationPosts.push(request.postData);
    if (generationMode === "uncertain") { await cdp("Fetch.failRequest", { requestId, errorReason: "ConnectionClosed" }); return; }
    if (generationMode === "error") { status = 400; response = { error: { message: "Invalid planning." } }; }
    else if (generationMode === "invalid") response = {};
    else response = { ...generationResult, from: JSON.parse(request.postData).from, to: JSON.parse(request.postData).to,
      ...(generationMode === "empty" ? { createdCount: 0, existingCount: 0, created: [], existing: [], conflicts: undefined } : {}) };
  } else if (route === `/routines/${routineId}`) {
    if (method === "PATCH" && patchMode !== "error") { const patch = JSON.parse(request.postData); routine = { ...routine, ...patch, ...(patch.paused === undefined ? {} : { pausedAt: patch.paused ? "2026-10-26T12:00:00Z" : null }) }; }
    response = routine;
    if (method === "PATCH" && patchMode === "error") { status = 400; response = { error: { message: "Invalid horizon", details: [{ path: ["generationHorizonDays"] }] } }; }
    if (method === "PATCH" && patchMode === "invalid") response = { ...routine, generationHorizonDays: 31 };
    if (method === "GET" && failRoutineGet) { status = 500; response = { error: { message: "Mock Routine GET failed" } }; }
    if (method === "DELETE") status = 204;
  } else if (route === "/routines" && method === "POST") { routine = { ...routine, ...JSON.parse(request.postData) }; response = routine; status = 201; }
  else { status = 404; response = { error: { message: "Unexpected mock route" } }; }
  await cdp("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [
    { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
    { name: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" }, { name: "Access-Control-Allow-Headers", value: "Content-Type" },
  ], body: status === 204 ? "" : Buffer.from(JSON.stringify(response)).toString("base64") });
});
await cdp("Runtime.enable"); await cdp("Page.enable");
if (process.env.APP_ACCESS_TEST_PASSWORD) await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `localStorage.setItem('personal-platform.access-password', ${JSON.stringify(process.env.APP_ACCESS_TEST_PASSWORD)});`,
});
await cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
async function navigate() {
  await cdp("Page.navigate", { url: `${appUrl}/routines` });
  await waitFor(bodyIncludes("Mock Routine"));
  await waitFor("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Деталі'&&!e.disabled)");
}
async function openSchedule() {
  await click("Деталі"); await waitFor(bodyIncludes("Початковий"));
  await click("Змінити розклад"); await waitFor(bodyIncludes("Основа чернетки"));
}
async function confirm() { await tap(`${scope}.querySelector('input[type="checkbox"]')`); }
const postCount = () => calls.filter((call) => call.method === "POST" && call.route.endsWith("/schedule-versions")).length;
const passed = [];
async function closeResult(openerText, escape = false) {
  await waitFor("document.querySelector('dialog[data-routine-result=\"true\"][open]')!==null");
  await waitFor(`!${scope}.innerText.includes('Оновлення даних…')`);
  assert.equal(await evaluate(`${scope}.querySelector('form')===null`), true);
  for (const width of [1440, 390]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const geometry = await evaluate(`(() => { const r=${scope}.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})()`);
    assert(geometry.left >= 0 && geometry.right <= width + 1 && geometry.width <= 560, JSON.stringify(geometry));
  }
  assert.equal(await evaluate("document.activeElement.textContent.trim()"), "Закрити");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate(`${scope}.contains(document.activeElement)`), true);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
  await delay(100); const beforeClose = calls.length;
  if (escape) {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  } else await click("Закрити");
  await waitFor("document.querySelector('dialog[data-routine-result=\"true\"]')===null");
  await waitFor(`document.activeElement?.textContent.trim()===${JSON.stringify(openerText)}`);
  await delay(150); assert.equal(calls.length, beforeClose, "closing result sends no requests");
}
try {
  await navigate();
  assert.equal(calls.filter((call) => call.route.endsWith("/schedule-versions")).length, 0, "no per-card version requests");
  failVersionGet = true; await click("Деталі"); await waitFor(bodyIncludes("Повторити GET версій"));
  const getRoutineCount = calls.filter((call) => call.route === `/routines/${routineId}`).length;
  failVersionGet = false; await click("Повторити GET версій"); await waitFor(bodyIncludes("Початковий"));
  assert.equal(calls.filter((call) => call.route === `/routines/${routineId}`).length, getRoutineCount);
  assert(await evaluate(bodyIncludes("Чинний"))); assert(await evaluate(bodyIncludes("Майбутній"))); assert(await evaluate(bodyIncludes("Попередній")));
  passed.push("independent GET/retry; no per-card requests; initial/current/future");
  await click("Змінити розклад"); await waitFor(bodyIncludes("Основа чернетки"));
  assert.equal(await evaluate(`${scope}.querySelector('input[type="date"]').value`), "2090-11-02");
  assert.equal(await evaluate(`${scope}.querySelector('input').id || ''`), "");
  assert.equal(await evaluate(`${scope}.querySelector('#routine-recurrence option[value="AFTER_COMPLETION"]')===null`), true);
  await evaluate(`[...${scope}.querySelectorAll('button:not(:disabled)')].at(-1).focus()`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Закрити зміну розкладу");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
  assert.equal(await evaluate("document.activeElement.textContent.trim()"), "Скасувати");
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    await evaluate(`document.documentElement.setAttribute('data-theme',${JSON.stringify(theme)})`);
    await delay(100);
    const geometry = await evaluate(`(() => { const d=${scope}; return {width:innerWidth, left:d.getBoundingClientRect().left,right:d.getBoundingClientRect().right,scroll:d.scrollWidth,client:d.clientWidth};})()`);
    assert(geometry.left >= 0 && geometry.right <= width + 1 && geometry.scroll <= geometry.client + 1, JSON.stringify(geometry));
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    const file = path.join(tmpdir(), `routine-schedule-${width}-${theme}.png`); await writeFile(file, Buffer.from(screenshot.data, "base64"));
    console.log(`Screenshot: ${file}`);
  }
  passed.push("1440/390 light/dark; modal fits viewport");
  await fill("#routine-localTime", "10:30");
  await delay(100);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("document.querySelectorAll('dialog[open]').length===3");
  await click("Продовжити редагування");
  await waitFor("document.querySelectorAll('dialog[open]').length===2");
  assert.equal(await evaluate(`${scope}.querySelector('#routine-localTime').value`), "10:30");
  await confirm(); postMode = "delayed";
  const before = postCount();
  await evaluate(`${scope}.querySelector('form').requestSubmit(); ${scope}.querySelector('form').requestSubmit();`);
  for (let i = 0; i < 100 && !releasePost; i++) await delay(20);
  assert.equal(postCount(), before + 1);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 2);
  postMode = "success-get-fail"; releasePost();
  await waitFor(bodyIncludes("повторний POST заблоковано"));
  assert(await evaluate(bodyIncludes("успішно створено")));
  assert(await evaluate(`${scope}.innerText.includes('02.11.2090')`));
  assert.equal(await evaluate(`${scope}.querySelector('form')===null`), true);
  const payload = JSON.parse(calls.filter((call) => call.method === "POST" && call.route.endsWith("/schedule-versions")).at(-1).body);
  assert.deepEqual(payload, { effectiveDate: "2090-11-02", ...configuration, schedule: { ...configuration.schedule, localTime: "10:30" } });
  failVersionGet = false; await click("Оновити дані (лише GET)"); await waitFor(`!${scope}.innerText.includes('Оновлення даних…')`);
  assert.equal(postCount(), before + 1); await closeResult("Змінити розклад");
  await waitFor("document.querySelectorAll('dialog[open]').length===1");
  passed.push("draft/Escape/discard; double submit; close blocked during POST; success + failed GET + GET-only retry; full payload");
  reset(); await navigate(); await openSchedule(); await confirm(); await click("Створити версію");
  await waitFor(bodyIncludes("Версію №4 успішно створено")); await closeResult("Змінити розклад", true);
  passed.push("schedule success uses separate compact result; Escape/Tab/close restore opener; closing performs no GET");
  reset(); await navigate(); await openSchedule(); await confirm(); postMode = "success-routine-get-fail"; await click("Створити версію");
  await waitFor(bodyIncludes("повторний POST заблоковано"));
  assert(await evaluate(`${scope}.innerText.includes('Версію №4 успішно створено')`));
  await closeResult("Змінити розклад", true);
  passed.push("Routine GET failure after schedule POST stays a success; result can close without retry or requests");

  for (const mode of ["400", "409", "uncertain"]) {
    reset(); await navigate(); await openSchedule(); await fill("#routine-localTime", "11:45"); await confirm(); postMode = mode;
    const before = postCount(); await click("Створити версію");
    await waitFor(mode === "uncertain" ? bodyIncludes("Версію могло бути створено") : mode === "409" ? bodyIncludes("строго пізнішою") : bodyIncludes("Перевірте введені"));
    assert.equal(await evaluate(`${scope}.querySelector('#routine-localTime').value`), "11:45");
    if (mode === "uncertain") { await click("Перевірити версії (лише GET)"); await waitFor(bodyIncludes("Перевірено версії")); assert.equal(postCount(), before + 1); }
  }
  passed.push("400/409 preserve draft; uncertain result offers GET and never repeats POST");

  reset(); await navigate(); await click("Редагувати"); await waitFor(bodyIncludes("Редагувати повторення"));
  assert.equal(await evaluate(`${scope}.querySelector('#routine-recurrence')===null`), true);
  await fill("#routine-title", "Edited Routine"); await click("Зберегти зміни"); await waitFor(bodyIncludes("Шаблон повторення оновлено"));
  assert.deepEqual(JSON.parse(calls.filter((call) => call.method === "PATCH").at(-1).body), { title: "Edited Routine" });
  passed.push("ordinary PATCH sends template fields only");

  reset(); await navigate();
  const automationStart = calls.length;
  await click("Деталі"); await waitFor(bodyIncludes("Вимкнено"));
  assert(await evaluate(bodyIncludes("Пауза Routine призупиняє і автоматичне створення")));
  await tap(`${scope}.querySelector('button[aria-label]')`); await click("Редагувати"); await waitFor(bodyIncludes("Редагувати повторення"));
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    await tap(`${scope}.querySelector('#routine-autoGenerate')`);
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.activeElement.id"), "routine-generationHorizonDays");
    const geometry = await evaluate(`(() => { const r=${scope}.querySelector('#routine-generationHorizonDays').getBoundingClientRect(); return {left:r.left,right:r.right}; })()`);
    assert(geometry.left >= 0 && geometry.right <= width + 1);
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(tmpdir(), `routine-automation-${width}-${theme}.png`), Buffer.from(screenshot.data, "base64"));
  }
  assert.equal(await evaluate(`${scope}.querySelector('#routine-autoGenerate').checked`), false);
  for (const value of ["0", "31", "1.5"]) {
    await fill("#routine-generationHorizonDays", value); await click("Зберегти зміни");
    await waitFor(`${scope}.querySelector('#routine-generationHorizonDays').getAttribute('aria-invalid')==='true'`);
    await waitFor("document.activeElement.id==='routine-generationHorizonDays'");
  }
  await fill("#routine-generationHorizonDays", "30");
  await tap(`${scope}.querySelector('#routine-autoGenerate')`);
  await tap(`${scope}.querySelector('#routine-autoGenerate')`);
  assert.equal(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays').value`), "30");
  await click("Скасувати"); await waitFor(bodyIncludes("Продовжити редагування")); await click("Продовжити редагування");
  assert.equal(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays').value`), "30");
  await tap(`${scope}.querySelector('#routine-autoGenerate')`);
  patchMode = "error"; await click("Зберегти зміни"); await waitFor(`${scope}.querySelector('#routine-generationHorizonDays').getAttribute('aria-invalid')==='true'`);
  assert.equal(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays').value`), "30");
  patchMode = "invalid"; await click("Зберегти зміни"); await waitFor(`${scope}.querySelector('[role="alert"]')!==null`);
  patchMode = "success"; await click("Зберегти зміни"); await waitFor(bodyIncludes("Автоматично · 30 днів"));
  assert.deepEqual(JSON.parse(calls.filter(c=>c.method==='PATCH').at(-1).body), { autoGenerate: true, generationHorizonDays: 30 });
  await click("Редагувати"); await waitFor(bodyIncludes("Редагувати повторення"));
  await tap(`${scope}.querySelector('#routine-autoGenerate')`); await click("Зберегти зміни"); await waitFor("document.querySelectorAll('dialog[open]').length===0");
  assert.deepEqual(JSON.parse(calls.filter(c=>c.method==='PATCH').at(-1).body), { autoGenerate: false });
  await click("Редагувати"); await waitFor(bodyIncludes("Редагувати повторення"));
  assert.equal(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays').value`), "30");
  await tap(`${scope}.querySelector('#routine-autoGenerate')`); await click("Зберегти зміни"); await waitFor("document.querySelectorAll('dialog[open]').length===0");
  assert.deepEqual(JSON.parse(calls.filter(c=>c.method==='PATCH').at(-1).body), { autoGenerate: true });
  await click("Призупинити"); await waitFor(bodyIncludes("Шаблон призупинено."));
  await click("Деталі"); await waitFor(bodyIncludes("Пауза Routine призупиняє і автоматичне створення")); await tap(`${scope}.querySelector('button[aria-label]')`);
  assert(calls.slice(automationStart).every(c=>!c.route.endsWith('/generate')&&!c.route.endsWith('/schedule-versions') || c.method==='GET'));
  assert.equal(generationPosts.length, 0);
  reset(); await navigate(); await click("Нове повторення"); await waitFor(bodyIncludes("Це шаблон повторення"));
  assert.equal(await evaluate(`${scope}.querySelector('#routine-autoGenerate').checked`), false);
  assert.equal(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays').value`), "7");
  await fill("#routine-generationHorizonDays", "30"); await fill("#routine-recurrence", "AFTER_COMPLETION");
  assert(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays')===null`));
  await fill("#routine-recurrence", "DAILY");
  assert.equal(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays').value`), "30");
  await fill("#routine-recurrence", "AFTER_COMPLETION"); await tap(`${scope}.querySelector('#routine-autoGenerate')`);
  await fill("#routine-title", "Completion Auto"); await fill("#routine-duration", "25"); await click("Створити шаблон");
  await waitFor(bodyIncludes("Автоматично · після завершення або пропуску"));
  assert.equal(JSON.parse(calls.filter(c=>c.route==='/routines'&&c.method==='POST').at(-1).body).generationHorizonDays, 30);
  await click("Редагувати"); await waitFor(bodyIncludes("Редагувати повторення"));
  assert(await evaluate(`${scope}.querySelector('#routine-generationHorizonDays')===null`)); await click("Скасувати");
  assert.equal(generationPosts.length, 0);
  passed.push("automation: defaults, 1–30 validation/focus, 1440/390 light/dark keyboard, draft/discard, off/on retention, minimal PATCH, API errors/invalid DTO, completion, pause; no generation/version POST");

  reset(); await navigate(); await click("Створити задачі"); await waitFor(bodyIncludes("Після підтвердження будуть створені"));
  await fill('input[type="date"]', range.from);
  await fill('input[id$="-to"]', range.to);
  await click("Показати виконання"); await waitFor(bodyIncludes("Пропущено через перетин"));
  await fill('input[type="time"]', "10:00");
  await evaluate(`window.dispatchEvent(new CustomEvent('routine-schedule-changed',{detail:${JSON.stringify(routineId)}}))`);
  await waitFor(bodyIncludes("Розклад змінився"));
  assert.equal(await evaluate(`${scope}.querySelector('input[type="time"]').value`), "10:00");
  assert.equal(await evaluate(`[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()==='Створити задачі').disabled`), true);
  generationMode = "changed"; await click("Показати виконання"); await waitFor(bodyIncludes("Планування для 1 виконань вилучено"));
  assert.equal(await evaluate(`${scope}.querySelector('input[type="time"]').value`), "");
  await fill('input[type="time"]', "12:00");
  generationMode = "error"; await click("Створити задачі");
  await waitFor(`${scope}.querySelector('[role="alert"]')!==null`);
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
  assert.equal(await evaluate(`${scope}.querySelector('input[type="time"]').value`), "12:00");
  generationMode = "changed"; await click("Показати виконання");
  await waitFor(`${scope}.querySelector('input[type="time"]').disabled===false`);
  generationMode = "uncertain"; await click("Створити задачі"); await waitFor(bodyIncludes("Повторити точний запит"));
  assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
  assert.equal(await evaluate(`${scope}.querySelector('input[type="time"]').value`), "12:00");
  assert.equal(generationPosts.length, 2, "no automatic POST after failure or uncertainty");
  const exact = generationPosts.at(-1); generationMode = "initial";
  await click("Показати виконання");
  await waitFor(`${scope}.querySelector('input[type="time"]').disabled===false`);
  await fill('input[type="time"]', "13:30");
  await click("Повторити точний запит"); await waitFor(bodyIncludes("Створено задач:"));
  assert(await evaluate(`${scope}.innerText.includes('уже є задача з календарним вікном, що перетинається')`));
  await closeResult("Створити задачі", true);
  assert(await evaluate(bodyIncludes("Створено задач: 1. Уже існувало: 1")));
  assert(await evaluate("document.querySelector('[role=\"status\"]').textContent.includes('Створено задач: 1. Уже існувало: 1')"));
  assert(!await evaluate(bodyIncludes("Відкинути зміни?")));
  await tap("[...document.querySelectorAll('summary')].find(e=>e.textContent.includes('Конфлікти останньої генерації'))");
  assert(await evaluate(bodyIncludes("уже є задача з календарним вікном, що перетинається")));
  assert.equal(generationPosts.at(-1), exact);
  assert.equal(await evaluate(bodyIncludes("Уже існувало:")), true);
  assert(!JSON.parse(exact).planning.some((entry) => entry.occurrenceKey === "stored-future"));
  passed.push("conflicts excluded from success; stale planning removed with notice; exact uncertain generation retry; existing future Task untouched");
  assert.equal(JSON.stringify(futureTask), originalTask);
  assert(!calls.some((call) => call.route.startsWith("/tasks") && call.method !== "GET" && call.method !== "OPTIONS"));
  for (const mode of ["initial", "empty", "invalid"]) {
    reset(); await navigate(); await click("Створити задачі"); await waitFor(bodyIncludes("Після підтвердження будуть створені"));
    await fill('input[type="date"]', range.from); await fill('input[id$="-to"]', range.to);
    await click("Показати виконання"); await waitFor(`${scope}.querySelector('input[type="time"]')!==null`);
    await fill('input[type="time"]', "10:15"); generationMode = mode;
    await click("Створити задачі");
    if (mode === "invalid") {
      await waitFor(bodyIncludes("Повторити точний запит"));
      assert.equal(await evaluate("document.querySelectorAll('dialog[open]').length"), 1);
      assert.equal(await evaluate(`${scope}.querySelector('input[type="time"]').value`), "10:15");
    } else {
      await waitFor(bodyIncludes("Результат генерації"));
      assert(await evaluate(`${scope}.innerText.includes('Створено задач:')`));
      await closeResult("Створити задачі");
      await waitFor("document.querySelectorAll('dialog[open]').length===0");
      await waitFor("document.activeElement?.textContent.trim()==='Створити задачі'");
      assert(await evaluate(bodyIncludes(`Створено задач: ${mode === "empty" ? 0 : 1}. Уже існувало: ${mode === "empty" ? 0 : 1}`)));
      assert.equal(await evaluate("[...document.querySelectorAll('summary')].some(e=>e.textContent.includes('Конфлікти останньої генерації'))"), mode !== "empty");
    }
    assert.equal(generationPosts.length, 1);
  }
  passed.push("valid generation closes directly, restores focus, announces counts and keeps conflicts; 400/network/invalid DTO stay open; exact retry closes despite newer drafts; zero counts");

  reset(); await navigate(); await click("Призупинити"); await waitFor(bodyIncludes("Шаблон призупинено."));
  await click("Відновити"); await waitFor(bodyIncludes("Шаблон відновлено."));
  await click("Видалити"); await waitFor(bodyIncludes("Видалити повторення?")); await click("Видалити повторення");
  await waitFor(bodyIncludes("Шаблон повторення видалено"));
  reset(); await navigate(); await click("Нове повторення"); await waitFor(bodyIncludes("Це шаблон повторення"));
  await fill("#routine-title", "Created Routine"); await fill("#routine-duration", "25"); await click("Створити шаблон");
  await waitFor(bodyIncludes("Шаблон повторення створено"));
  assert(JSON.parse(calls.filter((call) => call.route === "/routines" && call.method === "POST").at(-1).body).schedule);
  passed.push("creation with initial calendar, pause/resume, deletion regression; no Task writes");
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(JSON.stringify({ passed, apiCalls: calls.length, runtimeErrors: errors }, null, 2));
} finally {
  await cdp("Page.close"); socket.close();
}
