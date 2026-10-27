import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const load = createRequire(import.meta.url), ts = load("typescript");
load.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { createAppAccessStore } = load("../src/lib/app-access.ts");
const { createHistoryTraversalGuard } = load("../src/lib/history-traversal-guard.ts");

function fixture(expected, saved = null, unavailable = false) {
  let raw = saved, notify;
  const storage = {
    read() { if (unavailable) throw Error(); return raw; },
    write(value) { if (unavailable) throw Error(); raw = value; },
    remove() { if (unavailable) throw Error(); raw = null; },
    subscribe(check) { notify = check; return () => {}; },
  };
  const store = createAppAccessStore(expected, storage);
  store.subscribe(() => {});
  return { store, external(value) { raw = value; notify(); }, raw: () => raw };
}

test("closed SSR/initial state, missing env, exact saved match and changed env", async () => {
  const password = " test-only ";
  for (const expected of [undefined, ""]) {
    const { store } = fixture(expected, password);
    assert.equal(store.getSnapshot().authorized, false);
    await Promise.resolve();
    assert.equal(store.getSnapshot().configured, false);
    assert.equal(store.login(""), false);
  }
  for (const saved of [null, "incorrect", password.trim(), password]) {
    const { store } = fixture(password, saved);
    assert.equal(store.getServerSnapshot().ready, false);
    assert.equal(store.getSnapshot().authorized, false);
    await Promise.resolve();
    assert.equal(store.getSnapshot().authorized, saved === password);
  }
  const { store } = fixture("changed", password);
  await Promise.resolve(); assert.equal(store.getSnapshot().authorized, false);
});

test("exact input, persistence, refresh, logout and external storage changes", async () => {
  const password = " test-only ", f = fixture(password);
  await Promise.resolve();
  assert.equal(f.store.login(password.trim()), false);
  assert.equal(f.raw(), null);
  assert.equal(f.store.login(password), true);
  assert(f.raw() === password);
  const refreshed = fixture(password, f.raw()); await Promise.resolve();
  assert.equal(refreshed.store.getSnapshot().authorized, true);
  f.external(null); assert.equal(f.store.getSnapshot().authorized, false);
  f.external(password); assert.equal(f.store.getSnapshot().authorized, true);
  f.external("incorrect"); assert.equal(f.store.getSnapshot().authorized, false);
  f.store.login(password); f.store.logout();
  assert.equal(f.raw(), null); assert.equal(f.store.getSnapshot().authorized, false);
});

test("unavailable storage permits current-tab login only", async () => {
  const { store } = fixture("test-only", null, true); await Promise.resolve();
  assert.equal(store.getSnapshot().storageAvailable, false);
  assert.equal(store.login("test-only"), true);
  assert.equal(store.getSnapshot().authorized, true);
  assert.equal(store.getSnapshot().storageAvailable, false);
  store.logout(); assert.equal(store.getSnapshot().authorized, false);
});

test("logout uses existing draft confirmation: stay, discard and pending guard", () => {
  const guard = createHistoryTraversalGuard(); let attempt, logouts = 0;
  guard.register({ shouldBlock: () => true, confirm(value) { attempt = value; return true; } });
  guard.requestLeave(() => logouts++, null); assert.equal(logouts, 0);
  attempt.stay(); attempt.leave(); assert.equal(logouts, 0);
  guard.requestLeave(() => logouts++, null); attempt.leave(); attempt.leave(); assert.equal(logouts, 1);
  guard.register({ shouldBlock: () => false, confirm() { throw Error(); } });
  guard.requestLeave(() => logouts++, null); assert.equal(logouts, 2);
});
