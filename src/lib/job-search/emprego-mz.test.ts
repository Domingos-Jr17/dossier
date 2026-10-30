import { afterEach, describe, expect, it, vi } from "vitest";

import { empregoMzCityPage, empregoMzFrontPage, empregoMzPosting, empregoMzSearchPage } from "@/test/mozambique-job-fixtures";

import { citySlug, empregoMz, firstPageUrl, parseListPage, postingText } from "./emprego-mz";
import { EMPTY_QUERY } from "./search";

const fetchHtml = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posting-fetch", async (original) => ({ ...(await original<typeof import("@/lib/posting-fetch")>()), fetchHtml }));

const query = { ...EMPTY_QUERY, country: "mz" };
const page = (html: string) => ({ ok: true, html, url: "https://www.emprego.co.mz/" });

afterEach(() => fetchHtml.mockReset());

describe("emprego.co.mz addresses", () => {
  it("names city pages the site's way", () => {
    expect(citySlug("Cabo Delgado")).toBe("cabo-delgado");
    expect(citySlug(" Zambézia ")).toBe("zambezia");
    expect(citySlug("")).toBe("");
  });

  it("searches keywords, else a place's city page, else the front page", () => {
    expect(firstPageUrl({ ...query, keywords: "gestão de projectos", place: "Beira" })).toBe("https://www.emprego.co.mz/pesquisa/gest%C3%A3o%20de%20projectos/");
    expect(firstPageUrl({ ...query, place: "Cabo Delgado" })).toBe("https://www.emprego.co.mz/cidade/cabo-delgado/");
    expect(firstPageUrl(query)).toBe("https://www.emprego.co.mz/");
    expect(firstPageUrl(query, "http://127.0.0.1:3998/emprego_mz/")).toBe("http://127.0.0.1:3998/emprego_mz/");
  });
});

describe("emprego.co.mz lists", () => {
  it("reads search rows with their closing date, and leaves expired ones out", () => {
    const { postings, next } = parseListPage(empregoMzSearchPage);
    expect(next).toBe("https://www.emprego.co.mz/pesquisa/gestao/page/2/");
    expect(postings).toEqual([
      {
        source: "EMPREGO_MZ",
        externalId: "chef-de-cozinha-2",
        title: "Chef de Cozinha",
        company: "PRI – Precision Recruitment International",
        place: "Maputo",
        remote: null,
        salary: "",
        postedAt: null,
        url: "https://www.emprego.co.mz/vaga/chef-de-cozinha-2/",
        via: "",
        description: "Recrutamento na PRI, para a vaga de Chef de Cozinha, em Maputo - Moçambique.\n\nPrazo: 23.11.2026",
        complete: false,
      },
      expect.objectContaining({ externalId: "contabilista-senior", place: "Nampula", company: "Banco Exemplo" }),
    ]);
  });

  it("puts the place's postings first when searching keywords", () => {
    const { postings } = parseListPage(empregoMzSearchPage, { place: "Nampula" });
    expect(postings.map((posting) => posting.place)).toEqual(["Nampula", "Maputo"]);
  });

  it("reads featured rows and the front page's grid", () => {
    expect(parseListPage(empregoMzCityPage, { city: "Maputo" }).postings.map(({ externalId, company, place }) => ({ externalId, company, place }))).toEqual([
      { externalId: "human-resources-assistant-support", company: "Embaixada dos Estados Unidos da América", place: "Maputo" },
      { externalId: "chef-de-cozinha-2", company: "PRI – Precision Recruitment International", place: "Maputo" },
    ]);
    const front = parseListPage(empregoMzFrontPage);
    expect(front.next).toBeNull();
    expect(front.postings).toEqual([
      expect.objectContaining({ externalId: "agronomist", title: "Agronomist", company: "Heading Moçambique", place: "Maputo", description: "Heading is hiring an Agronomist, in Maputo, Mozambique." }),
    ]);
  });

  it("stops at a page of nothing but expired postings", () => {
    const expiredOnly = empregoMzSearchPage.replace(/23\.11\.2026|01\.12\.2026/g, "Expirado");
    expect(parseListPage(expiredOnly)).toEqual({ postings: [], next: null });
  });
});

