import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const load = createRequire(import.meta.url), ts = load("typescript"), Module = load("node:module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request, ...args);
};
load.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { taskNavigationHrefs, taskHref, taskSectionFromPathname, resolveLegacyTasksUrl } = load("../src/modules/tasks/routes.ts");

test("shell task routes preserve filters, repeated unrelated keys and search drafts across sections", () => {
  const source = new URLSearchParams("archived=true&view=today&q=+draft+&status=TODO&priority=HIGH&area=none&sort=oldest&keep=1&keep=2");
  const original = source.toString();
  const routes = taskNavigationHrefs(original);
  for (const [section, href] of Object.entries(routes)) {
    const url = new URL(href, "https://test.invalid");
    assert.equal(url.pathname, section === "current" ? "/tasks" : `/tasks/${section}`);
    assert.equal(url.searchParams.has("archived"), false);
    assert.equal(url.searchParams.has("view"), false);
    assert.equal(taskSectionFromPathname(url.pathname), section);
    for (const key of ["q", "status", "priority", "area", "sort", "keep"]) {
      assert.deepEqual(url.searchParams.getAll(key), source.getAll(key));
    }
  }
  assert.equal(source.toString(), original);
});

test("shell task routes use canonical paths without legacy selectors or redirect hops", () => {
  assert.deepEqual(taskNavigationHrefs(""), {
    current: "/tasks", today: "/tasks/today", backlog: "/tasks/backlog", archive: "/tasks/archive",
  });
  assert.equal(taskHref("routines", "view=today&archived=true&keep=1&keep=2"), "/tasks/routines?keep=1&keep=2");
  for (const href of [...Object.values(taskNavigationHrefs("view=backlog&archived=true")), taskHref("routines")]) {
    assert.equal(resolveLegacyTasksUrl(href, new URLSearchParams()), null);
  }
});

test("legacy root resolver: priorities, parameter presence, empty values and first repeated value", () => {
  const cases = [
    ["", "/tasks/today"], ["keep=1", "/tasks/today?keep=1"],
    ["archived=true&view=today", "/tasks/archive"], ["archived=true&view=backlog", "/tasks/archive"],
    ["archived=false&view=today", "/tasks/today"], ["archived=&view=backlog", "/tasks/backlog"],
    ["view=today", "/tasks/today"], ["view=backlog", "/tasks/backlog"],
    ["view=unknown", "/tasks"], ["view=", "/tasks"], ["view", "/tasks"],
    ["archived=false", "/tasks"], ["archived=", "/tasks"], ["archived", "/tasks"],
    ["archived=TRUE", "/tasks"],
    ["archived=false&archived=true", "/tasks"],
    ["archived=true&archived=false&view=backlog", "/tasks/archive"],
    ["archived=&archived=true&view=today", "/tasks/today"],
    ["view=unknown&view=today", "/tasks"], ["view=&view=backlog", "/tasks"],
    ["view=backlog&view=today", "/tasks/backlog"], ["view=today&view=backlog", "/tasks/today"],
    ...["q", "status", "priority", "area", "sort"].flatMap(key => [[key, `/tasks?${key}=`], [`${key}=`, `/tasks?${key}=`]]),
    ["q=Mock&status=TODO", "/tasks?q=Mock&status=TODO"],
    ["keep=1&keep=2&view=unknown&q=+draft+", "/tasks?keep=1&keep=2&q=+draft+"],
  ];
  for (const [query, expected] of cases) {
    const params = new URLSearchParams(query), original = params.toString();
    assert.equal(resolveLegacyTasksUrl("/", params), expected, query);
    assert.equal(params.toString(), original, "Resolver must not mutate its input");
    assert.equal(resolveLegacyTasksUrl(new URL(expected, "https://test.invalid").pathname, params), null);
  }
});

test("legacy routines path wins; selectors removed, filters and unknown repeated/encoded query retained", () => {
  const params = new URLSearchParams("view=today&archived=true&q=%2B+%26&x=1&x=&x=3&status=TODO&status=DONE");
  const href = resolveLegacyTasksUrl("/routines", params);
  const url = new URL(href, "https://test.invalid");
  assert.equal(url.pathname, "/tasks/routines");
  assert.equal(url.searchParams.has("view"), false);
  assert.equal(url.searchParams.has("archived"), false);
  for (const key of ["q", "x", "status"]) assert.deepEqual(url.searchParams.getAll(key), params.getAll(key));
  assert.equal(resolveLegacyTasksUrl(url.pathname, url.searchParams), null);
});

test("Next async searchParams record preserves the legacy first-value and presence semantics", () => {
  assert.equal(resolveLegacyTasksUrl("/", { archived: ["false", "true"], view: ["backlog", "today"], q: "", keep: ["a", "", "b"] }),
    "/tasks/backlog?q=&keep=a&keep=&keep=b");
  assert.equal(resolveLegacyTasksUrl("/", { q: "" }), "/tasks?q=");
  assert.equal(resolveLegacyTasksUrl("/", { unknown: ["a", "b"], absent: undefined }), "/tasks/today?unknown=a&unknown=b");
  assert.equal(resolveLegacyTasksUrl("/routines", { archived: "true", keep: ["1", "2"] }), "/tasks/routines?keep=1&keep=2");
});
