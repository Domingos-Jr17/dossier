import { afterEach, describe, expect, it, vi } from "vitest";

import { empregoMzPosting } from "@/test/mozambique-job-fixtures";

import { fetchPostingFromLink } from "./fetch-posting";

const fetchHtml = vi.hoisted(() => vi.fn());
const fetchPosting = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posting-fetch", async (original) => ({ ...(await original<typeof import("@/lib/posting-fetch")>()), fetchHtml, fetchPosting }));
const details = vi.hoisted(() => vi.fn());
vi.mock("./kukwira", () => ({ kukwira: { details } }));

afterEach(() => vi.clearAllMocks());

describe("Fetch for the sites with an adapter", () => {
  it("reads an emprego.co.mz posting's own text, not its one-line summary", async () => {
    fetchHtml.mockResolvedValue({ ok: true, html: empregoMzPosting, url: "https://www.emprego.co.mz/vaga/agronomist/" });
    const fetched = await fetchPostingFromLink("https://www.emprego.co.mz/vaga/agronomist/");
    expect(fetched).toEqual({ ok: true, source: "page", url: "https://www.emprego.co.mz/vaga/agronomist/", text: expect.stringMatching(/^Heading Moçambique: Agronomist\n\n[\s\S]*Duties/) });
    expect(fetchPosting).not.toHaveBeenCalled();
    fetchHtml.mockResolvedValue({ ok: false, error: "The job site couldn't be reached." });
    await expect(fetchPostingFromLink("https://emprego.co.mz/vaga/x/")).resolves.toEqual({ ok: false, error: "The job site couldn't be reached." });
  });

  it("reads a Kukwira link through the opening's own text", async () => {
    details.mockResolvedValue("Chefe de Secção de Trade\n\nCandidatura: https://www.kukwira.co.mz/#/candidatura#500");
    const fetched = await fetchPostingFromLink("https://www.kukwira.co.mz/#/candidatura#500");
    expect(details).toHaveBeenCalledWith(expect.objectContaining({ externalId: "500" }), {});
    expect(fetched).toEqual({ ok: true, source: "page", url: "https://www.kukwira.co.mz/#/info#500", text: expect.stringContaining("Chefe de Secção de Trade") });
    details.mockResolvedValue(null);
    await expect(fetchPostingFromLink("https://www.kukwira.co.mz/#/info#500")).resolves.toMatchObject({ ok: false });
  });

  it("reads every other link as before, Kukwira's other pages included", async () => {
    fetchPosting.mockResolvedValue({ ok: true, text: "A posting", source: "structured", url: "https://jobs.example/1" });
    await expect(fetchPostingFromLink("https://jobs.example/1")).resolves.toMatchObject({ text: "A posting" });
    await fetchPostingFromLink("https://www.kukwira.co.mz/#/oportunidades");
    expect(fetchPosting).toHaveBeenCalledTimes(2);
    expect(details).not.toHaveBeenCalled();
  });
});
