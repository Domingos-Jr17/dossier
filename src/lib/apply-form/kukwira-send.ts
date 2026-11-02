import "server-only";

import { randomBytes } from "node:crypto";

import { parse } from "node-html-parser";

import { postForm, requestText } from "@/lib/job-search/kukwira";
import { KUKWIRA_URL } from "@/lib/job-search/sources";

import type { FormField } from "./fields";
import { bestOption, type Option } from "./match-option";

// Sending an application through Kukwira's own form, as its page does: the
// form's fields and the CV as a multipart POST to /send/email.php, which
// answers "1" when it went through. Only ever after the person has read what
// goes and said so; see sendKukwiraApplication.

/** Kukwira's lists (jobs, courses…), by field name, as its form offers them today. */
export function parseSelects(html: string): Map<string, Option[]> {
  const lists = new Map<string, Option[]>();
  for (const select of parse(html).querySelectorAll("select")) {
    const name = select.getAttribute("name");
    if (!name || lists.has(name)) continue;
    lists.set(
      name,
      select.querySelectorAll("option").map((option) => ({ value: option.getAttribute("value") ?? "", text: option.text.trim() })),
    );
  }
  return lists;
}

export async function loadKukwiraForm(baseUrl = KUKWIRA_URL): Promise<Map<string, Option[]>> {
  return parseSelects(await requestText(new URL("partials/candidatura.php", `${baseUrl.replace(/\/+$/, "")}/`)));
}

export type ResolvedField = { field: FormField; submit: string; matched?: string };

/**
 * What each field submits: a list's code when this knows it, else the closest
 * of Kukwira's own options to the value (a job, a course), else nothing.
 * `unresolved` are the required ones left empty, to be given before sending.
 */
export function resolveFields(fields: readonly FormField[], lists: ReadonlyMap<string, Option[]>): { resolved: ResolvedField[]; unresolved: FormField[] } {
  const seen = new Map<string, number>();
  const resolved: ResolvedField[] = [];
  const unresolved: FormField[] = [];
  for (const field of fields) {
    const name = field.names[0];
    const position = seen.get(name) ?? 0;
    seen.set(name, position + 1);
    let submit = field.value.trim();
    let matched: string | undefined;
    if (field.kind === "select" && submit) {
      const options = lists.get(name) ?? [];
      // A list this page doesn't show can't contradict a code known here; one that does must have it.
      const known = field.code ? options.find((option) => option.value === field.code) : undefined;
      const option = known ?? (options.length > 0 ? bestOption(options, submit) : null);
      submit = option?.value ?? (options.length === 0 && field.code ? field.code : "");
      matched = option?.text;
    }
    if (!submit && field.required) unresolved.push(field);
    resolved.push({ field, submit, ...(matched ? { matched } : {}) });
  }
  return { resolved, unresolved };
}

/** The multipart body Kukwira's page would send: fields, the CV as file-0, the form's name and the opening. */
export function kukwiraBody(resolved: readonly ResolvedField[], cv: { fileName: string; data: Buffer }, processId: string | null): { body: Buffer; contentType: string } {
  const boundary = `----dossier${randomBytes(12).toString("hex")}`;
  const parts: Buffer[] = [];
  const text = (name: string, value: string) =>
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, "utf8"));
  for (const { field, submit } of resolved) if (submit) text(field.names[0], submit);
  text("nameForm", "candidatura");
  if (processId) text("process_id", processId);
  const fileName = cv.fileName.replace(/["\r\n]/g, "");
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file-0"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`, "utf8"), cv.data, Buffer.from("\r\n", "utf8"));
  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

export type KukwiraAnswer = { ok: true } | { ok: false; message: string };

/** Posts it; Kukwira answers "1" when it went through, or says why not. */
export async function postKukwira(body: Buffer, contentType: string, baseUrl = KUKWIRA_URL): Promise<KukwiraAnswer> {
  const answer = (await postForm(new URL("send/email.php", `${baseUrl.replace(/\/+$/, "")}/`), body, contentType)).trim();
  if (answer === "1") return { ok: true };
  const reason = answer.startsWith("error_validation:") ? answer.slice("error_validation:".length).trim() : answer.replace(/<[^>]+>/g, " ").trim();
  return { ok: false, message: reason.slice(0, 300) || "Kukwira didn't accept it." };
}
