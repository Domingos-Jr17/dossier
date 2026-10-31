import "server-only";

import type { MultiPart, RequestContext, SourceCredentials } from "./adapter";
import { JobSearchError, jobSearchError } from "./errors";
import type { FoundPosting, JobSource, SearchPage, SearchQuery } from "./search";
import { SOURCE_INFO, sourceCovers } from "./sources";

// "Several sources": one search asked of every chosen source at once, their
// postings interleaved. Each posting keeps its own source, so its whole text,
// saving, scoring and its source's attribution go through that source as
// before. A source that fails leaves the others' postings; only when every
// one fails does the search fail. The next page asks each source for its own
// next page, with the cursors kept together in one.

const CURSORS = "multi:";

/** Each source's cursor for the next page; null once it has no more. */
type Cursors = Partial<Record<JobSource, string | null>>;

function cursorsFrom(next: string | null): Cursors | null {
  if (!next?.startsWith(CURSORS)) return null;
  try {
    const parsed = JSON.parse(next.slice(CURSORS.length)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Cursors) : null;
  } catch {
    return null;
  }
}

/** The parts that can answer this search: in its country, and with keywords unless they list by place. */
export function partsFor(parts: readonly MultiPart[], query: SearchQuery): MultiPart[] {
  return parts.filter((part) => sourceCovers(part.source, query.country) && (query.keywords.trim() !== "" || SOURCE_INFO[part.source].browses));
}

const comparable = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** One posting found by two sources (a job board's posting that Google for Jobs also lists) is shown once. */
function sameJob(a: FoundPosting, b: FoundPosting): boolean {
  if (a.url && a.url === b.url) return true;
  return Boolean(a.company && b.company) && comparable(a.title) === comparable(b.title) && comparable(a.company) === comparable(b.company);
}

/** The pages' postings taken in turn, one from each source, so none crowds out the rest. */
export function interleave(pages: readonly FoundPosting[][]): FoundPosting[] {
  const merged: FoundPosting[] = [];
  const longest = Math.max(0, ...pages.map((page) => page.length));
  for (let index = 0; index < longest; index++) {
    for (const page of pages) {
      const posting = page[index];
      if (posting && !merged.some((kept) => sameJob(kept, posting))) merged.push(posting);
    }
  }
  return merged;
}

/** How one source is asked: index.ts passes its own search, with its cache and checks. */
export type AskSource = <S extends JobSource>(source: S, credentials: SourceCredentials[S], query: SearchQuery, next: string | null, context: RequestContext) => Promise<SearchPage>;
/** How one source is tested: index.ts passes its own. */
export type TestSource = <S extends JobSource>(source: S, credentials: SourceCredentials[S], context: RequestContext) => Promise<void>;

const asking = (ask: AskSource, part: MultiPart, query: SearchQuery, next: string | null) => ask(part.source, part.credentials as never, query, next, part.context);

/** One page of "Several sources": each part asked through `ask`. */
export async function searchSeveral(query: SearchQuery, { parts }: { parts: MultiPart[] }, next: string | null, ask: AskSource): Promise<SearchPage> {
  const eligible = partsFor(parts, query);
  if (eligible.length === 0) {
    if (query.country && !parts.some((part) => sourceCovers(part.source, query.country))) throw jobSearchError("country", "MULTI", { country: query.country });
    throw new JobSearchError("no-key", "None of your sources searches without keywords. Type what you're looking for.");
  }
  const cursors = cursorsFrom(next);
  // The first page asks every source; later ones only those with more to give.
  const asked = cursors ? eligible.filter((part) => typeof cursors[part.source] === "string") : eligible;
  const answers = await Promise.allSettled(asked.map((part) => asking(ask, part, query, cursors ? cursors[part.source]! : null)));

  const failures = answers.flatMap((answer) => (answer.status === "rejected" ? [answer.reason] : []));
  if (failures.length === answers.length && failures.length > 0) throw failures[0];

  const following: Cursors = { ...(cursors ?? {}) };
  const pages: FoundPosting[][] = [];
  answers.forEach((answer, index) => {
    const { source } = asked[index];
    if (answer.status === "fulfilled") {
      pages.push(answer.value.postings);
      following[source] = answer.value.next;
    } else {
      // A source that failed isn't asked again for this search.
      following[source] = null;
    }
  });
  const more = Object.values(following).some((cursor) => typeof cursor === "string");
  return { postings: interleave(pages), next: more ? `${CURSORS}${JSON.stringify(following)}` : null };
}

/** "Test connection" for Several sources: each part in turn, naming the one that fails. */
export async function testSeveral({ parts }: { parts: MultiPart[] }, test: TestSource): Promise<void> {
  for (const part of parts) {
    try {
      await test(part.source, part.credentials as never, part.context);
    } catch (error) {
      if (error instanceof JobSearchError) throw new JobSearchError(error.problem, `${SOURCE_INFO[part.source].name}: ${error.message}`, error.detail);
      throw error;
    }
  }
}
