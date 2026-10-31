import { afterEach, describe, expect, it, vi } from "vitest";

import { contactOffer, contactOffers } from "@/test/mozambique-job-fixtures";

import { CONTACT_NOTE, contactMz, offerText, parseOffers, placeOf, publishedAt } from "./contact-mz";
import { EMPTY_QUERY } from "./search";

const fetchHtml = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posting-fetch", async (original) => ({ ...(await original<typeof import("@/lib/posting-fetch")>()), fetchHtml }));

const query = { ...EMPTY_QUERY, country: "mz" };
const page = (html: string) => ({ ok: true, html, url: "https://www.contact.co.mz/pt/recrutamento/ofertas-de-emprego" });

afterEach(() => {
  fetchHtml.mockReset();
  vi.useRealTimers();
});

describe("CONTACT's pages", () => {
  it("reads every opening on the list, leaving out the standing spontaneous application", () => {
    const offers = parseOffers(contactOffers);
    expect(offers.map((offer) => offer.externalId)).toEqual(["AF848DEAAB", "16D58BF49F", "03774AA9ED"]);
    expect(offers[0]).toEqual({
      source: "CONTACT_MZ",
      externalId: "AF848DEAAB",
      title: "Medidor orçamentista (m/f) - 1 vaga",
      company: "",
      place: "Pemba, Cabo Delgado",
      remote: null,
      salary: "",
      postedAt: "2026-10-29T04:53:00.000Z",
      url: "https://www.contact.co.mz/pt/recrutamento/oferta-de-emprego/AF848DEAAB/medidor-orcamentista-m-f-1-vaga",
      via: "CONTACT",
      description: CONTACT_NOTE,
      complete: false,
    });
  });

  it("reads places and dates the way the site writes them", () => {
    expect(placeOf(" Mocuba, Zambézia Province, Mozambique ")).toBe("Mocuba, Zambézia");
    expect(placeOf("Maputo, Maputo City, Moçambique")).toBe("Maputo, Maputo City");
    expect(publishedAt("26-10-2026 às 10:08")).toBe("2026-10-26T08:08:00.000Z");
    expect(publishedAt("ontem")).toBeNull();
  });

  it("reads an opening's own page, with where to apply", () => {
    expect(offerText(contactOffer)).toBe(
      [
        "Medidor orçamentista (m/f) - 1 vaga · Pemba, Cabo Delgado",
        CONTACT_NOTE,
        "Descrição\nO nosso Cliente é uma prestigiada empresa que actua no sector de construção Civil e gestão de instalações.\nRequisitos\n- Licenciatura em Engenharia Civil ou área relacionada;\n- Experiência com software Candy, é obrigatório;\nDATA LIMITE DE CANDIDATURA: 01 de Novembro de 2026.",
        "Candidatura: https://contact.workable.com/jobs/6233374/candidates/new",
      ].join("\n\n"),
    );
  });
});

describe("CONTACT adapter", () => {
  it("matches keywords in the titles and places, and puts the place's openings first", async () => {
    fetchHtml.mockResolvedValue(page(contactOffers));
    const calls = await contactMz.search({ ...query, keywords: "Digitador" }, {}, null);
    expect(fetchHtml).toHaveBeenLastCalledWith("https://www.contact.co.mz/pt/recrutamento/ofertas-de-emprego", {});
    expect(calls).toEqual({ postings: [expect.objectContaining({ externalId: "03774AA9ED" })], next: null });
    const byPlace = await contactMz.search({ ...query, place: "Matola" }, {}, null);
    expect(byPlace.postings.map((offer) => offer.externalId)).toEqual(["16D58BF49F", "AF848DEAAB", "03774AA9ED"]);
    const zambezia = await contactMz.search({ ...query, keywords: "zambezia" }, {}, null);
    expect(zambezia.postings.map((offer) => offer.externalId)).toEqual(["03774AA9ED"]);
  });

  it("keeps to the openings published within the time asked", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-30T12:00:00Z"), toFake: ["Date"] });
    fetchHtml.mockResolvedValue(page(contactOffers));
    const week = await contactMz.search({ ...query, postedWithin: "week" }, {}, null);
    expect(week.postings.map((offer) => offer.externalId)).toEqual(["AF848DEAAB", "16D58BF49F"]);
  });

  it("reads an opening's text for its details, reaches the tests' fake source, and says when the site is down", async () => {
    fetchHtml.mockResolvedValue(page(contactOffer));
    const [offer] = parseOffers(contactOffers);
    await expect(contactMz.details(offer, {})).resolves.toMatch(/^Medidor orçamentista/);
    fetchHtml.mockResolvedValue(page(contactOffers));
    await contactMz.test({}, { baseUrl: "http://localhost:3998/contact_mz" });
    expect(fetchHtml).toHaveBeenLastCalledWith("http://localhost:3998/contact_mz/pt/recrutamento/ofertas-de-emprego", { lookup: expect.any(Function) });
    fetchHtml.mockResolvedValue({ ok: false, error: "The job site couldn't be reached." });
    await expect(contactMz.search(query, {}, null)).rejects.toMatchObject({ problem: "unavailable" });
  });
});
