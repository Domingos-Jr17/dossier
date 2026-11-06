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
    expect(pt("Search emprego.co.mz, Kukwira and CONTACT for postings near you, then start an application from the one you like.")).toContain("emprego.co.mz, Kukwira e CONTACT");
    expect(pt("Mozambique and South Africa")).toBe("Moçambique e África do Sul");
    expect(pt("terms and conditions")).toBeNull();
    expect(pt("Copy Nome")).toBe("Copiar Nome");
    expect(pt("Send to Kukwira")).toBe("Enviar ao Kukwira");
    expect(pt("9 of 31")).toBe("9 de 31");
    expect(pt(" of ")).toBe(" de ");
    expect(pt("Worth being ready to talk about “SAP”, “IFRS” and “FMCG”, since they aren't in your profile")).toBe(
      "Convém estar preparado para falar de “SAP”, “IFRS” e “FMCG”, porque não estão no seu perfil",
    );
    expect(pt("2 roles in this field, since Feb 2015 (about 6 years)")).toBe("2 funções nesta área, desde fev. 2015 (cerca de 6 anos)");
    expect(pt("Rewrote your summary for the Gestor Financeiro role")).toBe("Reescrevi o seu resumo para a função de Gestor Financeiro");
  });

  it("turns the last 'and' of the tailoring summary's lists, and only there", () => {
    expect(pt("Reworded your Wira, Educore - ERP Escolar and Landing Pages projects for this job")).toBe(
      "Adaptei os projetos Wira, Educore - ERP Escolar e Landing Pages a esta vaga",
    );
    expect(pt("Reworded your Ingerop and Freelancer roles for this job")).toBe("Adaptei as funções em Ingerop e Freelancer a esta vaga");
    expect(pt("Left out ArchiCAD and Twinmotion, which this job isn't about")).toBe("Deixei de fora ArchiCAD e Twinmotion, que não são o foco desta vaga");
    // One project keeps its own name as it is, "and" included.
    expect(pt("Reworded your Landing and portfolio project for this job")).toBe("Adaptei o projeto Landing and portfolio a esta vaga");
    expect(pt("Finance and accounting")).toBeNull();
  });

  it("knows the texts that production showed in English", () => {
    expect(pt("Several sources")).toBe("Várias fontes");
    expect(pt("1 week ago")).toBe("há 1 semana");
    expect(pt("7 days")).toBe("7 dias");
    expect(pt("Dutch")).toBe("Neerlandês");
    expect(pt("The server didn't accept the API key. Check it in Settings → AI provider.")).toBe(
      "O servidor não aceitou a chave de API. Verifique-a em Definições → Fornecedor de IA.",
    );
    expect(pt("Your Mistral plan doesn't include “large”. Pick another model in Settings → AI provider.")).toBe(
      "O seu plano da Mistral não inclui o “large”. Escolha outro modelo em Definições → Fornecedor de IA.",
    );
  });
});
