// Collects user-facing English strings: JSX text, string attributes people see,
// and string/template literals in UI files and in lib messages.
const ts = require(require("path").resolve(__dirname, "../../node_modules/typescript"));
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../../src");
const files = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!["generated", "test"].includes(e.name)) walk(p); } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|db\.test|live\.test)\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(p); } };
walk(root);
const VISIBLE_ATTRS = new Set(["placeholder", "label", "title", "aria-label", "alt", "description", "hint", "tag", "name", "text", "heading", "emptyText", "confirmLabel", "cancelLabel", "progress"]);
const out = new Map();
const add = (s, file, kind) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t || t.length < 2) return;
  if (!/[A-Za-z]{2}/.test(t)) return;
  if (/^[a-z0-9_.:/#@?=&%-]+$/.test(t) && !/\s/.test(t)) return; // ids, classes, paths
  if (/^(bg|text|flex|grid|px|py|mt|mb|rounded|border|w-|h-|min-|max-|items|justify|gap|font|inline|hidden|block|absolute|relative|sr-only|group|motion|size-|shrink|truncate|col-|row-|self-|ml-|mr-|pl-|pr-|pt-|pb-|data-|aria-)/.test(t)) return;
  if (/^(https?:|\/api\/|\/[a-z])/.test(t)) return;
  const e = out.get(t) || { n: 0, files: new Set(), kinds: new Set() };
  e.n++; e.files.add(path.relative(root, file)); e.kinds.add(kind); out.set(t, e);
};
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const isUi = /\/(app|components)\//.test(file);
  const visit = (node) => {
    if (ts.isJsxText(node)) add(node.getText().replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"), file, "jsx");
    else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && VISIBLE_ATTRS.has(node.name.getText())) add(node.initializer.text, file, "attr");
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
      const t = node.text;
      // Sentences and labels: a capital or a space and letters.
      if (/^[A-Z“"‘'(]/.test(t) && /[a-z]/.test(t) && (isUi || /[.!?…]$|\s/.test(t))) add(t, file, "lit");
    } else if (ts.isTemplateExpression(node)) {
      const pieces = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      const shape = pieces.join("{}");
      if (/[A-Za-z]{3}/.test(shape) && /\s/.test(shape) && !/className|^\s*$/.test(shape)) add(shape, file, "tpl");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const rows = [...out.entries()].sort((a, b) => [...a[1].files][0].localeCompare([...b[1].files][0]));
fs.writeFileSync(process.argv[2], JSON.stringify(rows.map(([t, e]) => ({ t, kinds: [...e.kinds], files: [...e.files].slice(0, 3) })), null, 1));
const byKind = {}; for (const [, e] of rows) for (const k of e.kinds) byKind[k] = (byKind[k] || 0) + 1;
console.log("files", files.length, "unique strings", rows.length, byKind);
console.log("ui files:", rows.filter(([, e]) => [...e.files].some((f) => /^(app|components)\//.test(f))).length, "lib:", rows.filter(([, e]) => [...e.files].every((f) => f.startsWith("lib/"))).length);
