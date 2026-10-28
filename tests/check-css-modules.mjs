import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';

const sourceRoot = path.resolve('src');
const files = readdirSync(sourceRoot, { recursive: true }).map(file => path.join(sourceRoot, file));
const cache = new Map();
function cssExports(file) {
  if (cache.has(file)) return cache.get(file);
  const result = new Set();
  cache.set(file, result);
  const root = postcss.parse(readFileSync(file, 'utf8'));
  const imported = new Set();
  root.walkRules(rule => {
    const match = rule.selector.match(/^:import\(["'](.+)["']\)$/);
    if (!match) return;
    const exports = cssExports(path.resolve(path.dirname(file), match[1]));
    rule.walkDecls(decl => {
      imported.add(decl.prop);
      assert(exports.has(decl.value), `${file}: unknown imported CSS class ${decl.value}`);
    });
  });
  root.walkRules(rule => {
    if (rule.selector.startsWith(':import')) return;
    for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      if (!imported.has(match[1])) result.add(match[1]);
    }
  });
  root.walkDecls('composes', decl => {
    const match = decl.value.match(/^(.*?)\s+from\s+["'](.+)["']$/);
    if (!match) return;
    const exports = cssExports(path.resolve(path.dirname(file), match[2]));
    for (const name of match[1].split(/\s+/)) assert(exports.has(name), `${file}: unknown composed class ${name}`);
  });
  return result;
}
let checked = 0, dynamic = 0;
for (const file of files.filter(file => /\.[jt]sx?$/.test(file))) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = new Map();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause?.name || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    if (!specifier.endsWith('.module.css')) continue;
    assert(!specifier.endsWith('/app/page.module.css'), `Old CSS dependency: ${file}`);
    imports.set(node.importClause.name.text, path.resolve(path.dirname(file), specifier));
  }
  function check(alias, name) {
    assert(cssExports(imports.get(alias)).has(name), `${file}: ${alias}.${name} is not exported`);
    checked++;
  }
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && imports.has(node.expression.text)) check(node.expression.text, node.name.text);
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && imports.has(node.expression.text)) {
      const key = node.argumentExpression;
      if (ts.isStringLiteral(key)) check(node.expression.text, key.text);
      else {
        // The current dynamic consumer maps `groups` to `styles[group.id]`.
        assert(ts.isPropertyAccessExpression(key) && key.getText(source) === 'group.id', `Review new dynamic CSS access: ${file}`);
        let ids = [];
        function findGroups(candidate) {
          if (ts.isVariableDeclaration(candidate) && candidate.name.getText(source) === 'groups' && candidate.initializer && ts.isArrayLiteralExpression(candidate.initializer)) {
            ids = candidate.initializer.elements.map(element => {
              assert(ts.isObjectLiteralExpression(element));
              const id = element.properties.find(prop => ts.isPropertyAssignment(prop) && prop.name.getText(source) === 'id');
              assert(id && ts.isStringLiteral(id.initializer));
              return id.initializer.text;
            });
          }
          ts.forEachChild(candidate, findGroups);
        }
        findGroups(source);
        assert(ids.length, `Cannot resolve dynamic CSS classes: ${file}`);
        for (const id of ids) check(node.expression.text, id);
        dynamic++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(`CSS Modules: ${checked} class accesses, ${dynamic} dynamic access, ${cache.size} modules; all exports/imports/composes valid.`);
