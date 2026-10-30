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
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") errors.push("Browser runtime exception");
  else if (message.method === "Fetch.requestPaused") void intercept(message.params).catch(error => errors.push(`CDP interception: ${error.message}`));
});
let clock = null;
const child = { id: "77777777-7777-4777-8777-777777777777", taskId: futureTask.id, title: "Mock Child", status: "TODO", estimatedDurationMinutes: 10,
 cancellationNote: null, createdAt: futureTask.createdAt, updatedAt: futureTask.updatedAt, deletedAt: null };
function task(archived = false) {
 return { ...futureTask, title: "Route Task", routineOccurrence: null, plannedAt: clock?.plannedAt ?? null,
  isToday: clock ? clock.now >= clock.boundary : true, isBacklog: clock ? clock.now >= clock.boundary : true,
  archivedAt: archived ? futureTask.createdAt : null, subtasks: [child] };
}
async function intercept({ requestId, request }) {
 const url = new URL(request.url);
 if(url.hostname !== "mock.invalid")return cdp(url.origin === new URL(app).origin ? "Fetch.continueRequest" : "Fetch.failRequest", {
  requestId, ...(url.origin === new URL(app).origin ? {} : {errorReason:"BlockedByClient"}),
 });
 const route=url.pathname, method=request.method;calls.push({route,method,query:url.search,body:request.postData});
 assert.equal(method,"GET");
 let data;
 if(route === "/areas")data=[];
 else if(route === "/routines")data=[routineFixture];
 else if(route === "/tasks"){
  const view=url.searchParams.get("view");
  assert(view===null||view==="today"||view==="backlog");
  assert(!(url.searchParams.has("archived")&&view!==null));
  assert(url.searchParams.has("timezone"));
  data=clock&&view&&clock.now<clock.boundary?[]:[task(url.searchParams.get("archived")==="true")];
 } else if(route === "/tasks/"+futureTask.id)data=task();
 else throw Error("Unexpected mock route "+route);
 await cdp("Fetch.fulfillRequest",{requestId,responseCode:200,responseHeaders:[
  {name:"Content-Type",value:"application/json"},{name:"Access-Control-Allow-Origin",value:"*"}
 ],body:Buffer.from(JSON.stringify(data)).toString("base64")});
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
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function click(label) {
  await wait(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});return !!e&&!e.disabled})()`);
  const point = await evaluate(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}
async function escape() {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
}

const passed = [];
const card = `[data-task-id="${futureTask.id}"]`;
const sections = { current: "/tasks", today: "/tasks/today", backlog: "/tasks/backlog", archive: "/tasks/archive" };
const labels = { current: "Поточні задачі", today: "Сьогодні", backlog: "Беклог", archive: "Архів" };
async function ready(section) {
  await wait(`location.pathname===${JSON.stringify(sections[section])}`);
  await wait(`document.querySelector('#tasks-heading')?.textContent===${JSON.stringify(labels[section])}`);
  await wait("document.querySelector('section[aria-labelledby=tasks-heading]')?.getAttribute('aria-busy')==='false'");
}
async function go(section) {
  if (await evaluate("matchMedia('(max-width:760px)').matches&&!document.querySelector('#mobile-navigation')")) {
    await wait("document.querySelector('button[aria-label=\"Відкрити меню\"]')!==null");
    await evaluate("document.querySelector('button[aria-label=\"Відкрити меню\"]').click()");
    await wait("document.querySelector('#mobile-navigation')!==null");
  }
  await wait("document.querySelector('nav')!==null");
  await evaluate(`document.querySelector('nav a[href^="${sections[section]}?"]')?.click() || document.querySelector('nav a[href="${sections[section]}"]')?.click()`);
  await ready(section);
  await wait("!document.querySelector('#mobile-navigation')");
}
async function navigate(url) { await cdp("Page.navigate", { url: app + url }); }

try {
  const redirects = [
    ["/", "/tasks/today"], ["/?keep=1&keep=2", "/tasks/today?keep=1&keep=2"],
    ["/?archived=true&view=today&q=Mock", "/tasks/archive?q=Mock"],
    ["/?archived=false&view=backlog&keep=1", "/tasks/backlog?keep=1"],
    ["/?q=", "/tasks?q="], ["/?status=", "/tasks?status="],
    ["/?view=unknown", "/tasks"], ["/?view=&view=today", "/tasks"],
    ["/?archived=false&archived=true", "/tasks"],
    ["/?archived=true&archived=false", "/tasks/archive"],
    ["/routines?archived=true&view=today&keep=1&keep=2", "/tasks/routines?keep=1&keep=2"],
  ];
  for (const [source, expected] of redirects) {
    const response = await fetch(app + source, { redirect: "manual" });
    assert.equal(response.status, 307, source);
    assert.equal(response.headers.get("location"), expected, source);
    await response.arrayBuffer();
    const destination = await fetch(app + expected, { redirect: "manual" });
    assert.equal(destination.status, 200, "Canonical target must not redirect again");
    assert.equal(destination.headers.has("location"), false); await destination.arrayBuffer();
  }
  passed.push("HTTP: 11 legacy URL cases return temporary 307 directly to a nonredirecting canonical target");

  await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Page.bringToFront");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Network.enable");
  await cdp("Network.setBlockedURLs", { urlPatterns: [
    { urlPattern: `${app}/*`, block: false }, { urlPattern: "http://mock.invalid/*", block: false },
    { urlPattern: "*://*:*/*", block: true },
  ] });
  // Only API interception is needed; browser-cancelled application prefetches stay native.
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "http://mock.invalid/*", requestStage: "Request" }] });
  const init = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.removeItem('personal-platform.access-password')" });
  for (const source of [...Object.values(sections), "/tasks/routines", "/settings", "/?view=today&keep=1", "/routines?view=backlog&keep=1"]) {
    await navigate(source); await wait("document.querySelector('#access-password')!==null");
    assert.equal(await evaluate("document.querySelector('nav')===null"), true);
    assert.equal(calls.length, 0);
  }
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: init.identifier });
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});localStorage.setItem('personal-platform.settings',JSON.stringify({version:1,timeZone:'UTC',language:'uk',theme:'system',todayOverdueMode:'limited',todayOverdueDays:3}));` });
  passed.push("Direct and legacy addresses mount no shell/screens/Areas requests before access");

  for (const [section, url] of Object.entries(sections)) {
    await navigate(url + "?keep=direct"); await ready(section);
    const before = calls.length; await cdp("Page.reload"); await ready(section);
    await wait(`document.querySelector('${card}')!==null`);
    assert(calls.length > before, "F5 must load current data");
    const list = calls.filter(call => call.route === "/tasks").at(-1);
    const query = new URLSearchParams(list.query);
    assert.equal(query.get("archived"), section === "archive" ? "true" : null);
    assert.equal(query.get("view"), section === "today" || section === "backlog" ? section : null);
  }
  for (const [source, expected] of redirects) {
    await navigate(source); await wait(`location.pathname===${JSON.stringify(new URL(expected, app).pathname)} && document.querySelector('nav')!==null`);
    const actual = new URL(await evaluate("location.href"));
    assert.deepEqual([...actual.searchParams], [...new URL(expected, app).searchParams]);
  }
  passed.push("Canonical lists survive direct entry/F5; browser legacy redirects retain query and selector precedence");

  await navigate("/tasks/today?archived=true&view=backlog&q=Route&keep=a&keep=b"); await ready("today");
  assert.equal(new URLSearchParams(calls.filter(call => call.route === "/tasks" && new URLSearchParams(call.query).has("view")).at(-1).query).get("view"), "today");
  const hrefs = await evaluate("[...document.querySelectorAll('nav a')].map(e=>e.href)");
  for (const href of hrefs) {
    const url = new URL(href); assert.equal(url.searchParams.has("view"), false); assert.equal(url.searchParams.has("archived"), false);
    assert.deepEqual(url.searchParams.getAll("keep"), ["a", "b"]); assert.equal(url.searchParams.get("q"), "Route");
  }
  const beforeFilter = calls.filter(call => call.route === "/tasks").length;
  await fill("input[name=q]", "Route ");
  await wait("!new URLSearchParams(location.search).has('view') && !new URLSearchParams(location.search).has('archived')");
  assert.equal(await evaluate("location.pathname"), "/tasks/today");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('q')"), "Route ");
  assert.equal(calls.filter(call => call.route === "/tasks").length, beforeFilter, "Frontend filter changes must not refetch Tasks");
  await evaluate(`(()=>{const e=document.querySelector('${card} button[aria-controls^="task-"]');if(e.getAttribute('aria-expanded')==='false')e.click()})()`);
  for (const section of ["backlog", "archive", "current", "today"]) {
    await go(section);
    assert.equal(await evaluate(`document.querySelector('${card} button[aria-controls^="task-"]').getAttribute('aria-expanded')`), "true");
    assert.equal(await evaluate("document.querySelectorAll('nav').length"), 1);
  }
  await evaluate("history.back()"); await ready("current");
  await evaluate(`window.__owner=document.querySelector('${card}');document.querySelector('${card} [data-task-menu]').click()`);
  await wait("!!document.querySelector('[role=menu] [data-task-action=edit]')");
  await evaluate("document.querySelector('[role=menu] [data-task-action=edit]').click()");
  await wait("document.querySelector('dialog[open] input[name=title]')!==null");
  await fill("dialog[open] input[name=title]", "Draft across pathnames");
  await evaluate("window.__draftDialog=document.querySelector('dialog[open]');history.back()"); await wait("location.pathname==='/tasks/archive'");
  assert.equal(await evaluate("document.querySelector('dialog[open]')===window.__draftDialog && window.__owner.isConnected"), true);
  assert.equal(await evaluate("document.querySelector('dialog[open] input[name=title]').value"), "Draft across pathnames");
  assert.equal(await evaluate("document.querySelector('#tasks-heading').textContent"), "Поточні задачі");
  await evaluate("history.forward()"); await wait("location.pathname==='/tasks'");
  await evaluate("history.back()"); await wait("location.pathname==='/tasks/archive'");
  await wait("document.querySelector('dialog[open]').contains(document.activeElement)");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2");
  await click("Продовжити редагування"); await wait("document.querySelectorAll('dialog[open]').length===1");
  await wait("document.querySelector('dialog[open]').contains(document.activeElement)");
  assert.equal(await evaluate("document.querySelector('dialog[open] input[name=title]').value"), "Draft across pathnames");
  await escape(); await wait("document.querySelectorAll('dialog[open]').length===2"); await click("Відкинути зміни");
  await ready("archive"); await wait("!document.querySelector('dialog[open]')");
  passed.push("One workspace retains disclosures across all four routes and the same Task card/dialog draft across Back/Forward until discard");

  await go("current");
  const stale = { ...task(), title: "STALE RESPONSE MUST NOT WIN" };
  await evaluate(`(()=>{const original=window.fetch;window.fetch=(input,options)=>{const url=new URL(input,location.href);if(window.__holdLate&&url.hostname==='mock.invalid'&&url.pathname==='/tasks'&&!url.searchParams.has('view')&&!url.searchParams.has('archived')){window.__holdLate=false;window.__lateSignal=options.signal;return new Promise(resolve=>{window.__releaseLate=()=>resolve(new Response(${JSON.stringify(JSON.stringify([stale]))},{status:200,headers:{'Content-Type':'application/json'}}))})}return original(input,options)};window.__holdLate=true})()`);
  await click("Оновити список"); await wait("typeof window.__releaseLate==='function'");
  await go("backlog");
  assert.equal(await evaluate("window.__lateSignal.aborted"), true);
  await evaluate("window.__releaseLate();new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("document.querySelector('main').innerText.includes('STALE RESPONSE MUST NOT WIN')"), false);
  assert.equal(await evaluate(`document.querySelector('${card}')?.innerText.includes('Route Task')`), true);
  passed.push("Switching canonical paths aborts the old request; a mocked response that ignores AbortSignal cannot overwrite the new scope");

  for (const [section, start, boundary, planned] of [
    ["today", "2026-10-28T12:00:00.000Z", "2026-10-28T12:00:00.800Z", true],
    ["backlog", "2026-10-28T23:59:59.200Z", "2026-10-29T00:00:00.000Z", false],
  ]) {
    clock = { now: Date.parse(start), boundary: Date.parse(boundary), plannedAt: planned ? boundary : null };
    const clockScript = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `window.__taskRoutingNow=${clock.now};const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.__taskRoutingNow]))}static now(){return window.__taskRoutingNow}};` });
    await navigate(sections[section]); await ready(section);
    assert.equal(await evaluate(`document.querySelector('${card}')===null`), true);
    const before = calls.filter(call => call.route === "/tasks").length;
    clock.now = clock.boundary + 1;
    await evaluate(`window.__taskRoutingNow=${clock.now}`);
    await wait(`document.querySelector('${card}')!==null`);
    assert(calls.filter(call => call.route === "/tasks").length > before);
    assert.equal(await evaluate("location.pathname"), sections[section]);
    await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: clockScript.identifier });
    clock = null;
  }
  passed.push("Today hidden-inventory plannedAt boundary and Backlog UTC midnight trigger automatic GET refresh on canonical routes");

  await navigate("/tasks?keep=visual"); await ready("current");
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    for (const section of Object.keys(sections)) {
      await go(section);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=${width}`), true);
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(tmpdir(), `task-routing-${width}-${theme}-${section}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  passed.push("All four list routes fit 1440/390 light/dark; screenshots retained in system tmp");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed, apiCalls: calls.length, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passed, errors, state: await evaluate("({path:location.pathname+location.search,heading:document.querySelector('#tasks-heading')?.textContent,focus:document.activeElement?.tagName,dialogs:[...document.querySelectorAll('dialog')].map(e=>({open:e.open,text:e.innerText.slice(0,120)}))})") }, null, 2)); throw error;
} finally { await cdp("Page.close"); socket.close(); }
