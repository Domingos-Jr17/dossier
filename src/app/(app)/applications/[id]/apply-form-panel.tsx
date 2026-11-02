"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { toast, toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { CIVIL_STATES, GENDERS, PROVINCES, type ApplyPersonal } from "@/lib/apply-form/personal";
import { copyText } from "@/lib/copy-text";
import { APPLY_MODE_COOKIE, rememberPreference } from "@/lib/ui-preferences";

import { loadApplyForm, previewKukwiraSend, saveApplyPersonal, sendKukwiraApplication, type ApplyFormView, type SendPreview } from "./apply-form-actions";

// The three ways to fill in a site's own application form, chosen with a
// switch: the assistant (copy each value), the bookmark (it types them into
// the page) and, for Kukwira, sending it from here after a review.

export type ApplyMode = "assist" | "bookmark" | "send";

const MODES = ["assist", "bookmark", "send"] as const;
const isMode = (value: string | undefined): value is ApplyMode => (MODES as readonly string[]).includes(value ?? "");

export function ApplyFormPanel({ applicationId, site, initialMode }: { applicationId: string; site: string; initialMode?: string }) {
  const [mode, setMode] = useState<ApplyMode>(isMode(initialMode) ? initialMode : "assist");
  const [view, setView] = useState<ApplyFormView | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadApplyForm({ applicationId, edits }).then((result) => {
      if (!live) return;
      if (result.ok) {
        setView(result.data);
        setFailed(null);
      } else setFailed(result.error);
    });
    return () => {
      live = false;
    };
  }, [applicationId, edits]);

  const choose = (next: ApplyMode) => {
    setMode(next);
    rememberPreference(APPLY_MODE_COOKIE, next);
  };

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      <div className="flex flex-col gap-2">
        <span id="apply-mode" className="text-label text-muted">
          How do you want to fill in the form?
        </span>
        <SegmentedControl
          aria-labelledby="apply-mode"
          value={mode}
          onValueChange={choose}
          size="sm"
          options={[
            { value: "assist", label: "Assistant" },
            { value: "bookmark", label: "Bookmark" },
            { value: "send", label: "Send from here" },
          ]}
        />
      </div>

      {failed && <p role="alert" className="text-sm text-danger">{failed}</p>}
      {!view && !failed && <p className="text-sm text-muted">Reading your profile…</p>}
      {view && (
        <>
          <PersonalData view={view} onSaved={(personal) => setView({ ...view, personal })} onChange={() => setEdits({ ...edits })} applicationId={applicationId} />
          {mode === "assist" && <Assistant view={view} />}
          {mode === "bookmark" && <Bookmark view={view} />}
          {mode === "send" && <Send view={view} applicationId={applicationId} site={site} edits={edits} setEdits={setEdits} />}
        </>
      )}
    </div>
  );
}

