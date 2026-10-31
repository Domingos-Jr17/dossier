import { describe, expect, it } from "vitest";

import { applyOnSite } from "./apply-on-site";

describe("applyOnSite", () => {
  it("finds the link Dossier's Mozambican adapters write", () => {
    expect(applyOnSite("Agronomist\n\nDuties…\n\nCandidatura: https://bit.ly/agronomist-maputo", "https://www.emprego.co.mz/vaga/agronomist/")).toEqual({
      how: "link",
      url: "https://bit.ly/agronomist-maputo",
      site: "bit.ly",
    });
    expect(applyOnSite("Chefe de Secção de Trade\n\nCandidatura: https://www.kukwira.co.mz/#/candidatura#500", "")).toEqual({
      how: "link",
      url: "https://www.kukwira.co.mz/#/candidatura#500",
      site: "kukwira.co.mz",
    });
  });

  it("finds an application link the way postings write it", () => {
    expect(applyOnSite("Requirements\n- Figma\n\nApply here: https://jobs.example/apply/42.", "")).toMatchObject({ how: "link", url: "https://jobs.example/apply/42" });
    expect(applyOnSite("Candidaturas através de https://recrutamento.example.co.mz/vaga/7 até 30 de Novembro", "")).toMatchObject({
      url: "https://recrutamento.example.co.mz/vaga/7",
      site: "recrutamento.example.co.mz",
    });
  });

  it("sends emprego.co.mz's own applications to the posting's page there", () => {
    expect(applyOnSite("Chef de Cozinha\n\nCandidatura: com uma conta no emprego.co.mz.", "https://www.emprego.co.mz/vaga/chef-de-cozinha-2/")).toEqual({
      how: "account",
      url: "https://www.emprego.co.mz/vaga/chef-de-cozinha-2/",
      site: "emprego.co.mz",
    });
    expect(applyOnSite("Candidatura: com uma conta no emprego.co.mz.", "")).toMatchObject({ url: "https://www.emprego.co.mz/" });
  });

  it("finds nothing in a posting applied for by email, or with only a company website", () => {
    expect(applyOnSite("Send your CV to jobs@example.com", "https://jobs.example/1")).toBeNull();
    expect(applyOnSite("About us: https://example.com, a logistics company.", "")).toBeNull();
  });
});
