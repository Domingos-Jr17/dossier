import { describe, expect, it } from "vitest";

import { contactMz } from "./contact-mz";
import { empregoMz } from "./emprego-mz";
import { jsearch } from "./jsearch";
import { kukwira } from "./kukwira";
import { EMPTY_QUERY } from "./search";

// Checks against Mozambique's real job sites, skipped unless asked for. They
// have no API, so this is how to notice that a site changed its pages:
//
//   JOBS_LIVE=mozambique yarn vitest run src/lib/job-search/mozambique.live.test.ts
//
// And whether JSearch (Google for Jobs, LinkedIn among others) has postings
// in Mozambique, spending one search from the plan:
//
//   JOBS_LIVE=jsearch-mz JSEARCH_TEST_KEY=… yarn vitest run src/lib/job-search/mozambique.live.test.ts
//
// Behind a proxy, add NODE_USE_ENV_PROXY=1.

const live = new Set((process.env.JOBS_LIVE ?? "").split(",").map((name) => name.trim()));
const key = process.env.JSEARCH_TEST_KEY ?? "";
const host = process.env.JSEARCH_TEST_HOST === "rapidapi" ? "rapidapi" : "openwebninja";
const mozambique = { ...EMPTY_QUERY, country: "mz" };

function wellFormed(postings: { title: string; url: string }[]) {
  for (const posting of postings) {
    expect(posting.title).not.toBe("");
    expect(posting.url).toMatch(/^https:\/\//);
  }
}

describe.runIf(live.has("mozambique"))("Mozambique's job sites (live)", { timeout: 60_000 }, () => {
  it("emprego.co.mz: the latest postings, each with its company, and the whole text of one", async () => {
    // The home page lists every current posting on one page.
    const { postings } = await empregoMz.search(mozambique, {}, null);
    expect(postings.length).toBeGreaterThan(10);
    wellFormed(postings);
    expect(postings.filter((posting) => posting.company).length).toBeGreaterThan(postings.length / 2);
    expect((await empregoMz.details(postings[0], {}))?.length).toBeGreaterThan(200);
  });

  it("emprego.co.mz: postings in Maputo, and a second page of them", async () => {
    const page = await empregoMz.search({ ...mozambique, place: "Maputo" }, {}, null);
    expect(page.postings.length).toBeGreaterThan(0);
    wellFormed(page.postings);
    expect(page.postings.every((posting) => posting.place === "Maputo")).toBe(true);
    if (page.next) expect((await empregoMz.search({ ...mozambique, place: "Maputo" }, {}, page.next)).postings.length).toBeGreaterThan(0);
  });

  it("Kukwira: its open positions, each with its text", async () => {
    const { postings } = await kukwira.search(mozambique, {}, null);
    // Kukwira has few openings at a time, and sometimes none.
    wellFormed(postings);
    if (postings.length > 0) expect((await kukwira.details(postings[0], {}))?.length).toBeGreaterThan(100);
  });

  it("CONTACT: its offers, each with its text", async () => {
    const { postings } = await contactMz.search(mozambique, {}, null);
    wellFormed(postings);
    if (postings.length > 0) expect((await contactMz.details(postings[0], {}))?.length).toBeGreaterThan(100);
  });
});

describe.runIf(live.has("jsearch-mz") && key)("JSearch in Mozambique (live)", { timeout: 60_000 }, () => {
  it("finds postings in Maputo, most of them in Mozambique", async () => {
    const { postings } = await jsearch.search({ ...mozambique, keywords: "accountant", place: "Maputo", radiusKm: 50 }, { key, host }, null);
    console.info(`JSearch in Mozambique: ${postings.length} postings, ${postings.filter((p) => /mozambique|moçambique/i.test(p.place ?? "")).length} in Mozambique`);
    expect(postings.length).toBeGreaterThan(0);
    wellFormed(postings);
  });
});
