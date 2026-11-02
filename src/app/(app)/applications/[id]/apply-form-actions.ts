"use server";

import { z } from "zod";

import { ApplicationStatus, DocumentKind } from "@/generated/prisma/enums";
import { action, ActionError } from "@/lib/action";
import { applyOnSite } from "@/lib/apply-on-site";
import { bookmarklet } from "@/lib/apply-form/bookmarklet";
import { formFields, missingFields, type FormField, type FormTarget } from "@/lib/apply-form/fields";
import { kukwiraBody, loadKukwiraForm, postKukwira, resolveFields } from "@/lib/apply-form/kukwira-send";
import { applyPersonalSchema, EMPTY_PERSONAL } from "@/lib/apply-form/personal";
import { loadDocuments } from "@/lib/application-documents";
import { resolveFileName } from "@/lib/file-name";
import { JobSearchError } from "@/lib/job-search";
import { requestContext } from "@/lib/job-search/config";
import { renderPdf } from "@/lib/pdf/render";
import { prisma } from "@/lib/prisma";
import { loadProfileName } from "@/lib/profile-data";
import { loadSettings, saveSettings } from "@/lib/settings-data";
import { applyStatusChange } from "@/lib/status-changes";

// Applying on a site that has its own form (Kukwira's, CONTACT's Workable):
// the form's values from the profile, for the assistant and the bookmarklet,
// and, for Kukwira only, sending it after the person has seen what goes.

const applicationInput = z.strictObject({ applicationId: z.string().min(1).max(100), edits: z.record(z.string(), z.string().max(20_000)).default({}) });

