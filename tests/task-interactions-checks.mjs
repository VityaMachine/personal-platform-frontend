import assert from "node:assert/strict";

export async function runTaskInteractions({ app, password, cdp, evaluate, wait, click, fill, viewport, screenshot, calls, settle, reset, removal, setCalendar }) {
  const passed = [], first = '[data-task-id="22222222-2222-4222-8222-222222222222"]';
  const recurring = '[data-task-id="88888888-8888-4888-8888-000000000001"]';
  const deletes = () => calls.filter(c => c.method === "DELETE").length;
  const listGets = () => calls.filter(c => c.method === "GET" && c.route === "/tasks").length;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function key(name, shift = false) {
    const code = name === "Tab" ? 9 : name === "Enter" ? 13 : 27;
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0, ...(name === "Enter" ? { text: "\r" } : {}) });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: code });
  }
  async function ready() { await wait("document.querySelector('section[aria-labelledby=tasks-heading]')?.getAttribute('aria-busy')==='false'"); await settle(); }
  async function route(url) { await settle(); await cdp("Page.navigate", { url: app + url + "?keep=interactions" }); await ready(); }
  async function action(card, name) {
    await wait(`document.querySelector('${card} [data-task-action="${name}"]')!==null`);
    await evaluate(`document.querySelector('${card} [data-task-action="${name}"]').click()`);
  }
  async function deletion(card = first) { await action(card, "delete"); await wait("document.querySelector('dialog[open] h2')?.textContent==='Видалити задачу?'"); }
  async function gone() {
    await wait("!document.querySelector('dialog[open]')");
    await wait(`!document.querySelector('${first}')`);
    await wait("document.activeElement===document.querySelector('section[aria-labelledby=tasks-heading]')");
  }
  async function fixture(url = "/tasks") {
    await settle(); reset(url.endsWith("archive")); Object.assign(removal, { mode: "success", hold: false, release: null, checkFail: false }); setCalendar(null);
    await route(url);
  }
  await cdp("Page.bringToFront");
  await cdp("Page.navigate", { url: app + "/settings" });
  await wait("document.querySelector('main')!==null");
  await evaluate(`localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});localStorage.setItem('personal-platform.settings',JSON.stringify({version:1,timeZone:'UTC',language:'uk',theme:'system',todayOverdueMode:'limited',todayOverdueDays:3}))`);
  let clockScript;
  async function clock(start) {
    if (clockScript) await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: clockScript });
    clockScript = (await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__taskNow=${start};const NativeDate=Date;
      window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.__taskNow]))}static now(){return window.__taskNow}};
    ` })).identifier;
  }
  await clock(Date.parse("2026-10-30T09:00:00Z"));
  const paths = ["/tasks/today", "/tasks", "/tasks/backlog", "/tasks/archive"];
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) for (const url of paths) {
    await viewport(width); await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    await fixture(url);
    const card = recurring, archived = url.endsWith("archive");
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('${card} [data-task-action]')].map(e=>e.dataset.taskAction)`),
      archived ? ["details", "restore", "edit", "delete"] : ["skip", "details", "archive", "edit", "delete"]);
    const layout = await evaluate(`[...document.querySelectorAll('${card} [data-task-action]')].map(e=>({name:e.getAttribute('aria-label'),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,icon:getComputedStyle(e.querySelector('svg')).display,label:getComputedStyle(e.querySelector('span')).display}))`);
    assert(layout.every(e => e.name?.includes("Похід на масаж")));
    assert(layout.every(e => width === 390 ? e.w === 44 && e.h === 44 && e.icon !== "none" && e.label === "none" : e.icon === "none" && e.label !== "none"));
    assert.equal(await evaluate(`(()=>{const e=document.querySelector('${card} [data-task-action=delete]'),p=document.createElement('span');p.style.color='var(--danger)';e.append(p);const ok=getComputedStyle(e).color===getComputedStyle(p).color;p.remove();return ok})()`), true);
    await key("Tab");
    for (const name of archived ? ["details", "restore", "edit", "delete"] : ["skip", "details", "archive", "edit", "delete"]) {
      await evaluate(`document.querySelector('${card} [data-task-action=${name}]').focus()`);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('${card} [data-task-action=${name}] [role=tooltip]')).visibility`), "visible");
    }
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    const point = await evaluate(`(()=>{const e=document.querySelector('${card} [data-task-action=delete]');e.blur();e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('${card} [data-task-action=delete] [role=tooltip]')).visibility`), "visible");
    const before = calls.length, beforeDelete = deletes();
    await evaluate(`document.querySelector('${card} [data-task-action=delete]').focus()`); await key("Enter");
    await wait("document.querySelector('dialog[open] h2')?.textContent==='Видалити задачу?'");
    assert.equal(await evaluate("document.activeElement.textContent"), "Скасувати");
    assert.equal(await evaluate("document.querySelector('dialog[open]').innerText.includes('Похід на масаж')"), true);
    await key("Tab", true); assert.equal(await evaluate("document.activeElement.textContent"), "Видалити");
    await key("Tab"); assert.equal(await evaluate("document.activeElement.textContent"), "Скасувати");
    await key("Escape"); await wait("!document.querySelector('dialog[open]')");
    await wait(`document.activeElement===document.querySelector('${card} [data-task-action=delete]')`);
    await deletion(card); await click("Скасувати"); await wait("!document.querySelector('dialog[open]')");
    await settle(); assert.equal(calls.length, before); assert.equal(deletes(), beforeDelete);
    await action(card, "details"); await wait("document.querySelector('dialog[open] button[aria-label=\"Закрити деталі задачі\"]')!==null");
    await key("Escape"); await wait("!document.querySelector('dialog[open]')");
    await action(card, "edit"); await wait("document.querySelector('dialog[open] input[name=title]')!==null"); await key("Escape"); await wait("!document.querySelector('dialog[open]')");
    if (!archived) { await action(card, "skip"); await wait("document.querySelector('dialog[open] textarea[name=skipNote]')!==null"); await key("Escape"); await wait("!document.querySelector('dialog[open]')"); }
    await screenshot(`task-actions-${width}-${theme}-${url.split("/").at(-1)}`);
    await action(card, archived ? "restore" : "archive");
    await wait(`!document.querySelector('${card}')`);
  }
  passed.push("16 route/size/theme combinations: one text/icon button per action, 44px mobile targets, keyboard tooltips/trap, danger color, details/edit/skip/archive/restore; delete open/cancel/Escape send no requests");

  for (const url of paths) {
    await fixture(url);
    await evaluate("history.pushState(history.state,'',location.pathname+location.search+'&confirm=1')");
    const before = deletes(); removal.hold = true;
    await deletion();
    await evaluate("document.querySelector('dialog[open] form').requestSubmit();document.querySelector('dialog[open] form').requestSubmit()");
    await wait("document.querySelector('dialog[open] form').getAttribute('aria-busy')==='true'");
    for (let i = 0; i < 100 && !removal.release; i++) await delay(10);
    assert(removal.release);
    await key("Escape");
    await click("Скасувати");
    assert.equal(await evaluate("!!document.querySelector('dialog[open]')"), true);
    await evaluate("history.back()"); await delay(120);
    assert.equal(await evaluate("location.pathname"), url);
    assert.equal(await evaluate("location.search.includes('confirm=1')&&!!document.querySelector('dialog[open]')"), true);
    assert.equal(deletes(), before + 1);
    removal.hold = false; removal.release(); await gone(); assert.equal(deletes(), before + 1);
  }
  passed.push("All four sections: double confirmation sends 1 DELETE; pending blocks Escape/cancel/history; success removes card and focuses list");

  await fixture(); removal.mode = "error"; let before = deletes();
  await deletion(); await click("Видалити"); await wait("document.querySelector('dialog[open] [role=alert]')!==null");
  assert.equal(deletes(), before + 1);
  assert.equal(await evaluate("document.querySelector('dialog[open] button[type=submit]').disabled"), false);
  await click("Скасувати"); await wait("!document.querySelector('dialog[open]')");
  assert.equal(await evaluate(`!!document.querySelector('${first}')`), true);
  for (const mode of ["unknown-present", "unknown-missing", "server-error"]) {
    await fixture(); removal.mode = mode; before = deletes();
    await deletion(); await click("Видалити"); await wait("document.querySelector('dialog[open] button[type=submit]')?.disabled===true");
    await evaluate("document.querySelector('dialog[open] form').requestSubmit()");
    assert.equal(deletes(), before + 1);
    await click("Скасувати"); await wait("!document.querySelector('dialog[open]')");
    const requests = calls.length; await deletion(); assert.equal(calls.length, requests);
    assert.equal(await evaluate("document.querySelector('dialog[open] button[type=submit]').disabled"), true);
    if (mode === "unknown-present") {
      removal.checkFail = true; await click("Перевірити стан задачі");
      await wait("document.querySelector('dialog[open] [role=alert]').textContent.includes('Не вдалося перевірити')");
      assert.equal(deletes(), before + 1); removal.checkFail = false;
    }
    await click("Перевірити стан задачі");
    if (mode === "unknown-missing") await gone();
    else {
      await wait("document.querySelector('dialog[open] [role=status]')?.textContent.includes('нове явне підтвердження')");
      assert.equal(deletes(), before + 1);
      removal.mode = "success"; await click("Видалити"); await gone(); assert.equal(deletes(), before + 2);
    }
  }
  passed.push("409 stays open; lost response/5xx are uncertain, persist through close/reopen, block repeat until GET; failed check retries GET only; present/missing reconciled without automatic DELETE");

  await fixture("/tasks/today");
  let gets = listGets();
  const background = await cdp("Target.createTarget", { url: "about:blank", background: false });
  await delay(120);
  const backgroundVisibility = await evaluate("document.visibilityState");
  await cdp("Page.bringToFront");
  await cdp("Target.closeTarget", { targetId: background.targetId });
  await settle(); assert.equal(listGets(), gets);
  passed.push("Real CDP tab activation/return: 0 extra GET (background visibility: " + backgroundVisibility + ")");
  await evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__hidden?'hidden':'visible'});window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'))");
  await settle(); assert.equal(listGets(), gets);
  await click("Оновити список"); await ready(); assert.equal(listGets(), gets + 2);
  passed.push("Ordinary hidden/visible/focus return sends 0 list GET; manual Today refresh sends one selected + one inventory GET");

  for (const [url, start, kind] of [
    ["/tasks/today", "2026-10-30T09:00:00.000Z", "planned"],
    ["/tasks/today", "2026-10-30T23:59:59.800Z", "midnight"],
    ["/tasks/backlog", "2026-10-30T09:00:00.000Z", "planned"],
  ]) {
    const initial = Date.parse(start), calendar = { now: initial, boundary: initial + (kind === "midnight" ? 200 : 700), plannedAt: kind === "planned" ? new Date(initial + 700).toISOString() : null };
    await settle(); reset(); setCalendar(calendar); await clock(initial); await route(url);
    assert.equal(await evaluate("document.querySelectorAll('[data-task-id]').length"), 0);
    await click("+ Нова задача"); await fill("dialog[open] input[name=title]", "Keep calendar draft");
    await evaluate("window.__draft=document.querySelector('dialog[open]');Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__hidden?'hidden':'visible'});window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))");
    gets = listGets();
    calendar.now = calendar.boundary + 1;
    await evaluate(`window.__taskNow=${calendar.now};window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))`);
    await ready(); await delay(800);
    assert.equal(listGets(), gets + 2, "One coordinated load with selected list + inventory");
    assert.equal(await evaluate("document.querySelector('dialog[open]')===window.__draft&&document.querySelector('dialog[open] input[name=title]').value==='Keep calendar draft'"), true);
    assert.equal(await evaluate("document.querySelectorAll('[data-task-id]').length>0"), true);
    await key("Escape"); await click("Відкинути зміни"); await wait("!document.querySelector('dialog[open]')");
  }
  passed.push("Today plannedAt/midnight and Backlog plannedAt return after hidden boundary: exactly one load, concurrent events/timers deduplicated, open draft retained");
  setCalendar(null); await clock(Date.parse("2026-10-30T09:00:00Z")); await fixture("/tasks/today");
  gets = listGets();
  await evaluate("(()=>{const k='personal-platform.settings',s=JSON.parse(localStorage.getItem(k));s.timeZone='Europe/Kyiv';const v=JSON.stringify(s);localStorage.setItem(k,v);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:v,storageArea:localStorage}))})()");
  await ready(); await wait("document.querySelector('time[datetime]')!==null"); await settle(); assert.equal(listGets(), gets + 2);
  gets = listGets();
  await evaluate("(()=>{const k='personal-platform.settings',s=JSON.parse(localStorage.getItem(k));s.todayOverdueDays=7;const v=JSON.stringify(s);localStorage.setItem(k,v);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:v,storageArea:localStorage}))})()");
  await ready(); await settle(); assert.equal(listGets(), gets + 2);
  gets = listGets();
  await evaluate("(()=>{const k='personal-platform.settings',s=JSON.parse(localStorage.getItem(k));s.theme='light';const v=JSON.stringify(s);localStorage.setItem(k,v);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:v,storageArea:localStorage}))})()");
  await settle(); assert.equal(listGets(), gets);
  passed.push("Timezone and overdue selection settings still reload; theme-only change does not GET Tasks");
  console.log(JSON.stringify({ taskInteractions: passed, deletes: deletes(), listGets: listGets() }, null, 2));
}
