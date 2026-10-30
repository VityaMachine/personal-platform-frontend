import assert from "node:assert/strict";
import { assertThemeColor } from "./theme-browser-checks.mjs";

export async function runTaskMenuChecks({ app, password, cdp, evaluate, wait, click, fill, viewport, screenshot, calls, settle, reset, go, refresh, rejectSkip }) {
  const first = '[data-task-id="22222222-2222-4222-8222-222222222222"]';
  const disclosure = `${first} button[aria-controls^="task-"]`;
  const trigger = `${first} [data-task-menu]`;
  const expanded = () => evaluate(`document.querySelector('${disclosure}').getAttribute('aria-expanded')`);
  const press = async (key, code) => {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, windowsVirtualKeyCode: code });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: code });
  };
  await cdp("Page.bringToFront");
  await cdp("Page.navigate", { url: app + "/settings" });
  await wait("!!document.querySelector('main')");
  await evaluate(`localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});localStorage.setItem('personal-platform.settings',JSON.stringify({version:1,timeZone:'UTC',language:'uk',theme:'light',todayOverdueMode:'limited',todayOverdueDays:3}))`);
  reset();
  await cdp("Page.navigate", { url: app + "/tasks/today" });
  await wait(`!!document.querySelector('${disclosure}')`);
  await settle();
  assert.equal(await expanded(), "true");
  assert.equal(await evaluate("document.querySelector('[data-task-id$=\"000000000008\"] button[aria-controls^=task-]').getAttribute('aria-expanded')"), "false");
  assert.equal(await evaluate(`document.querySelector('${disclosure}').textContent.includes('виконано 1 із 3')`), true);
  await evaluate(`document.querySelector('${disclosure}').click()`);
  await refresh(); assert.equal(await expanded(), "false");
  await fill('input[name=q]', 'масаж'); await wait(`!document.querySelector('${first}')`);
  await click("Скинути"); await wait(`!!document.querySelector('${first}')`);
  assert.equal(await expanded(), "false");
  await go("Поточні задачі"); await settle(); assert.equal(await expanded(), "false");
  await go("Сьогодні"); await settle(); assert.equal(await expanded(), "false");
  await evaluate(`document.querySelector('${disclosure}').click()`);
  await go("Беклог"); await settle(); assert.equal(await expanded(), "true");
  await go("Сьогодні"); await settle();

  // A nested draft stays mounted and visible even if the disclosure or data changes.
  await evaluate(`document.querySelector('${first} ul [data-task-menu]').click()`);
  await evaluate("document.querySelector('[role=menu] [data-task-action=edit]').click()");
  await wait("!!document.querySelector('dialog[open] input[name=title]')");
  await fill('dialog[open] input[name=title]', 'Nested draft survives');
  await evaluate(`window.__draft=document.querySelector('dialog[open]');document.querySelector('${disclosure}').click()`);
  await evaluate(`document.querySelector('${first} > div > input[type=checkbox]').click()`);
  await wait(`document.querySelector('${first} select[aria-label^="Статус задачі"]').value==='DONE'`);
  await settle();
  assert.equal(await evaluate("document.querySelector('dialog[open]')===window.__draft&&document.querySelector('dialog[open] input[name=title]').value==='Nested draft survives'"), true);
  await press("Escape", 27); await click("Відкинути зміни");
  await wait("!document.querySelector('dialog[open]')");
  await wait(`document.activeElement===document.querySelector('${trigger}')`);
  await evaluate(`document.querySelector('${first} > div > input[type=checkbox]').click()`);
  await wait(`document.querySelector('${first} select[aria-label^="Статус задачі"]').value==='TODO'`);
  await evaluate(`document.querySelector('${disclosure}').click()`);
  await evaluate(`document.querySelector('${first} button[aria-label^="Додати підзадачу"]').click()`);
  await wait("!!document.querySelector('dialog[open] input[name=title]')");
  await fill('dialog[open] input[name=title]', 'Added from mock');
  await fill('dialog[open] input[name=estimatedDurationMinutes]', '12');
  await click("Додати"); await wait("!document.querySelector('dialog[open]')");
  await wait(`document.querySelector('${disclosure}').textContent.includes('виконано 1 із 4')`);
  await evaluate(`document.querySelector('${first} ul li:last-child [data-task-menu]').click()`);
  await evaluate("document.querySelector('[role=menu] [data-task-action=delete]').click()");
  await wait("!!document.querySelector('dialog[open]')");
  await click("Видалити"); await wait("!document.querySelector('dialog[open]')");
  await wait(`document.querySelector('${disclosure}').textContent.includes('виконано 1 із 3')`);

  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await viewport(width, 400);
    await evaluate(`(()=>{const key='personal-platform.settings',s=JSON.parse(localStorage.getItem(key));s.theme=${JSON.stringify(theme)};const v=JSON.stringify(s);localStorage.setItem(key,v);window.dispatchEvent(new StorageEvent('storage',{key,newValue:v,storageArea:localStorage}))})()`);
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme === "light" ? "dark" : "light" }] });
    await wait(`getComputedStyle(document.documentElement).colorScheme==='${theme}'`);
    for (const edge of ["first", "last"]) {
      const card = edge === "first" ? first : '[data-task-id="88888888-8888-4888-8888-000000000009"]';
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
      await wait(width === 390 ? "!!document.querySelector('header button[aria-label=\"Відкрити меню\"]')" : "!!document.querySelector('aside')");
      await evaluate(`document.querySelector('${card} [data-task-menu]').scrollIntoView({block:'end'})`);
      await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      const point = await evaluate(`(()=>{const r=document.querySelector('${card} [data-task-menu]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, radiusX: 2, radiusY: 2 }] });
      await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await wait("!!document.querySelector('[role=menu]')");
      await assertThemeColor(evaluate, theme, '[role=menu]', 'backgroundColor', 'today-surface');
      await assertThemeColor(evaluate, theme, '[role=menu]', 'color', 'today-text');
      assert.equal(await evaluate("(()=>{const r=document.querySelector('[role=menu]').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+10,r.y+10).closest('[role=menu]')!==null})()"), true);
      await screenshot(`menu-edge-${width}-${theme}-${edge}`);
      await evaluate("document.querySelector('section[aria-labelledby=tasks-heading]').scrollBy(0,-10);window.scrollBy(0,-10)");
      await evaluate("new Promise(requestAnimationFrame)");
      assert.equal(await evaluate("(()=>{const r=document.querySelector('[role=menu]')?.getBoundingClientRect();return !r||(r.top>=0&&r.bottom<=innerHeight)})()"), true);
      await press("Escape", 27);
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
    }
  }
  await viewport(1440);
  await evaluate(`document.querySelector('${trigger}').scrollIntoView({block:'center'});document.querySelector('${trigger}').click()`);
  const before = calls.length;
  await evaluate("document.querySelectorAll('[data-task-id] > div [data-task-menu]')[1].click()");
  assert.equal(await evaluate("document.querySelectorAll('[role=menu]').length"), 1);
  await viewport(390, 400);
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  assert.equal(await evaluate("(()=>{const r=document.querySelector('[role=menu]')?.getBoundingClientRect();return !r||(r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight)})()"), true);
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: 4, y: 150, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: 4, y: 150, button: "left", clickCount: 1 });
  await wait("!document.querySelector('[role=menu]')");
  await settle(); assert.equal(calls.length, before);
  await viewport(1440);
  const recurring = '[data-task-id="88888888-8888-4888-8888-000000000001"]';
  async function skip() {
    await evaluate(`document.querySelector('${recurring} [data-task-menu]').click()`);
    await evaluate("document.querySelector('[role=menu] [data-task-action=skip]').click()");
    await wait("!!document.querySelector('dialog[open] textarea[name=skipNote]')");
  }
  await skip(); const opened = calls.length;
  await click("Скасувати"); await wait("!document.querySelector('dialog[open]')");
  assert.equal(calls.length, opened);
  await wait(`document.activeElement===document.querySelector('${recurring} [data-task-menu]')`);
  rejectSkip(true); await skip();
  const patches = () => calls.filter(c => c.method === "PATCH").length;
  const beforeSkip = patches();
  await evaluate("document.querySelector('dialog[open] form').requestSubmit();document.querySelector('dialog[open] form').requestSubmit()");
  await wait("!!document.querySelector('dialog[open] [role=alert]')");
  assert.equal(patches(), beforeSkip + 1);
  rejectSkip(false); await click("Пропустити");
  await wait("!document.querySelector('dialog[open]')");
  await wait(`!document.querySelector('${recurring}')`);
  assert.equal(patches(), beforeSkip + 2);
  await cdp("Page.navigate", { url: app + "/tasks" });
  await wait(`!!document.querySelector('${disclosure}')`);
  assert.equal(await expanded(), "false");
  console.log("Task menu: touch/viewport edges, stacking, one owner, outside close, opposite OS themes; disclosure defaults/manual persistence; CANCELED/deleted counts; nested draft, create/delete child passed.");
}
