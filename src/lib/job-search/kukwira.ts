import "server-only";

import http from "node:http";
import https from "node:https";
import tls from "node:tls";

import { parse, type HTMLElement } from "node-html-parser";

import type { JobSourceAdapter, RequestContext } from "./adapter";
import { jobSearchError } from "./errors";
import { REQUEST_TIMEOUT_MS } from "./http";
import { SECTIGO_DV_R36 } from "./kukwira-ca";
import type { FoundPosting, SearchPage, SearchQuery } from "./search";
import { KUKWIRA_URL } from "./sources";

// Kukwira: a Mozambican recruitment agency with a handful of openings at a
// time. Its site is an AngularJS app with no API and no robots.txt; the
// openings are one HTML fragment (/partials/oportunidades.php) and each
// one's text another (/endpoints/info_endpoint.php?process_id=<id>). There's
// no search, so keywords are matched here, and nothing says where a job is.
// Its server leaves out an intermediate certificate, so requests add it
// (src/lib/job-search/kukwira-ca.ts) and are checked as usual.

const SOURCE = "KUKWIRA";
const MAX_BYTES = 2 * 1024 * 1024;
const CA = [...tls.rootCertificates, SECTIGO_DV_R36];

/** A connection that failed before any answer, as Kukwira's server sometimes resets one. */
class ConnectionFailed extends Error {}

const RETRY_DELAY_MS = 500;
const unwrap = (error: unknown) => (error instanceof ConnectionFailed ? (error.cause as Error) : error);

/**
 * GETs a page from Kukwira, turning every failure into a JobSearchError. Its
 * server now and then resets a connection, so one that fails before any
 * answer is tried once more.
 */
async function requestText(url: URL, signal?: AbortSignal): Promise<string> {
  try {
    return await requestOnce(url, signal);
  } catch (error) {
    if (!(error instanceof ConnectionFailed) || signal?.aborted) throw unwrap(error);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return requestOnce(url, signal).catch((again) => Promise.reject(unwrap(again)));
  }
}

async function requestOnce(url: URL, signal?: AbortSignal): Promise<string> {
  const detail = (reason: string) => ({ detail: `${url.pathname}: ${reason}` });
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const outgoing = client.get(url, { ...(url.protocol === "https:" ? { ca: CA } : {}), timeout: REQUEST_TIMEOUT_MS, signal }, (incoming) => {
      const status = incoming.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        incoming.resume();
        reject(jobSearchError(status >= 500 ? "unavailable" : "changed", SOURCE, detail(`HTTP ${status}`)));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          outgoing.destroy();
          reject(jobSearchError("changed", SOURCE, detail(`answer over ${MAX_BYTES} bytes`)));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      incoming.on("error", (error) => reject(jobSearchError("unavailable", SOURCE, detail(error.message))));
    });
    outgoing.on("timeout", () => outgoing.destroy(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })));
    outgoing.on("error", (error: Error & { code?: string }) => {
      const failure = jobSearchError("unavailable", SOURCE, detail(error.code ?? error.message));
      // Waiting as long again for a server that didn't answer in time helps no one.
      reject(error.code === "ETIMEDOUT" ? failure : new ConnectionFailed("no answer", { cause: failure }));
    });
  });
}

const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/** "• one;\n• two" as Dossier writes lists: one "- " line each. */
function bullets(value: string): string {
  return value
    .split(/\n|(?=•)/)
    .map((line) => line.replace(/^\s*•\s*/, "- ").replace(/[ \t]+/g, " ").trim())
    .filter((line) => line && line !== "-")
    .join("\n");
}

/** A paragraph's label ("Descrição:") and text, the label in bold. */
function labelled(paragraph: HTMLElement): { label: string; text: string } {
  const bold = paragraph.querySelector(".text_bold");
  const label = tidy(bold?.text ?? "").replace(/[-:\s]+$/, "");
  bold?.remove();
  return { label, text: bullets(paragraph.text) };
}

/** Words without accents or case, to match keywords the way people type them. */
function plain(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Whether every keyword is in the posting's title or text. */
export function matches(posting: Pick<FoundPosting, "title" | "description">, keywords: string): boolean {
  const haystack = plain(`${posting.title} ${posting.description}`);
  return plain(keywords)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const postingUrl = (id: string, baseUrl: string) => `${baseUrl}/#/info#${id}`;
const applyUrl = (id: string, baseUrl: string) => `${baseUrl}/#/candidatura#${id}`;

/** The openings in the list fragment, with the start of each one's text. */
export function parseOpenings(html: string, baseUrl = KUKWIRA_URL): FoundPosting[] {
  const base = baseUrl.replace(/\/+$/, "");
  const postings: FoundPosting[] = [];
  const seen = new Set<string>();
  for (const card of parse(html).querySelectorAll(".bg-orange-light")) {
    const id = /#\/info#(\d+)/.exec(card.querySelector('a[href*="#/info#"]')?.getAttribute("href") ?? "")?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const heading = card.querySelector("h5");
    heading?.querySelector(".text_bold")?.remove();
    const parts = card.querySelectorAll("p").map(labelled).filter((part) => part.text);
    postings.push({
      source: SOURCE,
      externalId: id,
      title: tidy(heading?.text ?? "").slice(0, 500),
      company: "Kukwira",
      place: "",
      remote: null,
      salary: "",
      postedAt: null,
      url: postingUrl(id, base).slice(0, 2000),
      via: "",
      description: parts
        .map(({ label, text }) => (label ? `${label}\n${text}` : text))
        .join("\n\n")
        .slice(0, 100_000),
      complete: false,
    });
  }
  return postings;
}

/** An opening's whole text, from its info fragment, with where to apply. */
export function openingText(html: string, id: string, baseUrl = KUKWIRA_URL): string | null {
  const root = parse(html);
  const heading = root.querySelector("h5:not(.section-title)") ?? root.querySelector("h5");
  heading?.querySelector(".text_bold")?.remove();
  const title = tidy(heading?.text ?? "");
  const parts = root
    .querySelectorAll("p")
    .map(labelled)
    .filter((part) => part.text)
    .map(({ label, text }) => (label ? `${label}\n${text}` : text));
  if (!title && parts.length === 0) return null;
  return [title, ...parts, `Candidatura: ${applyUrl(id, baseUrl.replace(/\/+$/, ""))}`].filter(Boolean).join("\n\n");
}

async function searchPage(query: SearchQuery, _credentials: Record<string, never>, _next: string | null, context: RequestContext = {}): Promise<SearchPage> {
  const base = (context.baseUrl ?? KUKWIRA_URL).replace(/\/+$/, "");
  const html = await requestText(new URL(`${base}/partials/oportunidades.php`), context.signal);
  // A handful of openings, all on one page.
  return { postings: parseOpenings(html, base).filter((posting) => matches(posting, query.keywords)), next: null };
}

export const kukwira: JobSourceAdapter<"KUKWIRA"> = {
  source: SOURCE,
  search: searchPage,
  details: async (posting, _credentials, context = {}) => {
    if (!/^\d+$/.test(posting.externalId)) return null;
    const base = (context.baseUrl ?? KUKWIRA_URL).replace(/\/+$/, "");
    const url = new URL(`${base}/endpoints/info_endpoint.php`);
    url.searchParams.set("process_id", posting.externalId);
    try {
      return openingText(await requestText(url, context.signal), posting.externalId, base);
    } catch {
      return null;
    }
  },
  test: async (_credentials, context) => {
    await searchPage({ keywords: "", place: "", country: "mz", radiusKm: 25, remoteOnly: false, postedWithin: "any" }, {}, null, context);
  },
};
