// Test build only: mock.invalid API, APP_ACCESS_TEST_PASSWORD, dedicated CDP profile.
import assert from "node:assert/strict";

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
const area = { id: "11111111-1111-4111-8111-111111111111", name: "Mock Area", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") errors.push("Browser runtime exception");
  else if (message.method === "Fetch.requestPaused") void intercept(message.params).catch(error => errors.push(`CDP interception: ${error.message}`));
});
async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  if (url.hostname === "mock.invalid") {
    calls.push({ method: request.method, route: url.pathname });
    assert.equal(request.method, "GET", "This scenario must not mutate API data");
    assert.equal(url.pathname, "/areas");
    await cdp("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [
      { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" },
    ], body: Buffer.from(JSON.stringify([area])).toString("base64") });
  } else if (url.origin === new URL(app).origin) await cdp("Fetch.continueRequest", { requestId });
  else await cdp("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
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
  await evaluate(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e||e.disabled)throw Error('Unavailable button');e.click();})()`);
}
async function escape() {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
}
const passed = [];
try {
  await cdp("Runtime.enable"); await cdp("Page.enable");
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  const init = await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: "localStorage.removeItem('personal-platform.access-password');localStorage.removeItem('personal-platform.settings');",
  });
  await cdp("Page.navigate", { url: `${app}/settings` });
  await wait("document.querySelector('#access-password')!==null");
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: init.identifier });
  await evaluate(`localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});localStorage.removeItem('personal-platform.settings')`);
  await cdp("Page.navigate", { url: `${app}/settings?keep=stage2` });
  await wait("document.querySelector('#settings-zone')!==null");
  await wait("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Сфери')?.getAttribute('aria-disabled')==='false'");
  await fill("#settings-zone", "Pacific/Honolulu");
  await fill("#settings-theme", "dark");
  await click("Сфери");
  await wait("document.querySelector('dialog[role=alertdialog][open]')!==null");
  await click("Залишитися");
  await wait("!document.querySelector('dialog[open]')");
  assert.equal(await evaluate("document.querySelector('#settings-zone').value"), "Pacific/Honolulu");
  passed.push("Settings draft retained when staying before opening Areas");
  await click("Зберегти");
  await wait("JSON.parse(localStorage.getItem('personal-platform.settings')).timeZone==='Pacific/Honolulu'");
  await wait("getComputedStyle(document.documentElement).colorScheme==='dark'");
  await click("Сфери");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Mock Area')");
  const input = "dialog[open] input";
  await wait("document.activeElement===document.querySelector('dialog[open] input')");
  await fill(input, "Draft Area"); await escape();
  await wait("document.querySelector('dialog[role=alertdialog][open]')!==null");
  await click("Продовжити редагування");
  await wait("document.querySelectorAll('dialog[open]').length===1");
  assert.equal(await evaluate("document.querySelector('dialog[open] input').value"), "Draft Area");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Відкинути зміни"); await wait("!document.querySelector('dialog[open]')");
  await wait("document.activeElement?.textContent.trim()==='Сфери'");
  passed.push("Areas opens, loads mocked directory, focuses input, preserves/discards draft and returns focus");
  await cdp("Page.reload"); await wait("document.querySelector('#settings-zone')?.value==='Pacific/Honolulu'");
  await wait("getComputedStyle(document.documentElement).colorScheme==='dark'");
  assert.equal(await evaluate("location.search"), "?keep=stage2");
  await fill("#settings-zone", "Europe/Kyiv"); await fill("#settings-theme", "light"); await click("Зберегти");
  await wait("getComputedStyle(document.documentElement).colorScheme==='light'");
  await cdp("Page.reload"); await wait("document.querySelector('#settings-zone')?.value==='Europe/Kyiv'");
  await wait("getComputedStyle(document.documentElement).colorScheme==='light'");
  passed.push("Timezone and light/dark persist after reload; URL query retained");
  assert(calls.length > 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, calls: calls.length, errors }));
} catch (error) {
  console.error(JSON.stringify({ passed, errors })); throw error;
} finally { await cdp("Page.close"); socket.close(); }