/** The letter as a form's message: greeting, paragraphs and sign-off, without the frame (sender, date, recipient). */
function letterMessage(units: { id: string; text: string }[] | undefined): string {
  return (units ?? [])
    .filter((unit) => unit.id === "greeting" || unit.id === "signature" || unit.id.startsWith("paragraph:"))
    .map((unit) => unit.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function context(applicationId: string, edits: Record<string, string>) {
  const { application, profile, settings, letter } = await loadDocuments(applicationId);
  const apply = applyOnSite(application.postingText, application.postingUrl);
  if (!apply || apply.how !== "link") throw new ActionError("This posting doesn't take applications on a form.");
  // Kukwira's own address, or the route its page uses for an application (a test server has another host).
  const target: FormTarget = /(^|\.)kukwira\.co\.mz$/.test(apply.site) || /#\/candidatura#/.test(apply.url) ? "kukwira" : "workable";
  const personal = settings.applyPersonal ?? EMPTY_PERSONAL;
  const fields = formFields(target, { profile, personal, letter: letterMessage(letter?.units) }).map((field) =>
    edits[field.id] === undefined ? field : { ...field, value: edits[field.id], code: undefined },
  );
  return { application, apply, target, personal, fields };
}

export type ApplyFormView = {
  target: FormTarget;
  site: string;
  url: string;
  fields: FormField[];
  /** Ids of the required fields still empty. */
  missing: string[];
  personal: z.infer<typeof applyPersonalSchema>;
  /** The `javascript:` link of the bookmarklet. */
  bookmarklet: string;
  /** Whether Dossier can send it itself: Kukwira's form, with a tailored resume to attach. */
  canSend: boolean;
};

/** The form's values for this application, for the assistant, the bookmarklet and the send. */
export const loadApplyForm = action(applicationInput, async ({ applicationId, edits }): Promise<ApplyFormView> => {
  const { application, apply, target, personal, fields } = await context(applicationId, edits);
  const hasResume = application.documents.some((document) => document.kind === DocumentKind.RESUME);
  return {
    target,
    site: apply.site,
    url: apply.url,
    fields,
    missing: missingFields(fields).map((field) => field.id),
    personal,
    bookmarklet: bookmarklet(fields),
    canSend: target === "kukwira" && hasResume,
  };
});

/** Saves what forms ask and the profile doesn't keep. */
export const saveApplyPersonal = action(applyPersonalSchema, async (personal) => {
  await saveSettings({ applyPersonal: personal });
  return personal;
});

export type SendRow = { id: string; label: string; value: string; /** The option of Kukwira's list it's matched to. */ matched?: string; required: boolean };
export type SendPreview = { rows: SendRow[]; unresolved: { id: string; label: string; note?: string }[]; fileName: string; alreadySent: boolean };

async function kukwiraList(): Promise<Awaited<ReturnType<typeof loadKukwiraForm>>> {
  try {
    return await loadKukwiraForm(requestContext("KUKWIRA").baseUrl);
  } catch (error) {
    if (error instanceof JobSearchError) throw new ActionError(`Couldn't read Kukwira's form: ${error.message}`);
    throw error;
  }
}

async function cvName(application: { company: string; role: string }): Promise<string> {
  const [name, settings] = await Promise.all([loadProfileName(), loadSettings()]);
  return resolveFileName(settings.fileNamePattern, { name, company: application.company, role: application.role, doc: DocumentKind.RESUME, date: new Date() });
}

/** What would be sent to Kukwira, as its form would read it, and what blocks it. Nothing is sent. */
export const previewKukwiraSend = action(applicationInput, async ({ applicationId, edits }): Promise<SendPreview> => {
  const { application, target, fields } = await context(applicationId, edits);
  if (target !== "kukwira") throw new ActionError("Only Kukwira's form can be sent from Dossier.");
  const { resolved, unresolved } = resolveFields(fields, await kukwiraList());
  return {
    rows: resolved.filter((entry) => entry.submit).map(({ field, matched, submit }) => ({ id: field.id, label: field.label, value: field.kind === "select" ? (matched ?? field.value) : submit, ...(matched && matched !== field.value ? { matched } : {}), required: field.required })),
    unresolved: unresolved.map((field) => ({ id: field.id, label: field.label, ...(field.note ? { note: field.note } : {}) })),
    fileName: await cvName(application),
    alreadySent: application.status !== ApplicationStatus.DRAFT,
  };
});

/**
 * Sends the application through Kukwira's form, with the tailored resume as
 * the CV and the cover letter as its message, and moves a draft to Sent.
 * Only when the person has ticked that they accept Kukwira's privacy policy
 * (the form's own tick box), and, for an application already sent, said they
 * mean to send it again.
 */
export const sendKukwiraApplication = action(
  applicationInput.extend({ acceptedPrivacy: z.literal(true), again: z.boolean().default(false) }),
  async ({ applicationId, edits, again }, { toast }) => {
    const { application, apply, target, fields } = await context(applicationId, edits);
    if (target !== "kukwira") throw new ActionError("Only Kukwira's form can be sent from Dossier.");
    if (application.status !== ApplicationStatus.DRAFT && !again) throw new ActionError("This application is already marked as sent. Send it again only if you mean to.");
    if (!application.documents.some((document) => document.kind === DocumentKind.RESUME)) throw new ActionError("Write the tailored resume first: it is the CV that goes with the form.");

    const { resolved, unresolved } = resolveFields(fields, await kukwiraList());
    if (unresolved.length > 0) throw new ActionError(`Fill in first: ${unresolved.map((field) => field.label).join(", ")}.`);

    const cv = { fileName: await cvName(application), data: Buffer.from(await renderPdf(`/print/resume/${applicationId}`)) };
    const processId = /candidatura#(\w+)/.exec(apply.url)?.[1] ?? null;
    const { body, contentType } = kukwiraBody(resolved, cv, processId);
    let answer;
    try {
      answer = await postKukwira(body, contentType, requestContext("KUKWIRA").baseUrl);
    } catch (error) {
      if (error instanceof JobSearchError) throw new ActionError(`Kukwira didn't answer: ${error.message} Nothing may have been sent; check with Kukwira before trying again.`);
      throw error;
    }
    if (!answer.ok) throw new ActionError(`Kukwira didn't accept it: ${answer.message}`);

    if (application.status === ApplicationStatus.DRAFT) await applyStatusChange(prisma, applicationId, ApplicationStatus.SENT);
    toast("Sent to Kukwira. The application is marked as sent.");
    return { sent: true as const };
  },
);
