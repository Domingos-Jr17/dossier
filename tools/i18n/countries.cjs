// English → European Portuguese country names, as Intl names them.
const codes = require("fs").readFileSync(process.argv[2], "utf8").match(/const CODES = \(([\s\S]*?)\)\.split/)[1].replace(/["+\s]+/g, " ").trim().split(" ");
const en = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });
const pt = new Intl.DisplayNames(["pt-PT"], { type: "region", fallback: "code" });
const out = ["# Countries (Intl)"];
for (const code of codes) {
  const e = en.of(code.toUpperCase()), p = pt.of(code.toUpperCase());
  if (e && p && e !== p) out.push(`${e}\t${p}`);
}
process.stdout.write(out.join("\n") + "\n");
