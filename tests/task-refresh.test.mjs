import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const load = createRequire(import.meta.url), ts = load("typescript");
load.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { watchTaskRefresh } = load("../src/modules/tasks/model/task-refresh-scheduler.ts");
const { nextTaskRefresh, MAX_REFRESH_DELAY } = load("../src/modules/tasks/model/task-refresh.ts");
const { taskRemovalError } = load("../src/modules/tasks/model/task-removal.ts");
const { ApiError } = load("../src/shared/api/api.ts");

function environment(boundary, initial = 0) {
  const clock = new EventTarget(), visibility = new EventTarget(), timers = new Map();
  let now = initial, sequence = 0, refreshes = 0;
  visibility.visibilityState = "visible";
  clock.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, due: now + delay, delay }); return id; };
  clock.clearTimeout = id => timers.delete(id);
  const dispose = watchTaskRefresh(boundary, () => refreshes++, clock, visibility, () => now);
  return { clock, visibility, timers, dispose, count: () => refreshes, now: value => { now = value; },
    focus: () => clock.dispatchEvent(new Event("focus")),
    visible(value) { visibility.visibilityState = value; visibility.dispatchEvent(new Event("visibilitychange")); },
  };
}
test("ordinary focus/visibility returns do not refresh or accumulate timers", () => {
  const e = environment(1000);
  for (let i = 0; i < 5; i++) { e.focus(); e.visible("hidden"); assert.equal(e.timers.size, 0); e.visible("visible"); e.focus(); }
  assert.equal(e.count(), 0); assert.equal(e.timers.size, 1);
  e.dispose(); assert.equal(e.timers.size, 0);
});
test("elapsed hidden boundary coalesces visibility, focus and already queued timer into one refresh", () => {
  const e = environment(1000), queued = [...e.timers.values()][0].callback;
  e.visible("hidden"); e.now(2000);
  e.focus(); assert.equal(e.count(), 0);
  e.visible("visible"); e.focus(); queued(); e.focus(); e.visible("visible");
  assert.equal(e.count(), 1); assert.equal(e.timers.size, 0); e.dispose();
});
test("visible timer, overdue in-flight boundary, disposal and long waits", () => {
  const e = environment(1000), timer = [...e.timers.values()][0].callback;
  e.now(1000); timer(); e.focus(); assert.equal(e.count(), 1); e.dispose();
  const overdue = environment(1000, 1001); assert.equal(overdue.count(), 1); overdue.dispose();
  const long = environment(MAX_REFRESH_DELAY + 1000);
  assert.equal([...long.timers.values()][0].delay, MAX_REFRESH_DELAY);
  const queued = [...long.timers.values()][0].callback; long.dispose(); long.now(MAX_REFRESH_DELAY + 2000); queued();
  assert.equal(long.count(), 0);
});
test("calendar boundary uses hidden inventory and DST-safe midnight in each known timezone", () => {
  const now = Date.parse("2026-10-24T21:00:00.000Z");
  assert.equal(nextTaskRefresh([], "Europe/Kyiv", now), Date.parse("2026-10-25T22:00:00.000Z"));
  const plannedAt = new Date(now + 5000).toISOString();
  assert.equal(nextTaskRefresh([{ plannedAt, dueAt: null, routineOccurrence: null }], "Europe/Kyiv", now), now + 5000);
  assert.equal(nextTaskRefresh([{ plannedAt: null, dueAt: null, routineOccurrence: { timezone: "UTC" } }], "Europe/Kyiv", now),
    Date.parse("2026-10-25T00:00:00.000Z"));
});
test("delete failures distinguish definite rejection from network/timeout/server uncertainty", () => {
  for (const status of [400, 403, 409, 429]) assert.equal(taskRemovalError(new ApiError("Mock rejection", status)).uncertain, false);
  for (const error of [new Error("Network lost"), new ApiError("Timeout", 408), new ApiError("Server", 500), new ApiError("Gateway", 504)]) {
    const outcome = taskRemovalError(error);
    assert.equal(outcome.uncertain, true); assert(outcome.message.includes("міг виконатися"));
    assert(!outcome.message.includes("залишилися без змін"));
  }
});
