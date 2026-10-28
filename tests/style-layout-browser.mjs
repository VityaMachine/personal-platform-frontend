// Test build only: mock.invalid API, APP_ACCESS_TEST_PASSWORD, dedicated CDP profile.
import assert from "node:assert/strict";
import { routine as routineFixture, futureTask, versions, generationPreview } from "./routine-fixtures.mjs";
import { writeFile, readFile, mkdir } from "node:fs/promises";
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
const area = structuredClone(originalArea);
let taskAreaId = originalArea.id, routineAreaId = originalArea.id;


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
  else if (route === "/tasks" && method === "GET") data = Array.from({ length: 24 }, (_, i) => i === 0 ? task() : { ...task(), id: "88888888-8888-4888-8888-" + String(i).padStart(12, "0"), subtasks: [], title: "Mock Task " + i });
  else if (route === "/routines" && method === "GET") data = [routine()];
  else if (route.endsWith("/preview") && method === "GET") data = { ...generationPreview, from: url.searchParams.get("from"), to: url.searchParams.get("to"), truncated: false, limitations: [] };
  else if (route === "/routines/" + routineFixture.id + "/schedule-versions" && method === "GET") data = versions;
  else if (route === "/tasks/" + futureTask.id && method === "GET") data = task();
  else if (route === "/routines/" + routineFixture.id && method === "GET") data = routine();
  else throw Error("Unexpected mock API request: " + method + " " + route);
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
  await wait(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});return !!e&&!e.disabled})()`);
  await evaluate(`(()=>{const root=[...document.querySelectorAll('dialog[open]')].at(-1)||document;const e=[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e||e.disabled)throw Error('Unavailable button');e.click();})()`);
}
async function escape() {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
}

// Capture baseline, then run CSS_COMPARE=1 against the modified test build.
const directory = process.env.CSS_SNAPSHOT_DIR;
assert(directory, "CSS_SNAPSHOT_DIR is required");
await mkdir(directory, { recursive: true });
const compare = process.env.CSS_COMPARE === "1";
const results = [];
const rasterDifferences = [];
async function capture(name) {
  await delay(180);
  await evaluate("document.fonts.ready");
  const layout = await evaluate(`(()=>{const elements=[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE','LINK','NEXT-ROUTE-ANNOUNCER'].includes(e.tagName)&&!e.closest('next-route-announcer'));return elements.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,box:[r.x,r.y,r.width,r.height],css:Object.fromEntries([...s].filter(k=>!k.startsWith('--')).map(k=>[k,s.getPropertyValue(k)]))}})})()`);
  const serialized = JSON.stringify(layout);
  const file = path.join(directory, name);
  if (compare) {
    const expected = JSON.parse(await readFile(file+'.json','utf8'));
    if (serialized !== JSON.stringify(expected)) {
      await writeFile(file+'.after.json',serialized);
      const index = layout.findIndex((item,i)=>JSON.stringify(item)!==JSON.stringify(expected[i]));
      const before=expected[index], after=layout[index];
      throw Error('Computed styles changed: '+name+' element '+index+' '+JSON.stringify({beforeBox:before?.box,afterBox:after?.box,properties:Object.keys(after?.css??{}).filter(k=>before?.css[k]!==after.css[k]).map(k=>[k,before?.css[k],after.css[k]])}));
    }
  }
  else await writeFile(file+'.json', serialized);
  const shot = await cdp('Page.captureScreenshot', {format:'png'});
  const bytes = Buffer.from(shot.data,'base64');
  if (compare) {
    const expected = await readFile(file+'.png');
    if (!bytes.equals(expected)) {
      await writeFile(file+'.after.png',bytes);
      const diff = await evaluate(`(async()=>{
        const load=source=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.src=source});
        const [before,after]=await Promise.all([load('data:image/png;base64,${expected.toString('base64')}'),load('data:image/png;base64,${shot.data}')]);
        if(before.width!==after.width||before.height!==after.height) return {differentSize:true};
        const canvas=document.createElement('canvas');canvas.width=before.width;canvas.height=before.height;
        const context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(before,0,0);const a=context.getImageData(0,0,canvas.width,canvas.height).data;
        context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(after,0,0);const b=context.getImageData(0,0,canvas.width,canvas.height).data;
        let pixels=0,maxDelta=0,minX=canvas.width,minY=canvas.height,maxX=0,maxY=0;
        for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);changed ||= delta>0;maxDelta=Math.max(maxDelta,delta)}if(changed){pixels++;const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}}
        const active=document.activeElement,rect=active.getBoundingClientRect(),dpr=devicePixelRatio;
        const caret=['INPUT','TEXTAREA'].includes(active.tagName)&&maxX-minX<2*dpr&&maxY-minY<parseFloat(getComputedStyle(active).lineHeight)*dpr&&minX>rect.left*dpr&&maxX<rect.right*dpr&&minY>rect.top*dpr&&maxY<rect.bottom*dpr;
        return {pixels,maxDelta,total:canvas.width*canvas.height,caret};
      })()`);
      rasterDifferences.push({name,...diff});
      // Ignore only a blinking text caret or tiny 1–3 channel raster rounding.
      // Geometry and every computed property must still match exactly above.
    }
  }
  else await writeFile(file+'.png',bytes);
  results.push(name);
  if (results.length % 14 === 0) console.log(`${compare ? 'Compared' : 'Captured'} ${results.length} states`);
}
async function navigate(route) {
  await cdp('Page.navigate',{url:app+route});
  await wait("document.readyState==='complete' && !!document.querySelector('nav') && !document.querySelector('[aria-busy=true]')");
  await delay(100);
}
try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source: `localStorage.clear();localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});`});
  for (const [width,height,scale] of (process.env.CSS_EXTRA_ONLY ? [] : [[1440,900,1],[390,900,1],[1440,600,1],[720,450,2]])) for (const theme of ['light','dark']) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile:false});
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
    const prefix=width+'x'+height+'-'+theme;
    for (const route of ['/tasks','/tasks/today','/tasks/backlog','/tasks/archive','/routines','/settings']) {
      await navigate(route); await capture(prefix+route.replaceAll('/','-'));
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Horizontal overflow '+route);
    }
    await navigate('/tasks');
    const list='section[aria-labelledby=tasks-heading]';
    assert.equal(await evaluate(`(()=>{const e=document.querySelector('${list}');e.scrollTop=200;return e.scrollTop>0})()`), width===1440&&height===900);
    if (width!==1440||height!==900) assert.equal(await evaluate('document.documentElement.scrollHeight>innerHeight'),true);
    await evaluate(`document.querySelector('${list}').scrollTop=0`);
    await evaluate("document.querySelector('[data-task-id] button[aria-expanded]').click()");
    await capture(prefix+'-subtasks');
    await click('+ Нова задача'); await wait("document.querySelector('dialog[open] input[name=title]')!==null");
    await capture(prefix+'-task-form');
    await fill('dialog[open] input[name=title]','Draft'); await escape();
    await wait("document.querySelectorAll('dialog[open]').length===2"); await capture(prefix+'-discard');
    await click('Відкинути зміни'); await wait("!document.querySelector('dialog[open]')");
    await click('Сфери'); await wait("document.querySelector('dialog[open] input')!==null"); await capture(prefix+'-areas');
    for (let i=0;i<8;i++) {
      await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      assert.equal(await evaluate("document.querySelector('dialog[open]').contains(document.activeElement)"),true);
    }
    await capture(prefix+'-areas-focus'); await escape(); await wait("!document.querySelector('dialog[open]')");
    await navigate('/routines'); await click('Нове повторення'); await wait("document.querySelector('dialog[open]')!==null"); await capture(prefix+'-routine-form');
    await navigate('/tasks'); await click('Вийти'); await wait("!!document.querySelector('#access-password')");
    await capture(prefix+'-access');
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await capture(prefix+'-access-focus');
  }
  if (!process.env.CSS_MAIN_ONLY) {
    await cdp('Page.bringToFront');
    await cdp('Emulation.setFocusEmulationEnabled', {enabled:true});
  }
  for (const [width,height,theme] of (process.env.CSS_MAIN_ONLY ? [] : [[1440,900,'light'],[390,900,'dark'],[720,450,'dark']])) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:width===720?2:1,mobile:false});
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
    const prefix='extra-'+width+'x'+height+'-'+theme;
    await navigate('/tasks');
    if(width<761) await evaluate("document.querySelector('button[aria-controls]').click()");
    await capture(prefix+'-filters');
    await click('+ Нова задача'); await wait("!!document.querySelector('#add-subtask')");
    await evaluate("document.querySelector('#add-subtask').click()");
    await wait("document.activeElement.id.startsWith('subtask-')");
    await capture(prefix+'-subtask-editor');
    await escape();await wait("document.querySelectorAll('dialog[open]').length===2");await click('Відкинути зміни');await wait("!document.querySelector('dialog[open]')");
    for(const label of ['Редагувати задачу: Mock Task','Додати підзадачу до задачі «Mock Task»']) {
      await evaluate(`document.querySelector('button[aria-label="${label}"]').click()`);
      await wait("!!document.querySelector('dialog[open] input')");await capture(prefix+(label.startsWith('Редагувати')?'-edit-task':'-create-subtask'));await escape();await wait("!document.querySelector('dialog[open]')");
    }
    await evaluate("document.querySelector('[data-task-id] button[aria-expanded]').click()");
    for(const label of ['Редагувати підзадачу: Mock Child','Видалити підзадачу: Mock Child']) {
      await evaluate(`document.querySelector('button[aria-label="${label}"]').click()`);await wait("!!document.querySelector('dialog[open]')");await capture(prefix+(label.startsWith('Редагувати')?'-edit-subtask':'-delete-subtask'));await escape();await wait("!document.querySelector('dialog[open]')");
    }
    await fill('select[aria-label="Статус задачі: Mock Task"]','CANCELED');await wait("!!document.querySelector('dialog[open]')");await capture(prefix+'-status-dialog');await escape();await wait("!document.querySelector('dialog[open]')");
    await navigate('/routines');await click('Деталі');await wait("!!document.querySelector('dialog[open]') && !document.querySelector('[aria-busy=true]')");await capture(prefix+'-routine-details');
  }
  assert.deepEqual(errors,[]);
  const pixelFailures = rasterDifferences.filter(diff => diff.differentSize || (!diff.caret && (diff.maxDelta > 3 || diff.pixels / diff.total > 0.001)));
  assert.deepEqual(pixelFailures, [], 'Screenshot differences exceed caret/raster-rounding tolerance');
  const report = {compared:compare,snapshots:results.length,rasterDifferences,results};
  await writeFile(path.join(directory, `${compare ? 'comparison' : 'baseline'}-${process.env.CSS_EXTRA_ONLY ? 'extra' : process.env.CSS_MAIN_ONLY ? 'main' : 'all'}.json`), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch (error) {
  console.error(JSON.stringify({captured:results,errors,state:await evaluate("({path:location.pathname,buttons:[...document.querySelectorAll('button')].map(e=>e.textContent.trim()),dialogs:document.querySelectorAll('dialog[open]').length})")},null,2));
  throw error;
} finally {await cdp('Page.close');socket.close();}
