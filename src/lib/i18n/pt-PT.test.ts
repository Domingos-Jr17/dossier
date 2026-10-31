import { describe, expect, it } from "vitest";

import { formatCalendarDate, formatDateTime, formatDay } from "@/lib/dates";

import { PT_PT } from "./pt-PT";
import { translateText } from "./translate";

const pt = (value: string) => translateText(value, PT_PT);

describe("PT_PT", () => {
  it("puts the screens' words in European Portuguese", () => {
    expect(pt("Find jobs")).toBe("Procurar vagas");
    expect(pt("Settings")).toBe("Definições");
    expect(pt("Mozambique")).toBe("Moçambique");
  });

  it("writes dates the Portuguese way", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    const saturday = new Date("2026-10-31T13:14:00Z");
    expect(pt(formatDay(saturday, "UTC", now))).toBe("sáb. 31 out.");
    expect(pt(formatDateTime(saturday, "UTC", now))).toBe("sáb. 31 out., 13:14");
    expect(pt(formatCalendarDate(new Date("2025-03-02T00:00:00Z")))).toBe("2 mar. 2025");
    expect(pt("Mar 2021 – Present")).toBe("mar. 2021 – Presente");
    expect(pt("2015 – 2016")).toBeNull();
    expect(pt("October 2026")).toBe("outubro de 2026");
    expect(pt("Monday 19 October")).toBe("segunda-feira, 19 de outubro");
  });

  it("translates the parts of a sentence it knows, dates included", () => {
    expect(pt("Rewrote the summary.")).toBe("Reescrevi o resumo.");
    expect(pt("Posted 3 days ago")).toBe("Publicada há 3 dias");
    expect(pt("No open postings right now.")).toBe("Nenhuma vaga aberta neste momento.");
    expect(pt("Good afternoon, Marta")).toBe("Boa tarde, Marta");
    expect(pt("3 applications: 3 waiting to hear back, 0 in conversation.")).toBe("3 candidaturas: 3 à espera de resposta, 0 em conversa.");
    expect(pt("financeiro · Mozambique · via Kukwira")).toBe("financeiro · Moçambique · via Kukwira");
    expect(pt("Rewrote your summary for the Gestor Financeiro role")).toBe("Reescrevi o seu resumo para a função de Gestor Financeiro");
  });
});
