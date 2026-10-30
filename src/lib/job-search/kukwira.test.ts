import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { kukwiraInfo, kukwiraOpenings } from "@/test/mozambique-job-fixtures";

import { AGENCY_NOTE, kukwira, matches, openingText, parseOpenings } from "./kukwira";
import { EMPTY_QUERY } from "./search";

const query = { ...EMPTY_QUERY, country: "mz" };

describe("Kukwira's fragments", () => {
  it("reads each opening's card, with its labelled parts as lists", () => {
    const postings = parseOpenings(kukwiraOpenings);
    expect(postings.map((posting) => posting.externalId)).toEqual(["500", "501"]);
    expect(postings[0]).toEqual({
      source: "KUKWIRA",
      externalId: "500",
      title: "Chefe de Secção de Trade - Banca Transaccional",
      company: "",
      place: "",
      remote: null,
      salary: "",
      postedAt: null,
      url: "https://www.kukwira.co.mz/#/info#500",
      via: "Kukwira",
      description: [
        AGENCY_NOTE,
        "Descrição\n- Desenvolver estratégias de produtos e vendas;\n- Identificar oportunidades de venda cruzada (cross-selling) e venda incrementa...",
        "Requisitos\n- Licenciatura em Gestão, Finanças, Economia ou áreas afins;\n- Mínimo de 5 anos de experiência na área de Banca...",
      ].join("\n\n"),
      complete: false,
    });
  });

  it("matches every keyword, without accents or case", () => {
    const [trade, maintenance] = parseOpenings(kukwiraOpenings);
    expect(matches(trade, "banca GESTAO")).toBe(true);
    expect(matches(trade, "banca geradores")).toBe(false);
    expect(matches(maintenance, "técnico")).toBe(true);
    expect(matches(maintenance, "")).toBe(true);
  });

  it("reads an opening's whole text and where to apply", () => {
    expect(openingText(kukwiraInfo, "500")).toBe(
      [
        "Chefe de Secção de Trade - Banca Transaccional",
        AGENCY_NOTE,
        "Descrição\n- Desenvolver estratégias de produtos e vendas;\n- Identificar oportunidades de venda cruzada (cross-selling) e venda incremental de produtos e serviços;",
        "Requisitos\n- Licenciatura em Gestão, Finanças, Economia ou áreas afins;\n- Fluência em Português e Inglês;",
        "Candidatura: https://www.kukwira.co.mz/#/candidatura#500",
      ].join("\n\n"),
    );
    expect(openingText("<div></div>", "500")).toBeNull();
  });
});

describe("Kukwira adapter", () => {
  const requests: string[] = [];
  let status = 200;
  /** How many of the next requests the server drops without answering, as Kukwira's sometimes does. */
  let resets = 0;
  let server: http.Server;
  let baseUrl = "";

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      requests.push(request.url ?? "");
      if (resets > 0) {
        resets -= 1;
        request.socket.destroy();
        return;
      }
      response.writeHead(status, { "content-type": "text/html; charset=UTF-8" });
      response.end(request.url?.startsWith("/endpoints/") ? kukwiraInfo : kukwiraOpenings);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("lists the openings that match, all on one page", async () => {
    const page = await kukwira.search({ ...query, keywords: "manutenção" }, {}, null, { baseUrl });
    expect(requests.at(-1)).toBe("/partials/oportunidades.php");
    expect(page).toEqual({ postings: [expect.objectContaining({ externalId: "501", url: `${baseUrl}/#/info#501` })], next: null });
  });

  it("asks for an opening's text by its id", async () => {
    const [posting] = parseOpenings(kukwiraOpenings, baseUrl);
    await expect(kukwira.details(posting, {}, { baseUrl })).resolves.toMatch(/^Chefe de Secção de Trade/);
    expect(requests.at(-1)).toBe("/endpoints/info_endpoint.php?process_id=500");
    await expect(kukwira.details({ ...posting, externalId: "500&x=1" }, {}, { baseUrl })).resolves.toBeNull();
  });

  it("tries once more when the server drops the connection, then gives up", async () => {
    resets = 1;
    const before = requests.length;
    await expect(kukwira.search(query, {}, null, { baseUrl })).resolves.toMatchObject({ postings: [expect.objectContaining({ externalId: "500" }), expect.anything()] });
    expect(requests.length - before).toBe(2);
    resets = 5;
    await expect(kukwira.search(query, {}, null, { baseUrl })).rejects.toMatchObject({ problem: "unavailable", detail: expect.stringContaining("ECONNRESET") });
    expect(requests.length - before).toBe(4);
    resets = 0;
  });

  it("says when the site is down, and tests with the list", async () => {
    await expect(kukwira.test({}, { baseUrl })).resolves.toBeUndefined();
    status = 503;
    await expect(kukwira.search(query, {}, null, { baseUrl })).rejects.toMatchObject({ problem: "unavailable" });
    status = 404;
    await expect(kukwira.search(query, {}, null, { baseUrl })).rejects.toMatchObject({ problem: "changed" });
    await expect(kukwira.details(parseOpenings(kukwiraOpenings)[0], {}, { baseUrl })).resolves.toBeNull();
    status = 200;
  });
});
