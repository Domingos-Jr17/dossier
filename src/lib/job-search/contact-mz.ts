import "server-only";

import { lookup } from "node:dns";

import { parse, type HTMLElement } from "node-html-parser";

import { fetchHtml, postingFromHtml } from "@/lib/posting-fetch";

import type { JobSourceAdapter, RequestContext } from "./adapter";
import { jobSearchError } from "./errors";
import { matches } from "./kukwira";
import { POSTED_WITHIN, safeLink, type FoundPosting, type SearchPage, type SearchQuery } from "./search";
import { CONTACT_MZ_URL } from "./sources";

// CONTACT: a Mozambican recruitment and staffing company. Its openings are
// one server-rendered page (/pt/recrutamento/ofertas-de-emprego), each with
// its title, place and when it was published; the text is on each opening's
// own page, with a link to apply on Workable. There's no search, so keywords
// are matched here on the title and place, and the place puts its openings
// first. Its robots.txt allows everything.

const SOURCE = "CONTACT_MZ";
const LIST_PATH = "/pt/recrutamento/ofertas-de-emprego";

/**
 * CONTACT recruits for clients it rarely names ("O nosso Cliente é…"): said
 * in each opening's text, so the AI doesn't write to CONTACT as the employer.
 */
export const CONTACT_NOTE = "Recrutamento através da CONTACT, uma empresa de recrutamento: a oferta pode não dizer qual é a empresa cliente.";

const tidy = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** "medidor orçamentista (m/f) - 1 vaga" as a title: its first letter up. */
const titled = (value: string) => value.charAt(0).toLocaleUpperCase("pt") + value.slice(1);

/** "Pemba, Cabo Delgado Province, Mozambique" → "Pemba, Cabo Delgado". */
export function placeOf(value: string): string {
  return tidy(value)
    .replace(/,\s*(?:Mozambique|Moçambique)$/i, "")
    .replace(/\s+Province\b/gi, "")
    .trim();
}

/** "29-10-2026 às 06:53", Maputo time (UTC+2, no summer time), as an ISO date; null when it isn't one. */
export function publishedAt(value: string): string | null {
  const match = /(\d{2})-(\d{2})-(\d{4})(?:\D+(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, day, month, year, hour = "12", minute = "00"] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 2, Number(minute)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The opening's code in its address: ".../oferta-de-emprego/AF848DEAAB/medidor-…" → "AF848DEAAB". */
const codeOf = (url: string) => /\/oferta-de-emprego\/([A-Z0-9]+)(?:\/|$)/i.exec(url)?.[1] ?? "";

/** The openings on the list page. */
export function parseOffers(html: string): FoundPosting[] {
  const postings: FoundPosting[] = [];
  const seen = new Set<string>();
  for (const offer of parse(html).querySelectorAll(".ofertas .oferta")) {
    const link = offer.querySelector(".titulo a");
    const url = safeLink(link?.getAttribute("href"));
    const code = codeOf(url);
    if (!link || !code || seen.has(code)) continue;
    seen.add(code);
    // "Candidatura Espontânea" stays on the list for good: a way to send a CV, not an opening.
    if (/^candidatura espont/i.test(tidy(link.text))) continue;
    postings.push({
      source: SOURCE,
      externalId: code,
      title: titled(tidy(link.text)).slice(0, 500),
      // The client it recruits for is rarely named; CONTACT is where it was found.
      company: "",
      place: placeOf(offer.querySelector(".local")?.text ?? "").slice(0, 300),
      remote: null,
      salary: "",
      postedAt: publishedAt(offer.querySelector(".data")?.text ?? ""),
      url: url.slice(0, 2000),
      via: "CONTACT",
      description: CONTACT_NOTE,
      complete: false,
    });
  }
  return postings;
}

/** An opening's own page: its text, the agency note, and where to apply. */
export function offerText(html: string): string | null {
  const root = parse(html);
  const wrapper = root.querySelector(".content-wrapper");
  const body = wrapper?.querySelector(".small-8.columns > div") as HTMLElement | null | undefined;
  if (!wrapper || !body) return postingFromHtml(html)?.text ?? null;
  const heading = wrapper.querySelector(".titulo .left");
  const place = tidy(heading?.querySelector("small")?.text);
  heading?.querySelector("small")?.remove();
  const title = titled(tidy(heading?.text));
  const description = postingFromHtml(`<main>${body.outerHTML}</main>`)?.text ?? body.structuredText.trim();
  const apply = wrapper
    .querySelectorAll(".small-4.columns a[href]")
    .map((anchor) => safeLink(anchor.getAttribute("href")))
    .find(Boolean);
  return [[title, placeOf(place)].filter(Boolean).join(" · "), CONTACT_NOTE, description, apply ? `Candidatura: ${apply}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

/** Same as emprego.co.mz: localhost only for the end-to-end tests' fake source (DOSSIER_JOBS_TEST_BASE_URL). */
const reach = (context: RequestContext) => (context.baseUrl ? { lookup } : {});

const plain = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

async function searchPage(query: SearchQuery, _credentials: Record<string, never>, _next: string | null, context: RequestContext = {}): Promise<SearchPage> {
  const base = (context.baseUrl ?? CONTACT_MZ_URL).replace(/\/+$/, "");
  const url = `${base}${LIST_PATH}`;
  const page = await fetchHtml(url, reach(context));
  if (!page.ok) throw jobSearchError(page.status && page.status < 500 ? "changed" : "unavailable", SOURCE, { detail: `${LIST_PATH}: ${page.error}` });
  const days = POSTED_WITHIN.find((option) => option.value === query.postedWithin)?.days ?? null;
  const since = days === null ? null : Date.now() - days * 86_400_000;
  const offers = parseOffers(page.html)
    // Keywords against the title and place: the list has nothing more.
    .filter((offer) => matches({ title: `${offer.title} ${offer.place}`, description: "" }, query.keywords))
    .filter((offer) => since === null || (offer.postedAt !== null && Date.parse(offer.postedAt) >= since));
  // No distance filter: the place only puts its openings first.
  const wanted = plain(query.place.trim());
  if (wanted) offers.sort((a, b) => Number(plain(b.place).includes(wanted)) - Number(plain(a.place).includes(wanted)));
  // All its openings are on the one page.
  return { postings: offers, next: null };
}

export const contactMz: JobSourceAdapter<"CONTACT_MZ"> = {
  source: SOURCE,
  search: searchPage,
  details: async (posting, _credentials, context = {}) => {
    if (!posting.url) return null;
    const page = await fetchHtml(posting.url, reach(context));
    return page.ok ? offerText(page.html) : null;
  },
  test: async (_credentials, context) => {
    await searchPage({ keywords: "", place: "", country: "mz", radiusKm: 25, remoteOnly: false, postedWithin: "any" }, {}, null, context);
  },
};