describe("emprego.co.mz postings", () => {
  it("reads the posting's own text and the employer's link to apply", () => {
    expect(postingText(empregoMzPosting)).toBe(
      [
        "Heading Moçambique: Agronomist",
        "Heading is recruiting an Agronomist, to be based in Maputo, Mozambique.\nDuties\n- Identify, select and test the seeds required for the vegetable oil production initiatives (bio feedstock)\n- Evaluate, identify and select the best cultivation systems and cycles for bio feedstock production",
        "Candidatura: https://bit.ly/agronomist-maputo",
      ].join("\n\n"),
    );
  });

  it("keeps a short posting's lines", () => {
    const short = empregoMzPosting.replace(/<ul>.*<\/ul><\/div><div><\/div>/, "</div><div></div>");
    expect(postingText(short)).toContain("Heading is recruiting an Agronomist, to be based in Maputo, Mozambique.\nDuties");
  });

  it("says to apply on emprego.co.mz when there's no other link", () => {
    const own = empregoMzPosting.replace("https://bit.ly/agronomist-maputo", "https://www.emprego.co.mz/candidato/vaga/?vacancy_id=1");
    expect(postingText(own)).toMatch(/Candidatura: com uma conta no emprego\.co\.mz\.$/);
  });
});

describe("emprego.co.mz adapter", () => {
  it("reaches localhost only for the end-to-end tests' fake source", async () => {
    fetchHtml.mockResolvedValue(page(empregoMzFrontPage));
    await empregoMz.search(query, {}, null, { baseUrl: "http://localhost:3998/emprego_mz" });
    expect(fetchHtml).toHaveBeenLastCalledWith("http://localhost:3998/emprego_mz/", { lookup: expect.any(Function) });
    await empregoMz.search(query, {}, null);
    expect(fetchHtml.mock.lastCall?.[1]).toEqual({});
  });

  it("asks the first page, then follows the site's own next link only", async () => {
    fetchHtml.mockResolvedValue(page(empregoMzSearchPage));
    const first = await empregoMz.search({ ...query, keywords: "gestão" }, {}, null);
    expect(fetchHtml).toHaveBeenLastCalledWith("https://www.emprego.co.mz/pesquisa/gest%C3%A3o/", {});
    await empregoMz.search({ ...query, keywords: "gestão" }, {}, first.next);
    expect(fetchHtml).toHaveBeenLastCalledWith("https://www.emprego.co.mz/pesquisa/gestao/page/2/", {});
    await empregoMz.search({ ...query, keywords: "gestão" }, {}, "https://elsewhere.example/page/2/");
    expect(fetchHtml).toHaveBeenLastCalledWith("https://www.emprego.co.mz/pesquisa/gest%C3%A3o/", {});
  });

  it("finds nothing for a city without a page, and reports the site being down", async () => {
    fetchHtml.mockResolvedValue({ ok: false, error: "Not found", status: 404 });
    await expect(empregoMz.search({ ...query, place: "Nowhere" }, {}, null)).resolves.toEqual({ postings: [], next: null });
    fetchHtml.mockResolvedValue({ ok: false, error: "The job site couldn't be reached." });
    await expect(empregoMz.search(query, {}, null)).rejects.toMatchObject({ problem: "unavailable" });
  });

  it("fetches a posting's text for its details, and tests with the front page", async () => {
    fetchHtml.mockResolvedValue(page(empregoMzPosting));
    const [posting] = parseListPage(empregoMzFrontPage).postings;
    await expect(empregoMz.details(posting, {})).resolves.toMatch(/^Heading Moçambique: Agronomist/);
    await expect(empregoMz.details({ ...posting, url: "" }, {})).resolves.toBeNull();
    fetchHtml.mockResolvedValue(page(empregoMzFrontPage));
    await expect(empregoMz.test({})).resolves.toBeUndefined();
    expect(fetchHtml).toHaveBeenLastCalledWith("https://www.emprego.co.mz/", {});
  });
});
