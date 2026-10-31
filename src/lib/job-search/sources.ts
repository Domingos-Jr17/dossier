import type { JobSource, JSearchHost } from "./search";

/** What Settings → Job search may know about a source's key: never the key itself. "env" means it comes from the environment. */
export type JobKeyState = "none" | "set" | "unreadable" | "env";

/** What the Job search section starts from (E14-4). */
export type JobSearchSettingsView = {
  source: JobSource | "OFF";
  jsearch: { host: JSearchHost; keyState: JobKeyState };
  adzuna: { appId: string; keyState: JobKeyState };
  /** Whether this server offers the Bundesagentur für Arbeit, and when its note was accepted (#223). */
  arbeitsagentur: { offered: boolean; acceptedAt: string | null };
  /** The FreeHire it searches: "freehire.me", or a self-hosted one's host (DOSSIER_FREEHIRE_URL). */
  freehire: { host: string };
  /** The sources "Several sources" asks at once. */
  multi: JobSource[];
};

export const JOB_KEY_UNREADABLE = "Your saved key can't be read. Please enter it again.";

/** Where to get a JSearch key, by where it's from. */
export const JSEARCH_KEY_URLS: Record<JSearchHost, string> = {
  openwebninja: "https://www.openwebninja.com/api/jsearch",
  rapidapi: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
};

/** How Settings → Job search and the Find jobs screen describe each source (E14). */
export type SourceInfo = {
  name: string;
  /** What it covers, in a line. */
  description: string;
  /** Cost and reach at a glance. */
  tag: string;
  /** Where to get a key; null when none is needed. */
  keyUrl: string | null;
  /** When used-up searches come back: "this month", "today"; null when there's no quota. */
  quotaPeriod: string | null;
  /** Shown with its results, as the source's terms ask. */
  attribution: string | null;
  /**
   * Where the attribution links, when the terms ask for a link: the source's
   * site for the posting's country when its link is on one (`local`), else
   * `home`. Null for a plain-text attribution.
   */
  attributionLink: { home: string; local: RegExp } | null;
  /** The countries it lists jobs in (ISO codes); null for every country. */
  countries: readonly string[] | null;
  /** Whether it looks within a distance of the place; without, the place only puts postings there first. */
  radius: boolean;
  /** Whether it lists postings without keywords too (a city's, or the newest), so "What" can stay empty. */
  browses: boolean;
};

/** emprego.co.mz, read from the pages a visitor sees (it has no API). */
export const EMPREGO_MZ_URL = "https://www.emprego.co.mz";

/** CONTACT's site, whose openings are read from its pages. */
export const CONTACT_MZ_URL = "https://www.contact.co.mz";

/** Kukwira's site, whose openings are read from the fragments its own pages load. */
export const KUKWIRA_URL = "https://www.kukwira.co.mz";

export const SOURCE_INFO: Record<JobSource, SourceInfo> = {
  JSEARCH: {
    name: "JSearch",
    description: "Postings from LinkedIn, Indeed, Glassdoor and company sites, through Google for Jobs.",
    tag: "Most countries · free key with 200 searches a month",
    keyUrl: "https://www.openwebninja.com/api/jsearch",
    quotaPeriod: "this month",
    attribution: null,
    attributionLink: null,
    countries: null,
    radius: true,
    browses: false,
  },
  ADZUNA: {
    name: "Adzuna",
    description: "Adzuna's own job index in 19 countries. It only shares the start of each posting.",
    tag: "19 countries · free key, about 250 searches a day",
    keyUrl: "https://developer.adzuna.com/signup",
    quotaPeriod: "today",
    attribution: "Jobs by Adzuna",
    // Its terms: "Adzuna" on each displayed advert, at least 116 × 23 px, linked to adzuna.co.uk or the local site.
    attributionLink: { home: "https://www.adzuna.co.uk", local: /^www\.adzuna\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/ },
    countries: ["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"],
    radius: true,
    browses: false,
  },
  ARBEITSAGENTUR: {
    name: "Bundesagentur für Arbeit",
    description: "Germany's federal job board, with full postings. Unofficial: you choose it on your own responsibility.",
    tag: "Germany only · free, no key · unofficial",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Source: Bundesagentur für Arbeit",
    attributionLink: null,
    countries: ["de"],
    radius: true,
    browses: false,
  },
  FREEHIRE: {
    name: "FreeHire",
    description: "Mostly tech postings, read straight from company career pages (Greenhouse, Lever, Workday and more), with full postings.",
    tag: "Most countries · free, no key · no distance filter",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Jobs by FreeHire",
    attributionLink: null,
    countries: null,
    // It has a city filter, but only for the names it knows, and a country with it widens rather than narrows.
    radius: false,
    browses: false,
  },
  EMPREGO_MZ: {
    name: "emprego.co.mz",
    description: "Mozambique's main job board, with full postings. Read from its pages, as a visitor sees them; expired postings are left out.",
    tag: "Mozambique only · free, no key · no distance filter",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Vagas de emprego.co.mz",
    attributionLink: { home: EMPREGO_MZ_URL, local: /^www\.emprego\.co\.mz$/ },
    countries: ["mz"],
    // Its city pages hold one city each; without keywords the place picks one, with them it only puts its postings first.
    radius: false,
    browses: true,
  },
  KUKWIRA: {
    name: "Kukwira",
    description: "A Mozambican recruitment agency's own openings, with full postings. A handful at a time; keywords are matched in their text.",
    tag: "Mozambique only · free, no key · no place filter",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Vagas da Kukwira",
    attributionLink: { home: KUKWIRA_URL, local: /^www\.kukwira\.co\.mz$/ },
    countries: ["mz"],
    // Its openings don't say where the job is.
    radius: false,
    browses: true,
  },
  CONTACT_MZ: {
    name: "CONTACT",
    description: "A Mozambican recruitment and staffing company's own openings, from call centres to engineering, with full postings. Keywords are matched in their titles.",
    tag: "Mozambique only · free, no key · no distance filter",
    keyUrl: null,
    quotaPeriod: null,
    attribution: "Vagas da CONTACT",
    attributionLink: { home: CONTACT_MZ_URL, local: /^www\.contact\.co\.mz$/ },
    countries: ["mz"],
    // No distance filter: the place puts its openings first.
    radius: false,
    browses: true,
  },
  MULTI: {
    name: "Several sources",
    description: "The sources you tick below, searched at once. Each posting keeps its source, and a source that fails leaves the others' postings.",
    tag: "Any of the others · their keys and limits apply",
    keyUrl: null,
    quotaPeriod: null,
    attribution: null,
    attributionLink: null,
    // Each source keeps to its own countries; the others answer.
    countries: null,
    radius: false,
    // Without keywords, only the sources that list postings by place are asked.
    browses: true,
  },
};

