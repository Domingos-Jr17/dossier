import { z } from "zod";

// What the application forms of Mozambican sites ask and the profile doesn't
// keep: kept on this server, in Settings, and only used to fill in forms.

export const GENDERS = ["Masculino", "Feminino"] as const;
export const CIVIL_STATES = ["Casado(a)", "Solteiro(a)", "Divorciado(a)", "Viuvo(a)"] as const;
/** Kukwira's list of places of birth, by its codes. */
export const PROVINCES = [
  { code: "1", name: "Niassa" },
  { code: "2", name: "Cabo Delgado" },
  { code: "3", name: "Nampula" },
  { code: "4", name: "Zambézia" },
  { code: "5", name: "Tete" },
  { code: "6", name: "Manica" },
  { code: "7", name: "Sofala" },
  { code: "8", name: "Inhambane" },
  { code: "9", name: "Gaza" },
  { code: "10", name: "Maputo (província)" },
  { code: "11", name: "Cidade de Maputo" },
  { code: "12", name: "Outro" },
] as const;

export const applyPersonalSchema = z.object({
  gender: z.enum(["", ...GENDERS]).catch(""),
  civilState: z.enum(["", ...CIVIL_STATES]).catch(""),
  /** One of PROVINCES' names. */
  birthPlace: z.string().trim().max(60).catch(""),
  postalCode: z.string().trim().max(20).catch(""),
  /** A second phone number; forms often ask for two. */
  mobile2: z.string().trim().max(40).catch(""),
  /** A country's name, as the profile's country is written. */
  nationality: z.string().trim().max(80).catch(""),
});
export type ApplyPersonal = z.infer<typeof applyPersonalSchema>;

export const EMPTY_PERSONAL: ApplyPersonal = { gender: "", civilState: "", birthPlace: "", postalCode: "", mobile2: "", nationality: "" };