/** What forms ask and the profile doesn't keep, saved on this server and used only to fill in forms. */
function PersonalData({ view, applicationId, onSaved, onChange }: { view: ApplyFormView; applicationId: string; onSaved: (personal: ApplyPersonal) => void; onChange: () => void }) {
  const [open, setOpen] = useState(view.missing.length > 0 && view.target === "kukwira");
  const [draft, setDraft] = useState(view.personal);
  const [pending, startTransition] = useTransition();
  if (view.target !== "kukwira") return null;
  const set = (change: Partial<ApplyPersonal>) => setDraft({ ...draft, ...change });
  const save = () =>
    startTransition(async () => {
      const result = toastResult(await saveApplyPersonal(draft));
      if (result.ok) {
        onSaved(result.data);
        onChange();
        toast("Saved. It stays on your server and is only used to fill in forms.");
      }
    });
  void applicationId;
  return (
    <div className="rounded-control border border-line-card bg-input px-4 py-3">
      <button type="button" className="text-sm font-medium underline underline-offset-3" aria-expanded={open} onClick={() => setOpen(!open)}>
        Details forms ask for
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-muted">These aren&apos;t in your profile. They&apos;re kept on your server and only used to fill in application forms.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Gender" value={draft.gender} onChange={(event) => set({ gender: event.target.value as ApplyPersonal["gender"] })}>
              <option value="">Not set</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </Select>
            <Select label="Civil status" value={draft.civilState} onChange={(event) => set({ civilState: event.target.value as ApplyPersonal["civilState"] })}>
              <option value="">Not set</option>
              {CIVIL_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
            <Select label="Place of birth" value={draft.birthPlace} onChange={(event) => set({ birthPlace: event.target.value })}>
              <option value="">Not set</option>
              {PROVINCES.map((province) => (
                <option key={province.code} value={province.name}>
                  {province.name}
                </option>
              ))}
            </Select>
            <Input label="Postal code" value={draft.postalCode} onChange={(event) => set({ postalCode: event.target.value })} />
            <Input label="Second phone number" value={draft.mobile2} onChange={(event) => set({ mobile2: event.target.value })} />
            <Input label="Nationality" value={draft.nationality} placeholder="Moçambique" onChange={(event) => set({ nationality: event.target.value })} />
          </div>
          <Button size="sm" className="self-start" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Every value of the form, with its Copy; the ones still missing are marked. */
function Assistant({ view }: { view: ApplyFormView }) {
  const missing = new Set(view.missing);
  const shown = view.fields.filter((field) => field.value.trim() || field.required);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Open the form and copy each value into it. The CV file and the privacy tick box are yours to do.</p>
      <ul aria-label="Values for the form" className="flex flex-col divide-y divide-line rounded-control border border-line-card bg-input">
        {shown.map((field) => (
          <li key={field.id} className="flex items-baseline gap-3 px-3 py-2">
            <span className="w-36 shrink-0 text-meta text-muted">
              {field.label}
              {field.required && <span aria-hidden> *</span>}
            </span>
            <span className="min-w-0 flex-1 text-sm break-words">
              {field.value.trim() ? (
                <span className={field.kind === "textarea" ? "line-clamp-2 whitespace-pre-line" : undefined}>{field.value}</span>
              ) : (
                <span className="text-danger">Missing</span>
              )}
              {field.note && <span className="block text-meta text-muted">{field.note}</span>}
            </span>
            {field.value.trim() && !missing.has(field.id) && (
              <Button variant="text" size="sm" className="py-0!" aria-label={`Copy ${field.label}`} onClick={async () => toast((await copyText(field.value)) ? "Copied." : "That didn't copy. Select it and copy it yourself.")}>
                Copy
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The bookmark that types the values into the form's page. */
function Bookmark({ view }: { view: ApplyFormView }) {
  const link = useRef<HTMLAnchorElement>(null);
  // Set on the element: React doesn't render javascript: links.
  useEffect(() => {
    link.current?.setAttribute("href", view.bookmarklet);
  }, [view.bookmarklet]);
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Drag this to your bookmarks bar:{" "}
          <a ref={link} onClick={(event) => event.preventDefault()} draggable className="inline-block rounded-control border border-line-card bg-card px-2.5 py-1 font-medium">
            Fill in form (Dossier)
          </a>
        </li>
        <li>Open the application form, then click the bookmark. It types in what it finds and says what it left for you.</li>
        <li>Attach the CV, accept the privacy policy and press Send yourself.</li>
      </ol>
      <p className="text-sm text-muted">
        {view.target === "kukwira" ? "" : "Workable's forms change from job to job: it fills what it recognises. "}
        Your details are inside the bookmark and go nowhere else: it runs in your browser, on the form&apos;s page.
      </p>
    </div>
  );
}

/** Kukwira only: what would be sent, then sending it. */
function Send({ view, applicationId, site, edits, setEdits }: { view: ApplyFormView; applicationId: string; site: string; edits: Record<string, string>; setEdits: (edits: Record<string, string>) => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [again, setAgain] = useState(false);
  const [pending, startTransition] = useTransition();

  if (view.target !== "kukwira") {
    return <p className="text-sm text-muted">{site} doesn&apos;t allow sending from here: its form checks that a person is filling it in. Use the assistant or the bookmark, and press Send yourself.</p>;
  }
  if (!view.canSend) return <p className="text-sm text-muted">Write the tailored resume first: it&apos;s the CV that goes with the form.</p>;

  const review = () =>
    startTransition(async () => {
      const result = toastResult(await previewKukwiraSend({ applicationId, edits }));
      if (result.ok) {
        setPreview(result.data);
        setAccepted(false);
      }
    });
  const send = () =>
    startTransition(async () => {
      const result = toastResult(await sendKukwiraApplication({ applicationId, edits, acceptedPrivacy: true, again }));
      if (result.ok) {
        setPreview(null);
        router.refresh();
      }
    });

  if (!preview) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Dossier sends the form the way {site}&apos;s page does, with your tailored resume as the CV and the cover letter as the message. You see everything first, and nothing goes without your tick.</p>
        <Button className="self-start" onClick={review} disabled={pending}>
          {pending ? "Reading Kukwira's form…" : "Review before sending"}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-lg">What goes to Kukwira</h3>
      <ul aria-label="What goes to Kukwira" className="flex flex-col divide-y divide-line rounded-control border border-line-card bg-input">
        {preview.rows.map((row) => (
          <li key={row.id} className="flex gap-3 px-3 py-2 text-sm">
            <span className="w-36 shrink-0 text-meta text-muted">{row.label}</span>
            <span className="min-w-0 flex-1 break-words">
              <span className="line-clamp-3 whitespace-pre-line">{row.value}</span>
              {row.matched && <span className="block text-meta text-muted">Chosen from Kukwira&apos;s list: {row.matched}</span>}
            </span>
          </li>
        ))}
        <li className="flex gap-3 px-3 py-2 text-sm">
          <span className="w-36 shrink-0 text-meta text-muted">CV</span>
          <span>{preview.fileName}</span>
        </li>
      </ul>
      {preview.unresolved.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-control border border-danger px-3 py-2 text-sm">
          <p>Still needed before it can be sent:</p>
          <ul className="flex flex-col gap-2">
            {preview.unresolved.map((item) => (
              <li key={item.id}>
                <Input label={item.label} value={edits[item.id] ?? ""} hint={item.note ?? "Type it as Kukwira's list says it."} onChange={(event) => setEdits({ ...edits, [item.id]: event.target.value })} />
              </li>
            ))}
          </ul>
          <Button size="sm" className="self-start" onClick={review} disabled={pending}>
            Check again
          </Button>
        </div>
      )}
      {preview.alreadySent && <Checkbox label="I know this application is already marked as sent, and I mean to send it again." checked={again} onChange={(event) => setAgain(event.target.checked)} />}
      <Checkbox label="I have read and accept Kukwira's privacy policy." checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
      <p className="text-sm text-muted">This sends your personal details and CV to Kukwira. It can&apos;t be unsent.</p>
      <div className="flex gap-2">
        <Button onClick={send} disabled={pending || !accepted || preview.unresolved.length > 0 || (preview.alreadySent && !again)}>
          {pending ? "Sending…" : "Send to Kukwira"}
        </Button>
        <Button variant="secondary" onClick={() => setPreview(null)} disabled={pending}>
          Back
        </Button>
      </div>
    </div>
  );
}
