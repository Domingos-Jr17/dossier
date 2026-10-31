// The interface in another language without touching the screens: their
// English text, as rendered, is looked up in a dictionary (src/lib/i18n/pt-PT.ts)
// and replaced in the page (src/components/interface-translator.tsx). Text
// the dictionary doesn't know stays in English. Kept apart from the screens
// so this fork merges Dossier's own changes without conflicts.

export type Dictionary = {
  /** Whole texts as they appear, whitespace tidied: "Find jobs" → "Procurar vagas". */
  exact: Readonly<Record<string, string>>;
  /**
   * Texts with parts that vary (numbers, names, dates), as patterns and
   * replacements with $1, $2… (each part translated when the dictionary knows
   * it), or a function of the parts as written and of the dictionary.
   */
  patterns: readonly (readonly [RegExp, string | ((parts: string[], translate: (text: string) => string) => string)])[];
};

const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * `value` in the dictionary's language, keeping its leading and trailing
 * whitespace, or null when the dictionary doesn't know it. A pattern's parts
 * are translated too when the dictionary knows them ("Status: Interview",
 * "Created 30 Oct 2026").
 */
export function translateText(value: string, dictionary: Dictionary): string | null {
  const key = tidy(value);
  if (!key || !/\p{L}/u.test(key)) return null;
  const lead = /^\s*/.exec(value)![0];
  const trail = /\s*$/.exec(value)![0];
  const exact = dictionary.exact[key];
  if (exact !== undefined) return exact === key ? null : `${lead}${exact}${trail}`;
  for (const [pattern, replacement] of dictionary.patterns) {
    const match = pattern.exec(key);
    if (!match || match[0] !== key) continue;
    const parts = match.slice(1).map((part = "") => part);
    const translate = (text: string) => translateText(text, dictionary)?.trim() ?? text;
    const translated =
      typeof replacement === "function"
        ? replacement(parts, translate)
        : replacement.replace(/\$(\d)/g, (_, index: string) => translate(parts[Number(index) - 1] ?? ""));
    return `${lead}${translated}${trail}`;
  }
  return null;
}

/** "{count} postings from {source}" as a pattern: the parts in braces match anything, the rest as written. */
export function pattern(template: string, replacement: string): readonly [RegExp, string] {
  const source = template
    .split(/\{[^}]*\}/)
    .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(.+?)");
  return [new RegExp(`^${source}$`, "u"), replacement] as const;
}
