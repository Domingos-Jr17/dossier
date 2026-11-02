import { LanguageLevel } from "@/generated/prisma/enums";
import { countryCodeFor } from "@/lib/job-search/countries";
import type { ExperienceItem, ProfileData } from "@/lib/profile";

import { PROVINCES, type ApplyPersonal } from "./personal";

// The values of an application form, from the profile: what a form on
// another site asks for, by the names that form uses. Nothing here sends
// anything; the assistant shows them, the bookmarklet types them into the
// page, and "Send" posts them after a confirmation.

export type FormTarget = "kukwira" | "workable";

export type FormField = {
  /** Unique within a form, e.g. "language-2". */
  id: string;
  /** The form's name for it: its `name` attribute, and others it might go by. */
  names: string[];
  /** Fragments of its visible label or placeholder, lowercase, for forms without stable names. */
  labels: string[];
  /** Which of several with the same name, from 0. */
  index?: number;
  /** As the person reads it. */
  label: string;
  kind: "text" | "select" | "date" | "textarea";
  /** As the person reads it: "Cidade de Maputo", "2021-03-01". */
  value: string;
  /** What a list submits, when the site's codes are known here. */
  code?: string;
  required: boolean;
  /** Left for the person: "Choose the closest job in the list". */
  note?: string;
};

export type FormContext = {
  profile: ProfileData;
  personal: ApplyPersonal;
  /** The cover letter's paragraphs, as one text. */
  letter: string;
};

const pad = (value: number) => String(value).padStart(2, "0");
const isoMonth = (year: number | null, month: number | null) => (year ? `${year}-${pad(month ?? 1)}-01` : "");
const folded = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Newest first, as forms ask: the current job, then the one before. */
function newestFirst(experience: readonly ExperienceItem[]): ExperienceItem[] {
  const start = (item: ExperienceItem) => (item.startYear ?? 0) * 12 + (item.startMonth ?? 0);
  return [...experience].sort((a, b) => Number(b.current) - Number(a.current) || start(b) - start(a));
}

const LEVELS: Record<LanguageLevel, { code: string; label: string }> = {
  [LanguageLevel.NATIVE]: { code: "1", label: "Nativo" },
  [LanguageLevel.C2]: { code: "2", label: "Fluente" },
  [LanguageLevel.C1]: { code: "4", label: "Muito Bom" },
  [LanguageLevel.B2]: { code: "3", label: "Bom" },
  [LanguageLevel.B1]: { code: "5", label: "Intermedio" },
  [LanguageLevel.A2]: { code: "6", label: "Basico" },
  [LanguageLevel.A1]: { code: "6", label: "Basico" },
};
/** Kukwira's own three languages; any other goes in its free-text fourth. */
const KUKWIRA_LANGUAGES: Record<string, { code: string; label: string }> = {
  portugues: { code: "1", label: "Português" },
  ingles: { code: "2", label: "Inglês" },
  english: { code: "2", label: "Inglês" },
  portuguese: { code: "1", label: "Português" },
  frances: { code: "3", label: "Francês" },
  french: { code: "3", label: "Francês" },
};

const GRADES: { pattern: RegExp; code: string; label: string }[] = [
  { pattern: /doutor|phd|ph\.d/, code: "1", label: "Doutoramento" },
  { pattern: /mestr|master|msc|m\.sc|mba|p[óo]s-?gradua/, code: "2", label: "Mestrado" },
  { pattern: /licenciat|bachelor|b\.?sc|b\.?com|honours/, code: "3", label: "Licenciatura" },
  { pattern: /bacharel/, code: "4", label: "Bacharelato" },
];

