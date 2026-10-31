import { describe, expect, it } from "vitest";

import { pattern, translateText, type Dictionary } from "./translate";

const dictionary: Dictionary = {
  exact: { "Find jobs": "Procurar vagas", Interview: "Entrevista", "Same in both": "Same in both" },
  patterns: [pattern("{count} postings from {source}", "$1 vagas de $2"), pattern("Status: {status}", "Estado: $1")],
};

describe("translateText", () => {
  it("translates a whole text, keeping its surrounding whitespace", () => {
    expect(translateText("Find jobs", dictionary)).toBe("Procurar vagas");
    expect(translateText("  Find\n jobs ", dictionary)).toBe("  Procurar vagas ");
  });

  it("fills in a pattern's parts, translating those the dictionary knows", () => {
    expect(translateText("13 postings from emprego.co.mz", dictionary)).toBe("13 vagas de emprego.co.mz");
    expect(translateText("Status: Interview", dictionary)).toBe("Estado: Entrevista");
  });

  it("leaves what it doesn't know, numbers alone and texts that read the same", () => {
    expect(translateText("Marta Sitoe", dictionary)).toBeNull();
    expect(translateText(" 42 ", dictionary)).toBeNull();
    expect(translateText("Same in both", dictionary)).toBeNull();
    expect(translateText("", dictionary)).toBeNull();
  });

  it("escapes what a template says literally", () => {
    const [regex] = pattern("Score (beta): {n}?", "x");
    expect(regex.test("Score (beta): 91?")).toBe(true);
    expect(regex.test("Score beta: 91")).toBe(false);
  });
});
