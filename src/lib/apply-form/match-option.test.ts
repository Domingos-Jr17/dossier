import { describe, expect, it } from "vitest";

import { bestOption } from "./match-option";

const jobs = [
  { value: "", text: "Cargo" },
  { value: "1", text: "Engenheiro/a de construção civil" },
  { value: "2", text: "Contabilista" },
  { value: "3", text: "Gestor/a financeiro" },
  { value: "4", text: "Técnico de contabilidade" },
];

describe("bestOption", () => {
  it("takes an exact match, ignoring case and accents", () => {
    expect(bestOption(jobs, "CONTABILISTA")?.value).toBe("2");
  });

  it("takes the closest by shared words, without seniority", () => {
    expect(bestOption(jobs, "Contabilista Sénior")?.value).toBe("2");
    expect(bestOption(jobs, "Engenheiro Civil")?.value).toBe("1");
    expect(bestOption(jobs, "Gestora Financeira de Banca")?.value).toBe("3");
  });

  it("says nothing when none is close, and never picks the placeholder", () => {
    expect(bestOption(jobs, "Astronauta")).toBeNull();
    expect(bestOption(jobs, "Cargo")).toBeNull();
    expect(bestOption(jobs, "")).toBeNull();
  });
});
