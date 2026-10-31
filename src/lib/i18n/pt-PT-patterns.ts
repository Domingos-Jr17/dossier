import type { Dictionary } from "./translate";

// Hand-written patterns for European Portuguese: dates as src/lib/dates.ts
// and the calendar write them in English ("Sat 31 Oct, 13:14", "30 Oct 2026",
// "Monday 19 October", "Mar 2021 – Present"), and texts that join parts
// with "·".

const MONTHS: Record<string, string> = {
  Jan: "jan.", Feb: "fev.", Mar: "mar.", Apr: "abr.", May: "mai.", Jun: "jun.",
  Jul: "jul.", Aug: "ago.", Sep: "set.", Oct: "out.", Nov: "nov.", Dec: "dez.",
};
const WEEKDAYS: Record<string, string> = { Mon: "seg.", Tue: "ter.", Wed: "qua.", Thu: "qui.", Fri: "sex.", Sat: "sáb.", Sun: "dom." };
const LONG_MONTHS: Record<string, string> = {
  January: "janeiro", February: "fevereiro", March: "março", April: "abril", May: "maio", June: "junho",
  July: "julho", August: "agosto", September: "setembro", October: "outubro", November: "novembro", December: "dezembro",
};
const LONG_WEEKDAYS: Record<string, string> = {
  Monday: "segunda-feira", Tuesday: "terça-feira", Wednesday: "quarta-feira", Thursday: "quinta-feira",
  Friday: "sexta-feira", Saturday: "sábado", Sunday: "domingo",
};

const MONTH = `(${Object.keys(MONTHS).join("|")})`;
const WEEKDAY = `(${Object.keys(WEEKDAYS).join("|")})`;
const LONG_MONTH = `(${Object.keys(LONG_MONTHS).join("|")})`;
const LONG_WEEKDAY = `(${Object.keys(LONG_WEEKDAYS).join("|")})`;

/** "Mar 2021" or "2021" in Portuguese; "Present" as "Presente". */
const monthYear = (value: string) =>
  value === "Present" ? "Presente" : value.replace(new RegExp(`^${MONTH} `), (_, month: string) => `${MONTHS[month]} `);

export const PT_PT_PATTERNS: Dictionary["patterns"] = [
  // "Sat 31 Oct", "31 Oct 2026", "Sat 31 Oct 2026, 13:14"
  [
    new RegExp(`^(?:${WEEKDAY} )?(\\d{1,2}) ${MONTH}(?: (\\d{4}))?(?:, (\\d{1,2}:\\d{2}))?$`, "u"),
    ([weekday, day, month, year, time]) =>
      [weekday ? `${WEEKDAYS[weekday]} ` : "", `${day} ${MONTHS[month]}`, year ? ` ${year}` : "", time ? `, ${time}` : ""].join(""),
  ],
  // "Oct 2026"
  [new RegExp(`^${MONTH} (\\d{4})$`, "u"), ([month, year]) => `${MONTHS[month]} ${year}`],
  // "Mar 2021 – Present", "2015 – 2016"
  [
    new RegExp(`^((?:${MONTH} )?\\d{4}) – ((?:${MONTH} )?\\d{4}|Present)$`, "u"),
    ([from, , to]) => `${monthYear(from)} – ${monthYear(to)}`,
  ],
  // The calendar: "October 2026", "Monday 19 October"
  [new RegExp(`^${LONG_MONTH} (\\d{4})$`, "u"), ([month, year]) => `${LONG_MONTHS[month]} de ${year}`],
  [
    new RegExp(`^${LONG_WEEKDAY} (\\d{1,2}) ${LONG_MONTH}$`, "u"),
    ([weekday, day, month]) => `${LONG_WEEKDAYS[weekday]}, ${day} de ${LONG_MONTHS[month]}`,
  ],
  // What the agent searches: "financeiro · Mozambique · via Kukwira"
  [/^(.+) · via (.+)$/u, ([what, source], translate) => `${what.split(" · ").map(translate).join(" · ")} · via ${source}`],
];

/** Month and weekday names on their own, as forms list them. */
export const PT_PT_NAMES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(LONG_MONTHS).map(([en, pt]) => [en, pt.charAt(0).toUpperCase() + pt.slice(1)])),
  ...Object.fromEntries(Object.entries(LONG_WEEKDAYS).map(([en, pt]) => [en, pt.charAt(0).toUpperCase() + pt.slice(1)])),
};
