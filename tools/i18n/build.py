# Builds src/lib/i18n/pt-PT.ts from the extracted strings (todo.json) and the
# translations (pt*.tsv: id<TAB>Portuguese, with {} or {n} for the varying parts),
# plus extra.tsv (English<TAB>Portuguese) for texts built in code.
import json, glob, re, sys, os
here = os.path.dirname(os.path.abspath(__file__))
todo = {r["id"]: r["t"] for r in json.load(open(os.path.join(here, "todo.json")))}
pairs = []
for path in sorted(glob.glob(os.path.join(here, "pt*.tsv"))):
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip(): continue
        i, pt = line.split("\t", 1)
        if pt.strip() == "-": continue  # left untranslated on purpose
        pairs.append((todo[int(i)], pt))
for line in (l for f in sorted(glob.glob(os.path.join(here, "extra*.tsv"))) for l in open(f, encoding="utf-8")):
    line = line.rstrip("\n")
    if line.strip() and not line.startswith("#"):
        en, pt = line.split("\t", 1); pairs.append((en, pt))
exact, patterns, skipped = {}, [], []
tidy = lambda s: re.sub(r"\s+", " ", s).strip()
for en, pt in pairs:
    en, pt = tidy(en), tidy(pt)
    if "{}" not in en and not re.search(r"\{[a-z]\w*\}", en):
        exact[en] = pt; continue
    literal = re.sub(r"\{[^}]*\}", "", en)
    # Too few words to be specific, except a few that start with a whole word.
    if len(re.findall(r"[A-Za-zÀ-ÿ]", literal)) < 5 and en not in ("Edit {}", "Sent. {}", "Fact {}", "{} · {} page", "Copy {}"):
        skipped.append(en); continue
    # English placeholders in order → $1.. ; Portuguese {} in order or {n} explicit.
    count = len(re.findall(r"\{[^}]*\}", en))
    seq = iter(range(1, count + 1))
    rep = re.sub(r"\{(\d?)\}", lambda m: f"${m.group(1) or next(seq)}", pt)
    patterns.append((en, rep))
def js(s): return json.dumps(s, ensure_ascii=False)
# Longer patterns first: the more specific one wins.
patterns.sort(key=lambda p: -len(re.sub(r"\{[^}]*\}", "", p[0])))
out = ['import { PT_PT_NAMES, PT_PT_PATTERNS } from "./pt-PT-patterns";', 'import { pattern, type Dictionary } from "./translate";', "",
       "// The interface in European Portuguese, as written in Portugal and",
       "// Mozambique: each English text as the screens render it, and patterns for",
       "// the ones with numbers or names in them. Generated from the screens' texts;",
       "// a text missing here shows in English.", "",
       "export const PT_PT: Dictionary = {", "  exact: {", "    ...PT_PT_NAMES,"]
for en in sorted(exact): out.append(f"    {js(en)}: {js(exact[en])},")
out += ["  },", "  patterns: ["]
for en, rep in patterns: out.append(f"    pattern({js(en)}, {js(rep)}),")
out += ["    ...PT_PT_PATTERNS,", "  ],", "};", ""]
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(out))
print(f"exact {len(exact)} · patterns {len(patterns)} · skipped {len(skipped)}: {skipped[:12]}")
