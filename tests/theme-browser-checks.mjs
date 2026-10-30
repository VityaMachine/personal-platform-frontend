import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Expectations come from the declared palette, never from the resolved tokens:
// a wrong OS-selected token must fail even when color-scheme itself is correct.
const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const palette = Object.fromEntries([...css.matchAll(/--(light|dark)-([\w-]+):\s*(#[\da-f]+);/g)].map(([, mode, name, hex]) => {
  const value = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join("") : hex.slice(1);
  return [mode + "-" + name, `rgb(${[0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16)).join(", ")})`];
}));

export async function assertThemeColor(evaluate, mode, selector, property, token) {
  const actual = await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)}))[${JSON.stringify(property)}]`);
  assert.equal(actual, palette[mode + "-" + token], `${mode}: ${selector} ${property}`);
  return actual;
}

export async function runThemeMatrix({ app, password, cdp: send, evaluate, wait, click, fill, viewport, screenshot, calls, settle }) {
  async function cdp(method, params) {
    if (method === "Page.navigate" || method === "Page.reload") await settle();
    return send(method, params);
  }
  const measured = [];
  let mode = "light";
  async function color(selector, property, token) {
    await wait(`document.querySelector(${JSON.stringify(selector)})!==null`);
    const expected = palette[mode + "-" + token];
    assert(expected, "Declared palette token: " + token);
    await wait(`getComputedStyle(document.querySelector(${JSON.stringify(selector)}))[${JSON.stringify(property)}]===${JSON.stringify(expected)}`);
    const actual = await assertThemeColor(evaluate, mode, selector, property, token);
    measured.push({ mode, selector, property, actual });
  }
  async function scheme() { await wait(`getComputedStyle(document.documentElement).colorScheme===${JSON.stringify(mode)}`); }
  async function media(os) { await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: os }] }); }
  async function route(url) {
    await cdp("Page.navigate", { url: app + url + "?keep=theme" });
    await wait(url === "/settings" ? "document.querySelector('#settings-theme')!==null" :
      url === "/tasks/routines" ? "document.querySelector('#routines-heading')!==null&&!document.querySelector('main section[aria-busy=true]')" :
        "document.querySelector('#tasks-heading')!==null&&document.querySelector('section[aria-labelledby=tasks-heading]')?.getAttribute('aria-busy')==='false'");
  }
  async function menu() {
    if (await evaluate("matchMedia('(max-width:760px)').matches&&!document.querySelector('#mobile-navigation')")) await click("Відкрити меню");
    await wait("document.querySelector('nav')!==null");
  }
  async function closeMenu() {
    if (await evaluate("!!document.querySelector('#mobile-navigation')")) await click("Закрити меню");
  }
  async function shell() {
    await scheme();
    await color("main", "color", "text");
    await wait(`getComputedStyle(document.querySelector('main').parentElement).backgroundColor===${JSON.stringify(palette[mode + "-shell-page"])}`);
    await menu();
    await color("nav a[href^='/settings']", "color", await evaluate("location.pathname==='/settings'") ? "shell-accent" : "shell-text");
    if (await evaluate("matchMedia('(max-width:760px)').matches")) {
      await color("header:has(button[aria-label='Відкрити меню'])", "backgroundColor", "shell-surface");
      await color("#mobile-navigation", "backgroundColor", "shell-surface");
      await color("#mobile-navigation", "color", "shell-text");
    } else {
      await color("aside", "backgroundColor", "shell-surface");
      await color("aside a", "color", "shell-text");
    }
    await closeMenu();
  }
  async function settingsColors() {
    await shell();
    await color("h1", "color", "text");
    await color("main > div", "backgroundColor", "surface");
    await color("#settings-theme", "backgroundColor", "input");
    await color("#settings-theme", "color", "text");
  }
  async function save(theme) {
    await fill("#settings-theme", theme); await click("Зберегти");
    await wait(`JSON.parse(localStorage.getItem('personal-platform.settings')).theme===${JSON.stringify(theme)}`);
    await scheme();
  }
  async function key(key) {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: 27 });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: 27 });
  }
  await cdp("Page.bringToFront");
  await cdp("Page.navigate", { url: app + "/settings" });
  await wait("document.querySelector('main')!==null");
  await evaluate(`localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)});localStorage.setItem('personal-platform.settings',JSON.stringify({version:1,timeZone:'Europe/Kyiv',language:'uk',theme:'system',todayOverdueMode:'limited',todayOverdueDays:3}))`);
  await route("/settings");
  const cases = [["dark", "light"], ["light", "dark"], ["light", "system"], ["dark", "system"]];
  for (const width of [1440, 390]) {
    await viewport(width);
    for (const [os, choice] of cases) {
      mode = choice === "system" ? os : choice;
      await media(os); await route("/settings"); await save(choice); await settingsColors();
      await cdp("Page.reload"); await wait("document.querySelector('#settings-theme')!==null"); await settingsColors();
      assert.equal(await evaluate("document.querySelector('#settings-theme').value"), choice);
      // A live OS change must affect system and leave explicit choices intact.
      const opposite = os === "dark" ? "light" : "dark";
      await media(opposite); mode = choice === "system" ? opposite : choice; await settingsColors();
      await media(os); mode = choice === "system" ? os : choice; await settingsColors();
      for (const url of ["/tasks/today", "/tasks", "/tasks/routines"]) {
        await route(url); await scheme();
        const today = url.endsWith("today");
        await color("h1", "color", today ? "today-text" : "text");
        await color(url.endsWith("routines") ? "main ul > li" : "[data-task-id]", "backgroundColor", today ? "today-surface" : "surface");
        if (today) {
          await color("[aria-label='Підсумок статусів']", "backgroundColor", "today-surface");
          await color("[aria-label='Підсумок статусів'] [role=img]", "backgroundColor", "summary-todo");
          await color("[aria-label='Підсумок статусів'] [role=img]", "color", "summary-label");
          await color("[data-task-id] select", "backgroundColor", "today-input");
          await color("[data-task-id] select", "color", "today-status-todo");
          await screenshot(`theme-${width}-os-${os}-${choice}-today`);
          await click("+ Нова задача"); await wait("document.querySelector('dialog[open] input[name=title]')!==null");
          await color("dialog[open]", "backgroundColor", "today-surface");
          await color("dialog[open]", "color", "today-text");
          await color("dialog[open] input[name=title]", "backgroundColor", "today-input");
          await fill("dialog[open] input[name=title]", "Theme draft");
          await key("Escape"); await wait("document.querySelectorAll('dialog[open]').length===2");
          await color("dialog[role=alertdialog][open]", "backgroundColor", "surface-muted");
          await color("dialog[role=alertdialog][open]", "color", "today-text");
          await click("Відкинути зміни"); await wait("!document.querySelector('dialog[open]')");
        }
        await menu(); await wait("[...document.querySelectorAll('nav button')].find(e=>e.textContent.trim()==='Сфери')?.getAttribute('aria-disabled')==='false'");
        await click("Сфери"); await wait("document.querySelector('dialog[open] input')!==null");
        assert.equal(await evaluate("!!document.querySelector('#mobile-navigation')"), false);
        await color("dialog[open]", "backgroundColor", "surface");
        await color("dialog[open]", "color", "text");
        await color("dialog[open] input", "backgroundColor", "input");
        await click("Закрити керування сферами"); await wait("!document.querySelector('dialog[open]')");
      }
      await route("/settings"); await settingsColors(); await screenshot(`theme-${width}-os-${os}-${choice}-settings`);
      const beforeGate = calls.length;
      await evaluate("localStorage.removeItem('personal-platform.access-password')"); await cdp("Page.reload");
      await wait("document.querySelector('#access-password')!==null"); await scheme();
      await color("html", "backgroundColor", "page"); await color("main section", "backgroundColor", "surface");
      await color("#access-heading", "color", "text"); await color("#access-password", "backgroundColor", "input");
      assert.equal(calls.length, beforeGate, "No API requests before login");
      await evaluate(`localStorage.setItem('personal-platform.access-password',${JSON.stringify(password)})`);
      await route("/settings");
    }
    // Preserve existing draft semantics: changing option alone does not save/apply.
    await media("dark"); mode = "light"; await save("light"); await settingsColors();
    await fill("#settings-theme", "dark"); await settingsColors();
    await menu(); await click("Сфери"); await wait("document.querySelector('dialog[role=alertdialog][open]')!==null");
    await color("dialog[role=alertdialog][open]", "backgroundColor", "surface-muted");
    await click("Залишитися"); await wait("!document.querySelector('dialog[open]')");
    assert.equal(await evaluate("document.querySelector('#settings-theme').value"), "dark");
    await evaluate("(()=>{const b=document.querySelector('button[aria-controls=tasks-navigation]');if(b.getAttribute('aria-expanded')==='false')b.click()})()");
    await evaluate("[...document.querySelectorAll('nav a')].find(e=>e.textContent.trim()==='Поточні задачі').click()");
    await wait("document.querySelector('dialog[role=alertdialog][open]')!==null");
    await click("Вийти без збереження"); await wait("document.querySelector('#tasks-heading')!==null");
    await color("h1", "color", "text");
    await route("/settings"); assert.equal(await evaluate("document.querySelector('#settings-theme').value"), "light");
    for (const theme of ["dark", "light"]) {
      mode = theme; await save(theme); await settingsColors();
      await cdp("Page.reload"); await wait("document.querySelector('#settings-theme')!==null"); await settingsColors();
    }
  }
  await writeFile(path.join(tmpdir(), "pp-theme-colors.json"), JSON.stringify(measured, null, 2));
  console.log(JSON.stringify({ themeMatrix: "passed", cases: 8, measuredColors: measured.length,
    covered: "OS opposites, system live changes, light-dark-light, saved F5/routes, unsaved draft stay/discard, Settings/Today/Tasks/Routines/Areas/dialogs/gate, desktop/mobile" }));
}
