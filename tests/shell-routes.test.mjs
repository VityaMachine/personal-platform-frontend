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
const { taskNavigationHrefs } = load("../src/modules/tasks/routes.ts");

test("shell task routes preserve filters, repeated unrelated keys and search drafts across sections", () => {
  const source = new URLSearchParams("archived=true&view=today&q=+draft+&status=TODO&priority=HIGH&area=none&sort=oldest&keep=1&keep=2");
  const original = source.toString();
  const routes = taskNavigationHrefs(original);
  for (const [section, href] of Object.entries(routes)) {
    const url = new URL(href, "https://test.invalid");
    assert.equal(url.pathname, "/");
    assert.equal(url.searchParams.get("archived"), section === "archive" ? "true" : null);
    assert.equal(url.searchParams.get("view"), section === "today" || section === "backlog" ? section : null);
    for (const key of ["q", "status", "priority", "area", "sort", "keep"]) {
      assert.deepEqual(url.searchParams.getAll(key), source.getAll(key));
    }
  }
  assert.equal(source.toString(), original);
});

test("shell task routes keep existing empty-query URLs without redirects", () => {
  assert.deepEqual(taskNavigationHrefs(""), {
    current: "/", today: "/?view=today", backlog: "/?view=backlog", archive: "/?archived=true",
  });
});
