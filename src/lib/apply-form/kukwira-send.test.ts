import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { LanguageLevel } from "@/generated/prisma/enums";
import { demoProfile } from "@/lib/demo-profile";

import { formFields } from "./fields";
import { kukwiraBody, loadKukwiraForm, parseSelects, postKukwira, resolveFields } from "./kukwira-send";
import { EMPTY_PERSONAL } from "./personal";

const FORM = `<form name="formCandidatura">
  <select name="gender"><option value="">Género</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select>
  <select name="occupation_id"><option value=""></option><option value="1">Engenheiro/a de construção civil</option><option value="7">Gestor/a de produto</option></select>
  <select name="old_occupation_id"><option value=""></option><option value="7">Gestor/a de produto</option><option value="9">Analista financeiro</option></select>
  <select name="course_id"><option value="">-</option><option value="30">Economia</option><option value="31">Gestão</option></select>
</form>`;

const profile = {
  ...demoProfile(),
  basics: { ...demoProfile().basics, name: "Marta Sitoe", email: "marta@example.com", phone: "+258 84 000 0000", dob: "1990-04-12", city: "Maputo", country: "Mozambique" },
  languages: [{ id: "l1", name: "Português", level: LanguageLevel.NATIVE }],
  education: [{ id: "e1", degree: "Licenciatura em Economia", school: "UEM", notes: "", startYear: 2008, startMonth: 2, endYear: 2012, endMonth: 12, current: false }],
  experience: [
    { id: "x1", role: "Gestora de Produtos", company: "Banco Exemplo", location: "", descriptor: "", bullets: "", skillIds: [], startYear: 2021, startMonth: 3, endYear: null, endMonth: null, current: true },
    { id: "x2", role: "Analista Financeiro Sénior", company: "Consultores Exemplo", location: "", descriptor: "", bullets: "", skillIds: [], startYear: 2017, startMonth: 1, endYear: 2021, endMonth: 2, current: false },
  ],
};
const personal = { ...EMPTY_PERSONAL, gender: "Feminino" as const, civilState: "Solteiro(a)" as const, birthPlace: "Cidade de Maputo", postalCode: "1100", nationality: "Moçambique" };

describe("resolveFields", () => {
  it("takes known codes, matches jobs and courses to Kukwira's own lists, and reports what's missing", () => {
    const lists = parseSelects(FORM);
    expect([...lists.keys()]).toEqual(["gender", "occupation_id", "old_occupation_id", "course_id"]);
    const { resolved, unresolved } = resolveFields(formFields("kukwira", { profile, personal, letter: "Carta" }), lists);
    const by = Object.fromEntries(resolved.map((entry) => [entry.field.id, entry]));
    expect(by.gender.submit).toBe("Feminino");
    expect(by.occupation_id).toMatchObject({ submit: "7", matched: "Gestor/a de produto" });
    expect(by.old_occupation_id).toMatchObject({ submit: "9", matched: "Analista financeiro" });
    expect(by.course_id.submit).toBe("30");
    expect(by.name.submit).toBe("Marta Sitoe");
    expect(unresolved).toEqual([]);
  });

  it("reports a required one the list doesn't have, or that the profile can't answer", () => {
    const lists = parseSelects(FORM.replace('<option value="Feminino">Feminino</option>', ""));
    const { unresolved } = resolveFields(formFields("kukwira", { profile, personal: { ...personal, civilState: "" }, letter: "Carta" }), lists);
    expect(unresolved.map((field) => field.id)).toEqual(expect.arrayContaining(["gender", "civil_state"]));
  });
});

describe("kukwiraBody", () => {
  it("is what Kukwira's page sends: fields, the CV as file-0, the form's name and the opening", () => {
    const { resolved } = resolveFields(formFields("kukwira", { profile, personal, letter: "Carta" }), parseSelects(FORM));
    const { body, contentType } = kukwiraBody(resolved, { fileName: 'Marta "Sitoe" – CV.pdf', data: Buffer.from("%PDF-1.4 fake") }, "AB12");
    const text = body.toString("utf8");
    expect(contentType).toMatch(/^multipart\/form-data; boundary=----dossier/);
    expect(text).toContain('name="name"\r\n\r\nMarta Sitoe\r\n');
    expect(text).toContain('name="languages[]"\r\n\r\n1\r\n');
    expect(text).toContain('name="nameForm"\r\n\r\ncandidatura');
    expect(text).toContain('name="process_id"\r\n\r\nAB12');
    expect(text).toContain('name="file-0"; filename="Marta Sitoe – CV.pdf"');
    expect(text).toContain("%PDF-1.4 fake");
    expect(text).not.toContain('name="check"');
  });
});

describe("Kukwira's form, posted", () => {
  let server: http.Server | undefined;
  afterEach(() => void server?.close());
  const start = async (answer: string) => {
    const seen: { path: string; type: string; size: number }[] = [];
    server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        seen.push({ path: request.url ?? "", type: request.headers["content-type"] ?? "", size: Buffer.concat(chunks).length });
        response.end(request.url?.includes("/partials/") ? FORM : answer);
      });
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    // Under a path, as the test servers are: its pages are not at the root.
    return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/kukwira`, seen };
  };

  it("reads the lists from the form and posts to /send/email.php, a '1' being sent", async () => {
    const { base, seen } = await start("1");
    expect((await loadKukwiraForm(base)).get("gender")).toHaveLength(3);
    const { body, contentType } = kukwiraBody([], { fileName: "cv.pdf", data: Buffer.from("x") }, null);
    expect(await postKukwira(body, contentType, base)).toEqual({ ok: true });
    expect(seen.map((entry) => entry.path)).toEqual(["/kukwira/partials/candidatura.php", "/kukwira/send/email.php"]);
    expect(seen[1].type).toMatch(/^multipart\/form-data/);
  });

  it("passes on what Kukwira says when it doesn't accept it", async () => {
    const { base } = await start("error_validation: email inválido");
    const { body, contentType } = kukwiraBody([], { fileName: "cv.pdf", data: Buffer.from("x") }, null);
    expect(await postKukwira(body, contentType, base)).toEqual({ ok: false, message: "email inválido" });
  });
});
