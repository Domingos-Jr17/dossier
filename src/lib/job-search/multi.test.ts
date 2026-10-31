import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MultiPart } from "./adapter";
import { JobSearchError, jobSearchError } from "./errors";
import { interleave, partsFor, searchSeveral, testSeveral, type AskSource, type TestSource } from "./multi";
import { EMPTY_QUERY, type FoundPosting, type JobSource, type SearchPage } from "./search";

const searchPostings = vi.fn();
const testSource = vi.fn();
const multi = {
  search: (query: typeof EMPTY_QUERY, credentials: { parts: MultiPart[] }, next: string | null) => searchSeveral(query, credentials, next, searchPostings as unknown as AskSource),
  test: (credentials: { parts: MultiPart[] }) => testSeveral(credentials, testSource as unknown as TestSource),
};

const posting = (source: JobSource, id: string, extra: Partial<FoundPosting> = {}): FoundPosting => ({
  source,
  externalId: id,
  title: `Job ${id}`,
  company: `Company ${id}`,
  place: "Maputo",
  remote: null,
  salary: "",
  postedAt: null,
  url: `https://jobs.example/${source}/${id}`,
  via: "",
  description: "",
  complete: false,
  ...extra,
});

const part = (source: Exclude<JobSource, "MULTI">): MultiPart => ({ source, credentials: (source === "JSEARCH" ? { key: "k", host: "openwebninja" } : {}) as never, context: {} }) as MultiPart;
const parts = [part("EMPREGO_MZ"), part("KUKWIRA"), part("JSEARCH")];
const query = { ...EMPTY_QUERY, keywords: "financeiro", country: "mz" };

const pages: Partial<Record<JobSource, Record<string, SearchPage | Error>>> = {};
beforeEach(() => {
  searchPostings.mockReset().mockImplementation(async (source: JobSource, _credentials: unknown, _query: unknown, next: string | null) => {
    const page = pages[source]?.[next ?? "first"];
    if (!page) throw new Error(`no page for ${source} ${next}`);
    if (page instanceof Error) throw page;
    return page;
  });
  testSource.mockReset();
  for (const key of Object.keys(pages)) delete pages[key as JobSource];
});

describe("Several sources", () => {
  it("asks every source for the first page, takes their postings in turn, and keeps each one's cursor", async () => {
    pages.EMPREGO_MZ = { first: { postings: [posting("EMPREGO_MZ", "e1"), posting("EMPREGO_MZ", "e2")], next: "https://www.emprego.co.mz/pesquisa/financeiro/page/2/" } };
    pages.KUKWIRA = { first: { postings: [posting("KUKWIRA", "500")], next: null } };
    pages.JSEARCH = { first: { postings: [posting("JSEARCH", "j1")], next: "PAGE-2" } };
    const page = await multi.search(query, { parts }, null);
    expect(page.postings.map((found: FoundPosting) => `${found.source}:${found.externalId}`)).toEqual(["EMPREGO_MZ:e1", "KUKWIRA:500", "JSEARCH:j1", "EMPREGO_MZ:e2"]);
    expect(JSON.parse(page.next!.slice("multi:".length))).toEqual({ EMPREGO_MZ: "https://www.emprego.co.mz/pesquisa/financeiro/page/2/", KUKWIRA: null, JSEARCH: "PAGE-2" });

    // The next page asks only the sources with more, each for its own next page.
    pages.EMPREGO_MZ["https://www.emprego.co.mz/pesquisa/financeiro/page/2/"] = { postings: [posting("EMPREGO_MZ", "e3")], next: null };
    pages.JSEARCH["PAGE-2"] = { postings: [posting("JSEARCH", "j2")], next: null };
    searchPostings.mockClear();
    const second = await multi.search(query, { parts }, page.next);
    expect(searchPostings.mock.calls.map(([source, , , next]) => [source, next])).toEqual([
      ["EMPREGO_MZ", "https://www.emprego.co.mz/pesquisa/financeiro/page/2/"],
      ["JSEARCH", "PAGE-2"],
    ]);
    expect(second).toEqual({ postings: [posting("EMPREGO_MZ", "e3"), posting("JSEARCH", "j2")], next: null });
  });

  it("keeps the others' postings when a source fails, and fails only when all do", async () => {
    pages.EMPREGO_MZ = { first: { postings: [posting("EMPREGO_MZ", "e1")], next: "more" } };
    pages.KUKWIRA = { first: jobSearchError("unavailable", "KUKWIRA") };
    pages.JSEARCH = { first: jobSearchError("quota", "JSEARCH") };
    const page = await multi.search(query, { parts }, null);
    expect(page.postings).toEqual([posting("EMPREGO_MZ", "e1")]);
    expect(JSON.parse(page.next!.slice("multi:".length))).toEqual({ EMPREGO_MZ: "more", KUKWIRA: null, JSEARCH: null });

    pages.EMPREGO_MZ.first = jobSearchError("unavailable", "EMPREGO_MZ");
    await expect(multi.search(query, { parts }, null)).rejects.toMatchObject({ problem: "unavailable", message: expect.stringContaining("emprego.co.mz") });
  });

  it("asks only the sources that cover the country, and that list by place when there are no keywords", () => {
    expect(partsFor([...parts, part("ADZUNA")], query).map((one) => one.source)).toEqual(["EMPREGO_MZ", "KUKWIRA", "JSEARCH"]);
    expect(partsFor(parts, { ...query, keywords: "" }).map((one) => one.source)).toEqual(["EMPREGO_MZ", "KUKWIRA"]);
    expect(partsFor(parts, { ...query, country: "pt" }).map((one) => one.source)).toEqual(["JSEARCH"]);
  });

  it("says what's wrong when no source can answer", async () => {
    await expect(multi.search({ ...query, keywords: "" }, { parts: [part("JSEARCH")] }, null)).rejects.toMatchObject({
      problem: "no-key",
      message: "None of your sources searches without keywords. Type what you're looking for.",
    });
    await expect(multi.search({ ...query, country: "pt" }, { parts: [part("EMPREGO_MZ"), part("KUKWIRA")] }, null)).rejects.toMatchObject({ problem: "country" });
    expect(searchPostings).not.toHaveBeenCalled();
  });

  it("shows a posting two sources found once", () => {
    const board = posting("EMPREGO_MZ", "e1", { title: "Director de Finanças", company: "WCS" });
    const google = posting("JSEARCH", "j1", { title: "Diretor de Finanças", company: "wcs" });
    const same = posting("JSEARCH", "j2", { title: "Director de Finanças!", company: "WCS" });
    expect(interleave([[board], [google, same]])).toEqual([board, google]);
  });

  it("tests each source, naming the one that fails", async () => {
    testSource.mockImplementation(async (source: JobSource) => {
      if (source === "JSEARCH") throw jobSearchError("key", "JSEARCH");
    });
    await expect(multi.test({ parts })).rejects.toThrow(/^JSearch: /);
    await expect(multi.test({ parts })).rejects.toBeInstanceOf(JobSearchError);
    expect(testSource.mock.calls.map(([source]) => source)).toEqual(["EMPREGO_MZ", "KUKWIRA", "JSEARCH", "EMPREGO_MZ", "KUKWIRA", "JSEARCH"]);
  });
});
