import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { LANGUAGE_COOKIE, parseInterfaceLanguage, type InterfaceLanguage } from "@/lib/ui-preferences";

/** The interface's language: the sidebar switch's choice, else DOSSIER_INTERFACE_LANGUAGE, else English. */
export async function interfaceLanguage(): Promise<InterfaceLanguage> {
  return parseInterfaceLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value) ?? env.DOSSIER_INTERFACE_LANGUAGE ?? "en";
}
