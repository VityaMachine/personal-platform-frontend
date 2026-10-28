// Use a dedicated headless Chromium profile with CDP on port 9223.
// APP_URL and APP_ACCESS_TEST_PASSWORD must describe a test build, never a real password/API.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3100";
const debugUrl = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const password = process.env.APP_ACCESS_TEST_PASSWORD;
const key = "personal-platform.access-password";
const errors = [], calls = [];
async function connection() {
  const target = await (await fetch(`${debugUrl}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let sequence = 0;
  const pending = new Map(), handlers = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request.reject(Error(`CDP ${message.error.code}: ${message.error.message}`)); else request.resolve(message.result);
    } else for (const handler of handlers.get(message.method) ?? []) void Promise.resolve(handler(message.params)).catch(error => errors.push(`${message.method}: ${error.message}`));
  });
  return {
    cdp: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    }),
    on: (name, handler) => handlers.set(name, [...handlers.get(name) ?? [], handler]),
    socket,
  };
}
const main = await connection(); const { cdp, on } = main;
async function evaluate(expression, channel = main) {
  const result = await channel.cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error("Browser evaluation failed");
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
  for (let i = 0; i < 200; i++) {
    try { if (await evaluate(expression)) return; } catch { /* A navigation may still be replacing the document. */ }
    await delay(50);
  }
  throw Error("Browser condition timed out"); // Never print expressions or DOM values containing passwords.
}
async function button(label) {
  await evaluate(`(()=>{const e=[...document.querySelectorAll('dialog[open] button,button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}); if(!e||e.disabled)throw Error();e.click();})()`);
}
async function fill(selector, value) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
async function enter() {
  await evaluate("document.querySelector('#access-password').focus()");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
}
on("Runtime.exceptionThrown", () => errors.push("Browser runtime exception"));
on("Runtime.consoleAPICalled", ({ type, args }) => {
  if (type === "error" && args.some(arg => /hydration|hydrated/i.test(arg.value ?? ""))) errors.push("Hydration error");
});
on("Fetch.requestPaused", async ({ requestId, request, resourceType }) => {
  const url = new URL(request.url);
  if (url.hostname === "mock.invalid" || url.pathname.startsWith("/api/")) {
    calls.push({ method: request.method, route: url.pathname });
    assert.equal(request.method, "GET");
    await cdp("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [
      { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
    ], body: Buffer.from("[]").toString("base64") });
  } else if ([appUrl, process.env.MISSING_APP_URL].filter(Boolean).some(origin=>request.url.startsWith(origin)) || url.protocol === "data:") {
    await cdp("Fetch.continueRequest", { requestId });
  } else if (resourceType === "Fetch" || resourceType === "XHR") {
    calls.push({ method: request.method, route: "unexpected" });
    await cdp("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
  } else await cdp("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
});
await cdp("Runtime.enable"); await cdp("Page.enable");
await cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
let init;
async function navigate(route, saved = null, unavailable = false) {
  if (init) await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: init });
  const source = unavailable ? `Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Unavailable','SecurityError')}});`
    : `localStorage.removeItem(${JSON.stringify(key)});${saved === null ? "" : `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(saved)});`}`;
  init = (await cdp("Page.addScriptToEvaluateOnNewDocument", { source })).identifier;
  await cdp("Page.navigate", { url: `${appUrl}${route}` });
}
const loginVisible = "document.querySelector('#access-password')!==null";
const authorized = "[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Вийти')";
let other;
try {
  if (process.env.MISSING_APP_URL) {
    for (const route of ["/", "/routines?keep=1", "/settings?keep=1"]) {
      await cdp("Page.navigate", { url: `${process.env.MISSING_APP_URL}${route}` });
      await waitFor("document.body.innerText.includes('Пароль доступу не налаштовано')");
      assert.equal(await evaluate(loginVisible), false);
    }
    assert.equal(calls.length, 0);
    console.log("Missing env: closed on all routes; no application data requests.");
  }
  if (process.env.ACCESS_MISSING_ONLY) {
    assert.deepEqual(errors, []);
  } else {
    assert(password, "APP_ACCESS_TEST_PASSWORD required for test build");
    for (const route of ["/?view=today&keep=1", "/routines?keep=1", "/settings?keep=1"]) {
      const before = calls.length;
      await navigate(route); await waitFor(loginVisible); await delay(150);
      assert.equal(calls.length, before);
      assert.equal(await evaluate("location.pathname+location.search"), route);
      await waitFor("document.activeElement.id==='access-password'");
    }
    for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
      assert(await evaluate(`document.documentElement.scrollWidth<=${width}`));
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(tmpdir(), `app-access-${width}-${theme}.png`), Buffer.from(shot.data, "base64"));
    }
    await fill("#access-password", password.trim()); await enter();
    await waitFor("document.querySelector('#access-error')?.textContent==='Неправильний пароль. Введіть ще раз'");
    await fill("#access-password", password); await waitFor("!document.querySelector('#access-error')"); await enter();
    await waitFor(authorized); await waitFor("document.querySelector('#settings-zone')!==null");
    assert(await evaluate(`localStorage.getItem(${JSON.stringify(key)})===${JSON.stringify(password)}`));
    assert.equal(await evaluate("location.pathname+location.search"), "/settings?keep=1");
    await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: init }); init = null;
    await cdp("Page.reload"); await waitFor(authorized);
    await waitFor("document.querySelector('#settings-zone')!==null");
    await fill("#settings-zone", "UTC");
    // Ensure a changed value even when the browser's timezone already is UTC.
    await fill("#settings-zone", "Pacific/Honolulu");
    const beforeLogout = calls.length;
    await button("Вийти"); await waitFor("document.querySelector('dialog[open][role=alertdialog]')!==null");
    assert(await evaluate(`localStorage.getItem(${JSON.stringify(key)})===${JSON.stringify(password)}`));
    await button("Залишитися"); await waitFor("!document.querySelector('dialog[open]')");
    assert.equal(await evaluate("document.querySelector('#settings-zone').value"), "Pacific/Honolulu");
    await button("Вийти"); await waitFor("document.querySelector('dialog[open][role=alertdialog]')!==null");
    await button("Вийти без збереження"); await waitFor(loginVisible);
    assert.equal(calls.length, beforeLogout);
    assert(await evaluate(`localStorage.getItem(${JSON.stringify(key)})===null`));
    await navigate("/routines?keep=1", "incorrect"); await waitFor(loginVisible);
    await navigate("/routines?keep=1", password); await waitFor(authorized);
    other = await connection();
    await other.cdp("Page.navigate", { url: `${appUrl}/settings` });
    await delay(300);
    await evaluate(`localStorage.removeItem(${JSON.stringify(key)})`, other); await waitFor(loginVisible);
    await evaluate(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(password)})`, other); await waitFor(authorized);
    await evaluate(`localStorage.setItem(${JSON.stringify(key)},'incorrect')`, other); await waitFor(loginVisible);
    await evaluate("localStorage.clear()", other);
    const beforeUnavailable = calls.length;
    await navigate("/?view=today&keep=1", null, true); await waitFor(loginVisible);
    assert.equal(calls.length, beforeUnavailable);
    await waitFor("document.body.innerText.includes('Після оновлення пароль доведеться ввести знову')");
    await fill("#access-password", password); await enter(); await waitFor(authorized);
    await waitFor("document.body.innerText.includes('Вхід діє лише в поточній вкладці')");
    await cdp("Page.reload"); await waitFor(loginVisible);
    assert(calls.every(call=>call.method==='GET'&&call.route!=='unexpected'));
    assert.deepEqual(errors, []);
    console.log("Access browser checks passed: routes/query, no requests before login, exact input, F5, storage, other tab, unavailable storage, guarded logout, 1440/390 light/dark; no API mutations or hydration errors.");
  }
} finally {
  if (other) { await other.cdp("Page.close"); other.socket.close(); }
  await cdp("Page.close"); main.socket.close();
}
