import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const load = createRequire(import.meta.url), ts = load("typescript");
load.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { themeTokens, applyTheme, themeBootstrap } = load("../src/modules/settings/model/theme.ts");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
function documentMock() {
  const sheet = { cssRules: [], insertRule(rule) { this.cssRules.push(rule); }, deleteRule(index) { this.cssRules.splice(index, 1); } };
  return { sheet, document: { getElementById: () => ({ sheet }) } };
}
test("every declared palette token participates in explicit themes and system CSS", () => {
  const names = mode => [...css.matchAll(new RegExp("--" + mode + "-([\\w-]+):", "g"))].map(match => match[1]).sort();
  assert.deepEqual([...themeTokens].sort(), names("light"));
  assert.deepEqual(names("light"), names("dark"));
  assert.equal(new Set(themeTokens).size, themeTokens.length);
  for (const token of themeTokens) for (const mode of ["light", "dark"]) {
    assert(css.includes(`--${token}: var(--${mode}-${token});`), `${mode} system alias for ${token}`);
  }
});
test("saved bootstrap and runtime switch use identical complete palettes; system clears override", () => {
  const previous = globalThis.document;
  try {
    for (const theme of ["light", "dark"]) {
      const runtime = documentMock(); globalThis.document = runtime.document;
      applyTheme("dark"); applyTheme(theme);
      assert.equal(runtime.sheet.cssRules.length, 1);
      const bootstrap = documentMock();
      runInNewContext(themeBootstrap, { document: bootstrap.document, localStorage: {
        getItem: () => JSON.stringify({ version: 1, theme }),
      } });
      const compact = rule => rule.replaceAll(/\s/g, "");
      assert.equal(compact(bootstrap.sheet.cssRules[0]), compact(runtime.sheet.cssRules[0]));
      for (const token of themeTokens) assert(runtime.sheet.cssRules[0].includes(`--${token}:var(--${theme}-${token});`));
      applyTheme("system"); assert.equal(runtime.sheet.cssRules.length, 0);
    }
  } finally { globalThis.document = previous; }
});