function province(place: string): { code: string; name: string } | null {
  const text = folded(place);
  if (!text) return null;
  const exact = PROVINCES.find((entry) => folded(entry.name) === text || folded(entry.name.replace(/ \(.*\)/, "")) === text);
  if (exact && exact.code !== "10") return exact;
  // "Maputo" alone is the capital; the province is asked for by name.
  if (/\bmaputo\b/.test(text) && /provincia/.test(text)) return PROVINCES[9];
  if (/\bmaputo\b/.test(text)) return PROVINCES[10];
  return PROVINCES.find((entry) => text.includes(folded(entry.name.replace(/ \(.*\)/, "")))) ?? null;
}

/** Everything Kukwira's application form (kukwira.co.mz/#/candidatura) asks, in its order. */
function kukwiraFields({ profile, personal, letter }: FormContext): FormField[] {
  const { basics } = profile;
  const fields: FormField[] = [];
  const text = (id: string, label: string, value: string, required: boolean, extra: Partial<FormField> = {}) =>
    fields.push({ id, names: [id], labels: [], label, kind: "text", value, required, ...extra });

  text("name", "Nome", basics.name, true);
  text("email", "Email", basics.email, true);
  text("phone", "Telemóvel principal", basics.phone, true);
  text("mobile", "Telemóvel alternativo", personal.mobile2 || basics.phone, true);
  text("gender", "Género", personal.gender, true, { kind: "select", code: personal.gender });
  text("birthdate", "Data de nascimento", basics.dob, true, { kind: "date" });
  const born = province(personal.birthPlace);
  text("birth_place", "Local de nascimento", born?.name ?? "", true, { kind: "select", ...(born ? { code: born.code } : {}) });
  const states = ["Casado(a)", "Solteiro(a)", "Divorciado(a)", "Viuvo(a)"];
  const civil = states.indexOf(personal.civilState);
  text("civil_state", "Estado civil", personal.civilState, true, { kind: "select", ...(civil >= 0 ? { code: String(civil + 1) } : {}) });
  text("address", "Morada", [basics.address, basics.city].filter(Boolean).join(", "), true, { kind: "textarea" });
  text("postalcode", "Código postal", personal.postalCode, true);
  const city = province(basics.city);
  text("city", "Cidade/Localidade", city?.name ?? basics.city, false, { kind: "select", ...(city ? { code: city.code } : {}) });
  const country = countryCodeFor(basics.country);
  text("country_id", "País", basics.country, false, { kind: "select", ...(country ? { code: country } : {}) });
  const citizen = countryCodeFor(personal.nationality);
  text("citizenship", "Nacionalidade", personal.nationality, false, { kind: "select", ...(citizen ? { code: citizen } : {}) });

  const school = profile.education[0];
  const degree = school ? GRADES.find((grade) => grade.pattern.test(folded(school.degree))) : undefined;
  text("academicgrade", "Grau académico", degree?.label ?? "", false, { kind: "select", ...(degree ? { code: degree.code } : {}) });
  text("course_id", "Curso", school?.degree ?? "", false, { kind: "select", note: "Escolha na lista o curso mais próximo." });
  text("date_from", "Início do curso", isoMonth(school?.startYear ?? null, school?.startMonth ?? null), false, { kind: "date" });
  text("date_to", "Fim do curso", school && !school.current ? isoMonth(school.endYear, school.endMonth) : "", false, { kind: "date" });

  // Up to three of Kukwira's own languages, a fourth as free text.
  const known = profile.languages.filter((entry) => KUKWIRA_LANGUAGES[folded(entry.name)]);
  const others = profile.languages.filter((entry) => !KUKWIRA_LANGUAGES[folded(entry.name)]);
  known.slice(0, 3).forEach((entry, index) => {
    const language = KUKWIRA_LANGUAGES[folded(entry.name)];
    fields.push({ id: `language-${index + 1}`, names: ["languages[]"], labels: [], index, label: `Idioma ${index + 1}`, kind: "select", value: language.label, code: language.code, required: index === 0 });
    fields.push({ id: `level-${index + 1}`, names: ["levels[]"], labels: [], index, label: `Nível ${index + 1}`, kind: "select", value: LEVELS[entry.level].label, code: LEVELS[entry.level].code, required: false });
  });
  const fourth = others[0];
  text("language_4", "Idioma 4", fourth?.name ?? "", false);
  text("language_4_level", "Nível 4", fourth ? LEVELS[fourth.level].label : "", false, { kind: "select", ...(fourth ? { code: LEVELS[fourth.level].code } : {}) });

  // Five jobs, the newest first; the first two are required.
  const jobs = newestFirst(profile.experience);
  const slots = [
    { company: "companyname", job: "occupation_id", from: "date_start", to: "date_end" },
    { company: "companyname2", job: "old_occupation_id", from: "old_occupation_start_date", to: "old_occupation_end_date" },
    { company: "companyname3", job: "occupation_id3", from: "occupation_start_date3", to: "occupation_end_date3" },
    { company: "companyname4", job: "occupation_id4", from: "occupation_start_date4", to: "occupation_end_date4" },
    { company: "companyname5", job: "occupation_id5", from: "occupation_start_date5", to: "occupation_end_date5" },
  ];
  slots.forEach((slot, index) => {
    const item = jobs[index];
    const n = index + 1;
    text(slot.company, `Empresa ${n}`, item?.company ?? "", index < 2);
    text(slot.job, `Cargo ${n}`, item?.role ?? "", index < 2, { kind: "select", note: "Escolha na lista o cargo mais próximo." });
    text(slot.from, `Início ${n}`, item ? isoMonth(item.startYear, item.startMonth) : "", index === 0, { kind: "date" });
    text(slot.to, `Fim ${n}`, item && !item.current ? isoMonth(item.endYear, item.endMonth) : "", false, { kind: "date" });
  });

  text("observations", "Mensagem", letter, true, { kind: "textarea" });
  return fields;
}