/**
 * The sources "Several sources" can ask: every other one but the
 * Bundesagentur für Arbeit, whose terms rule out searching it alongside (#223).
 */
export const MULTI_SOURCES = ["JSEARCH", "ADZUNA", "FREEHIRE", "EMPREGO_MZ", "KUKWIRA", "CONTACT_MZ"] as const satisfies readonly Exclude<JobSource, "MULTI" | "ARBEITSAGENTUR">[];
export type MultiSource = (typeof MULTI_SOURCES)[number];

/** "emprego.co.mz, Kukwira and JSearch": sources' names as a sentence lists them. */
export function sourceNames(sources: readonly JobSource[]): string {
  const names = sources.map((source) => SOURCE_INFO[source].name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** What "Several sources" asks when nothing is chosen in Settings or DOSSIER_JOBS_SOURCES: Mozambique's own boards. */
export const DEFAULT_MULTI_SOURCES: readonly MultiSource[] = ["EMPREGO_MZ", "KUKWIRA", "CONTACT_MZ"];

/** FreeHire's public catalogue; DOSSIER_FREEHIRE_URL can name a self-hosted one instead. */
export const FREEHIRE_URL = "https://freehire.me";

/** Whether a source lists jobs in a country ("de"). */
export function sourceCovers(source: JobSource, country: string): boolean {
  const countries = SOURCE_INFO[source].countries;
  return countries === null || countries.includes(country);
}

// The Bundesagentur für Arbeit (#223) has no official API: Dossier uses the
// access its own job search uses, without its permission. So it's the
// user's own choice, after this note, and a server can turn it off
// (DOSSIER_JOBS_ARBEITSAGENTUR=off).

/** The BA's terms of use for arbeitsagentur.de. */
export const ARBEITSAGENTUR_TERMS_URL = "https://www.arbeitsagentur.de/datei/nutzungsbedingungen_ba036575.pdf";

/** What "I understand" agrees to, in Settings, in Find jobs and in the server log. */
export const ARBEITSAGENTUR_NOTE =
  "The Bundesagentur für Arbeit has no official API. Dossier searches it through the access its own job search uses, without its permission, " +
  "and the BA's terms of use don't allow automated access. You choose this source on your own responsibility, and it can stop working at any time.";

/** A BA posting's own page on arbeitsagentur.de, which its results always link to, even when they have a link of their own. */
export function arbeitsagenturPage(posting: { source: JobSource; externalId: string }): string | null {
  return posting.source === "ARBEITSAGENTUR" ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(posting.externalId)}` : null;
}

/** Where a posting's attribution links (www.adzuna.de for one of Adzuna's German postings); null when it's plain text. */
export function attributionHref(source: JobSource, postingUrl: string): string | null {
  const link = SOURCE_INFO[source].attributionLink;
  if (!link) return null;
  const host = URL.canParse(postingUrl) ? new URL(postingUrl) : null;
  return host?.protocol === "https:" && link.local.test(host.hostname) ? host.origin : link.home;
}
