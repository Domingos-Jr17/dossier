import "server-only";

import { FETCH_MESSAGES, fetchHtml, fetchPosting, type FetchedPosting } from "@/lib/posting-fetch";

import { postingText as empregoMzText } from "./emprego-mz";
import { kukwira } from "./kukwira";
import type { FoundPosting } from "./search";

// "Fetch" for the job sites Dossier has an adapter for, which the plain
// reading of a page gets wrong: emprego.co.mz's JobPosting data is a one-line
// summary (and its page has the site's menus and other postings around the
// posting), and a Kukwira link is the address of its app, not of the posting.
// Every other link is read as before (src/lib/posting-fetch.ts).

const host = (link: string) => (URL.canParse(link) ? new URL(link).hostname.toLowerCase() : "");

const EMPTY_POSTING: FoundPosting = {
  source: "KUKWIRA",
  externalId: "",
  title: "",
  company: "",
  place: "",
  remote: null,
  salary: "",
  postedAt: null,
  url: "",
  via: "",
  description: "",
  complete: false,
};

/** The posting at `link`, read by its site's adapter when there is one. */
export async function fetchPostingFromLink(link: string): Promise<FetchedPosting> {
  const site = host(link);
  if (/(^|\.)emprego\.co\.mz$/.test(site)) {
    const page = await fetchHtml(link);
    if (!page.ok) return { ok: false, error: page.error };
    const text = empregoMzText(page.html);
    return text ? { ok: true, text, source: "page", url: page.url } : { ok: false, error: FETCH_MESSAGES.unreadable };
  }
  const opening = /^#\/(?:info|candidatura)#(\d+)$/.exec(URL.canParse(link) ? new URL(link).hash : "")?.[1];
  if (/(^|\.)kukwira\.co\.mz$/.test(site) && opening) {
    const posting: FoundPosting = { ...EMPTY_POSTING, externalId: opening, url: `https://www.kukwira.co.mz/#/info#${opening}` };
    const text = await kukwira.details(posting, {});
    return text ? { ok: true, text, source: "page", url: posting.url } : { ok: false, error: FETCH_MESSAGES.unreachable };
  }
  return fetchPosting(link);
}