/** A generic application form (Workable, which CONTACT uses): what's usually asked, found by name or label. */
function genericFields({ profile, personal, letter }: FormContext): FormField[] {
  const { basics } = profile;
  const parts = basics.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : basics.name.trim();
  const make = (id: string, label: string, value: string, names: string[], labels: string[], required: boolean, kind: FormField["kind"] = "text"): FormField => ({ id, names, labels, label, kind, value, required });
  return [
    make("firstname", "Nome próprio", first, ["firstname", "first_name", "firstName"], ["first name", "nome proprio", "primeiro nome"], true),
    make("lastname", "Apelido", last, ["lastname", "last_name", "lastName"], ["last name", "apelido", "surname", "ultimo nome"], true),
    make("name", "Nome completo", basics.name, ["name", "fullname", "full_name"], ["full name", "nome completo"], false),
    make("email", "Email", basics.email, ["email"], ["email", "e-mail"], true),
    make("phone", "Telefone", basics.phone || personal.mobile2, ["phone", "telephone", "mobile"], ["phone", "telefone", "telemovel"], false),
    make("address", "Morada", [basics.address, basics.city, basics.country].filter(Boolean).join(", "), ["address", "location"], ["address", "morada", "location", "localizacao"], false),
    make("headline", "Cargo atual", basics.headline, ["headline", "title"], ["headline", "current job title", "cargo atual"], false),
    make("cover_letter", "Carta de apresentação", letter, ["cover_letter", "coverletter", "cover-letter"], ["cover letter", "carta de apresentacao", "carta"], false, "textarea"),
    make("linkedin", "LinkedIn", basics.linkedin, ["linkedin"], ["linkedin"], false),
    make("website", "Website", basics.website, ["website", "web"], ["website", "portfolio", "site"], false),
  ];
}

export function formFields(target: FormTarget, context: FormContext): FormField[] {
  return target === "kukwira" ? kukwiraFields(context) : genericFields(context);
}

/** The ones a person must still fill in: required and empty. */
export const missingFields = (fields: readonly FormField[]): FormField[] => fields.filter((field) => field.required && !field.value.trim());
