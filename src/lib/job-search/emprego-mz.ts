import "server-only";

import { parse, type HTMLElement } from "node-html-parser";

import { fetchHtml, postingFromHtml } from "@/lib/posting-fetch";

import type { JobSourceAdapter, RequestContext } from "./adapter";
import { jobSearchError } from "./errors";
import { safeLink, type FoundPosting, type SearchPage, type SearchQuery } from "./search";
import { EMPREGO_MZ_URL } from "./sources";

// emprego.co.mz: Mozambique's main job board. It has no API and its robots.txt
// keeps its feeds and wp-json out, so Dossier reads the pages a visitor sees:
// /pesquisa/<words>/ for keywords, /cidade/<city>/ for a place alone, else the
// front page. Lists come newest first and keep expired postings, which are
// left out; a whole page of them ends the search. Each posting's page has the
// full text (its JobPosting data only has a one-line summary).

const SOURCE = "EMPREGO_MZ";

/** "Cabo Delgado" → "cabo-delgado", the way the site names its city pages. */
export function citySlug(place: string): string {
  return place
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Where the first page of a search is. */
export function firstPageUrl({ keywords, place }: SearchQuery, baseUrl = EMPREGO_MZ_URL): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (keywords) return `${base}/pesquisa/${encodeURIComponent(keywords)}/`;
  const city = citySlug(place);
  return city ? `${base}/cidade/${city}/` : `${base}/`;
}

const text = (element: HTMLElement | null | undefined) => (element?.text ?? "").replace(/\s+/g, " ").trim();

/** One row of a list: search and city pages use one layout, the front page a grid of cards. */
function postingFromRow(row: HTMLElement): (FoundPosting & { expired: boolean }) | null {
  const link = row.querySelector('h3 a[href*="/vaga/"]');
  const url = safeLink(link?.getAttribute("href"));
  if (!link || !url) return null;
  const slug = new URL(url).pathname.replace(/^\/vaga\/|\/+$/g, "");
  if (!slug) return null;
  // The last column of a list row: a closing date like "23.11.2026", or "Expirado".
  const validity = text(row.querySelector(".col-1-7"));
  const deadline = /^\d{2}\.\d{2}\.\d{4}$/.test(validity) ? validity : "";
  const summary = text(row.querySelector("h4"));
  return {
    source: SOURCE,
    externalId: slug.slice(0, 500),
    title: text(link).slice(0, 500),
    // Rows come in three layouts (list, featured, grid); the employer's link is in all of them.
    company: text(row.querySelector('a[href*="/empregador/"]')).slice(0, 300),
    place: text(row.querySelector('a[href*="/cidade/"]')).slice(0, 300),
    remote: null,
    salary: "",
    postedAt: null,
    url: url.slice(0, 2000),
    via: "",
    description: [summary, deadline && `Prazo: ${deadline}`].filter(Boolean).join("\n\n").slice(0, 100_000),
    complete: false,
    expired: /expirad/i.test(validity),
  };
}

/**
 * The postings on a list page, and the address of the next one. `place` puts
 * its postings first; `city` is the city a city page is for, whose list rows
 * show their category where the city would be.
 */
export function parseListPage(html: string, { place = "", city = "" }: { place?: string; city?: string } = {}): { postings: FoundPosting[]; next: string | null } {
  const root = parse(html);
  const seen = new Set<string>();
  const rows: (FoundPosting & { expired: boolean })[] = [];
  for (const row of root.querySelectorAll("li")) {
    const posting = postingFromRow(row);
    if (!posting || seen.has(posting.externalId)) continue;
    seen.add(posting.externalId);
    rows.push(posting.place || !city ? posting : { ...posting, place: city.slice(0, 300) });
  }
  const open: FoundPosting[] = rows.filter((row) => !row.expired).map(({ expired, ...posting }) => (void expired, posting));
  // There's no distance filter: the place only puts its postings first.
  const wanted = citySlug(place);
  if (wanted) open.sort((a, b) => Number(citySlug(b.place) === wanted) - Number(citySlug(a.place) === wanted));
  // Newest first, so a page with nothing open left means the rest are older still.
  const allExpired = rows.length > 0 && open.length === 0;
  const next = safeLink(root.querySelector('link[rel="next"]')?.getAttribute("href"));
  return { postings: open, next: next && !allExpired ? next : null };
}

/** A posting's own page: its text, and how to apply when it's on another site. */
export function postingText(html: string): string | null {
  const root = parse(html);
  const body = root.querySelector(".content-vacancy .medium-large-text");
  if (!body) return postingFromHtml(html)?.text ?? null;
  const title = text(root.querySelector(".content-vacancy h1"));
  const company = text(root.querySelector(".content-vacancy h3"));
  // Short ones fall below what counts as a posting there: keep their lines.
  const description = postingFromHtml(`<main>${body.outerHTML}</main>`)?.text ?? body.structuredText.trim();
  const external = root
    .querySelectorAll(".how-to-apply-section a[href]")
    .map((anchor) => safeLink(anchor.getAttribute("href")))
    .find((href) => href && !/(^|\.)emprego\.co\.mz$/i.test(new URL(href).hostname));
  const apply = external ? `Candidatura: ${external}` : "Candidatura: com uma conta no emprego.co.mz.";
  return [[company, title].filter(Boolean).join(": "), description, apply].filter(Boolean).join("\n\n");
}

/** Only this site's own pages are followed, so a changed "next" link can't send requests elsewhere. */
function ownPage(link: string, baseUrl: string): boolean {
  try {
    return new URL(link).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}

async function searchPage(query: SearchQuery, _credentials: Record<string, never>, next: string | null, context: RequestContext = {}): Promise<SearchPage> {
  const baseUrl = context.baseUrl ?? EMPREGO_MZ_URL;
  const url = next && ownPage(next, baseUrl) ? next : firstPageUrl(query, baseUrl);
  const page = await fetchHtml(url);
  if (!page.ok) {
    // A city the site has no page for has no postings.
    if (page.status === 404) return { postings: [], next: null };
    throw jobSearchError("unavailable", SOURCE, { detail: `${new URL(url).pathname}: ${page.error}` });
  }
  const { postings, next: following } = query.keywords ? parseListPage(page.html, { place: query.place }) : parseListPage(page.html, { city: query.place });
  return { postings, next: following && ownPage(following, baseUrl) ? following : null };
}

export const empregoMz: JobSourceAdapter<"EMPREGO_MZ"> = {
  source: SOURCE,
  search: searchPage,
  details: async (posting) => {
    if (!posting.url) return null;
    const page = await fetchHtml(posting.url);
    return page.ok ? postingText(page.html) : null;
  },
  test: async (_credentials, context) => {
    await searchPage({ keywords: "", place: "", country: "mz", radiusKm: 25, remoteOnly: false, postedWithin: "any" }, {}, null, context);
  },
};
