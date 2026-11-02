// Picks the option of a list that best says `wanted`, for forms whose lists
// (jobs, courses) are the site's own: "Contabilista sénior" → "Contabilista".

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const STOP = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "senior", "junior", "sr", "jr", "of", "the", "and"]);
/** Without the ending that makes it feminine or plural: "financeira" and "financeiro" are one word. */
const stem = (word: string) => (word.length > 4 ? word.replace(/(as|os|a|o|e|s)$/, "") : word);
const words = (text: string) =>
  fold(text)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map(stem);

export type Option = { value: string; text: string };

/**
 * The option whose words overlap `wanted`'s the most, or null when none
 * shares enough: an exact (folded) match wins, then the most shared words
 * with the fewest left over. Seniority words and "de/da" don't count.
 */
export function bestOption(options: readonly Option[], wanted: string): Option | null {
  const target = fold(wanted);
  if (!target) return null;
  const exact = options.find((option) => option.value !== "" && fold(option.text) === target);
  if (exact) return exact;
  const wantedWords = new Set(words(wanted));
  if (wantedWords.size === 0) return null;
  let best: { option: Option; score: number } | null = null;
  for (const option of options) {
    if (option.value === "") continue;
    const optionWords = words(option.text);
    if (optionWords.length === 0) continue;
    const shared = optionWords.filter((word) => wantedWords.has(word)).length;
    if (shared === 0) continue;
    // Shared words, as a share of both sides': a tie goes to the shorter option.
    const score = shared / Math.max(optionWords.length, wantedWords.size);
    if (score >= 0.5 && (!best || score > best.score)) best = { option, score };
  }
  return best?.option ?? null;
}
