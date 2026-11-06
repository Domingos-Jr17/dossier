// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { LanguageLevel } from "@/generated/prisma/enums";
import { demoProfile } from "@/lib/demo-profile";

import { bookmarklet } from "./bookmarklet";
import { formFields, missingFields } from "./fields";
import { EMPTY_PERSONAL } from "./personal";

const profile = {
  ...demoProfile(),
  basics: { ...demoProfile().basics, name: "Marta Sitoe", email: "marta@example.com", phone: "+258 84 000 0000", dob: "1990-04-12", address: "Av. 24 de Julho 100", city: "Maputo", country: "Mozambique" },
  languages: [
    { id: "l1", name: "Português", level: LanguageLevel.NATIVE },
    { id: "l2", name: "Inglês", level: LanguageLevel.C1 },
    { id: "l3", name: "Changana", level: LanguageLevel.B2 },
  ],
  education: [{ id: "e1", degree: "Licenciatura em Economia", school: "UEM", notes: "", startYear: 2008, startMonth: 2, endYear: 2012, endMonth: 12, current: false }],
  experience: [
    { id: "x1", role: "Gestora de Produtos", company: "Banco Exemplo", location: "", descriptor: "", volunteering: false, bullets: "", skillIds: [], startYear: 2021, startMonth: 3, endYear: null, endMonth: null, current: true },
    { id: "x2", role: "Analista Sénior", company: "Consultores Exemplo", location: "", descriptor: "", volunteering: false, bullets: "", skillIds: [], startYear: 2017, startMonth: 1, endYear: 2021, endMonth: 2, current: false },
  ],
};
const personal = { ...EMPTY_PERSONAL, gender: "Feminino" as const, civilState: "Solteiro(a)" as const, birthPlace: "Cidade de Maputo", postalCode: "1100", nationality: "Moçambique" };
const byId = (fields: ReturnType<typeof formFields>) => Object.fromEntries(fields.map((field) => [field.id, field]));

describe("formFields", () => {
  it("fills Kukwira's form from the profile: contacts, lists by their codes, jobs newest first", () => {
    const f = byId(formFields("kukwira", { profile, personal, letter: "Exmos. Senhores, ..." }));
    expect(f.name.value).toBe("Marta Sitoe");
    expect(f.mobile.value).toBe("+258 84 000 0000");
    expect(f.gender).toMatchObject({ value: "Feminino", code: "Feminino" });
    expect(f.birthdate.value).toBe("1990-04-12");
    expect(f.birth_place.code).toBe("11");
    expect(f.civil_state.code).toBe("2");
    expect(f.city.code).toBe("11");
    expect(f.country_id.code).toBe("mz");
    expect(f.citizenship.code).toBe("mz");
    expect(f.academicgrade).toMatchObject({ value: "Licenciatura", code: "3" });
    expect(f["language-1"]).toMatchObject({ code: "1", index: 0 });
    expect(f["level-2"].code).toBe("4");
    expect(f.language_4.value).toBe("Changana");
    expect(f.companyname.value).toBe("Banco Exemplo");
    expect(f.date_start.value).toBe("2021-03-01");
    expect(f.date_end.value).toBe("");
    expect(f.companyname2.value).toBe("Consultores Exemplo");
    expect(f.old_occupation_start_date.value).toBe("2017-01-01");
    expect(f.old_occupation_end_date.value).toBe("2021-02-01");
    expect(f.observations.value).toBe("Exmos. Senhores, ...");
  });

  it("lists what a person must still give", () => {
    const missing = missingFields(formFields("kukwira", { profile, personal: EMPTY_PERSONAL, letter: "x" })).map((field) => field.id);
    expect(missing).toEqual(expect.arrayContaining(["gender", "birth_place", "civil_state", "postalcode"]));
    expect(missing).not.toContain("name");
  });

  it("splits the name for a generic form", () => {
    const f = byId(formFields("workable", { profile, personal, letter: "Carta" }));
    expect(f.firstname.value).toBe("Marta");
    expect(f.lastname.value).toBe("Sitoe");
    expect(f.cover_letter.value).toBe("Carta");
  });
});

describe("bookmarklet", () => {
  function run(html: string, fields: ReturnType<typeof formFields>) {
    document.body.innerHTML = html;
    const alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    const code = decodeURIComponent(bookmarklet(fields).slice("javascript:".length));
    new Function(code)();
    vi.unstubAllGlobals();
    return alertSpy.mock.calls[0][0] as string;
  }
  const value = (selector: string) => (document.querySelector(selector) as HTMLInputElement).value;

  it("fills a Kukwira-style form by name, lists by code or words, and repeated names by position", () => {
    const message = run(
      `<form>
        <input name="name"><input name="email"><input name="mobile">
        <select name="gender"><option value="">Género</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select>
        <select name="birth_place"><option value="">-</option><option value="10">MAPUTO</option><option value="11">CIDADE DE MAPUTO</option></select>
        <select name="occupation_id"><option value="">-</option><option value="7">Gestor/a de produto</option><option value="8">Contabilista</option></select>
        <select name="languages[]"><option value="">-</option><option value="1">Português</option><option value="2">Inglês</option></select>
        <select name="languages[]"><option value="">-</option><option value="1">Português</option><option value="2">Inglês</option></select>
        <input type="file" name="file"><input type="checkbox" name="check">
      </form>`,
      formFields("kukwira", { profile, personal, letter: "x" }),
    );
    expect(value('[name="name"]')).toBe("Marta Sitoe");
    expect(value('[name="gender"]')).toBe("Feminino");
    expect(value('[name="birth_place"]')).toBe("11");
    expect(value('[name="occupation_id"]')).toBe("7");
    expect((document.querySelectorAll('[name="languages[]"]')[1] as HTMLSelectElement).value).toBe("2");
    expect((document.querySelector('[name="check"]') as HTMLInputElement).checked).toBe(false);
    expect(message).toMatch(/campos preenchidos/);
    expect(message).toMatch(/Anexe o currículo/);
  });

  it("finds a generic form's fields by their labels", () => {
    run(`<label>First name <input id="a"></label><label>Last name <input id="b"></label><label for="c">Email</label><input id="c"><textarea aria-label="Cover letter"></textarea>`, formFields("workable", { profile, personal, letter: "Carta" }));
    expect(value("#a")).toBe("Marta");
    expect(value("#b")).toBe("Sitoe");
    expect(value("#c")).toBe("marta@example.com");
    expect(value("textarea")).toBe("Carta");
  });

  it("says what it couldn't fill, never touching a list it can't match", () => {
    const message = run(`<select name="occupation_id"><option value="">-</option><option value="1">Astronauta</option></select>`, formFields("kukwira", { profile, personal, letter: "x" }));
    expect(value("select")).toBe("");
    expect(message).toMatch(/Por preencher ou escolher: .*Cargo 1/);
  });
});
