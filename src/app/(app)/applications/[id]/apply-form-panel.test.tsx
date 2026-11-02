import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FormField } from "@/lib/apply-form/fields";

import { ApplyFormPanel } from "./apply-form-panel";
import { loadApplyForm, previewKukwiraSend, saveApplyPersonal, sendKukwiraApplication, type ApplyFormView } from "./apply-form-actions";

vi.mock("./apply-form-actions", () => ({ loadApplyForm: vi.fn(), previewKukwiraSend: vi.fn(), saveApplyPersonal: vi.fn(), sendKukwiraApplication: vi.fn() }));
vi.mock("@/components/toast", () => ({ toast: vi.fn(), toastResult: (result: unknown) => result }));
const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/copy-text", () => ({ copyText: vi.fn(async () => true) }));

const field = (id: string, label: string, value: string, extra: Partial<FormField> = {}): FormField => ({ id, names: [id], labels: [], label, kind: "text", value, required: false, ...extra });
const view = (change: Partial<ApplyFormView> = {}): ApplyFormView => ({
  target: "kukwira",
  site: "kukwira.co.mz",
  url: "https://www.kukwira.co.mz/#/candidatura#AB12",
  fields: [field("name", "Nome", "Marta Sitoe", { required: true }), field("postalcode", "Código postal", "", { required: true })],
  missing: ["postalcode"],
  personal: { gender: "", civilState: "", birthPlace: "", postalCode: "", mobile2: "", nationality: "" },
  bookmarklet: "javascript:void%200",
  canSend: true,
  ...change,
});

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = "dossier_apply_mode=; max-age=0; path=/";
  vi.mocked(loadApplyForm).mockResolvedValue({ ok: true, data: view() });
});

describe("ApplyFormPanel", () => {
  it("starts with the assistant: every value with its Copy, and what's missing marked", async () => {
    render(<ApplyFormPanel applicationId="a1" site="kukwira.co.mz" />);
    const list = await screen.findByRole("list", { name: "Values for the form" });
    expect(within(list).getByText("Marta Sitoe")).toBeInTheDocument();
    expect(within(list).getByText("Missing")).toBeInTheDocument();
    expect(within(list).getAllByRole("button", { name: /^Copy/ })).toHaveLength(1);
  });

  it("switches to the bookmark, which carries the link, and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<ApplyFormPanel applicationId="a1" site="kukwira.co.mz" />);
    await screen.findByRole("list", { name: "Values for the form" });
    await user.click(screen.getByRole("radio", { name: "Bookmark" }));
    const link = await screen.findByText("Fill in form (Dossier)");
    await waitFor(() => expect(link).toHaveAttribute("href", "javascript:void%200"));
    expect(document.cookie).toContain("dossier_apply_mode=bookmark");
  });

  it("asks for the details forms want that the profile lacks, and saves them", async () => {
    const user = userEvent.setup();
    vi.mocked(saveApplyPersonal).mockResolvedValue({ ok: true, data: { gender: "Feminino", civilState: "", birthPlace: "", postalCode: "", mobile2: "", nationality: "" } });
    render(<ApplyFormPanel applicationId="a1" site="kukwira.co.mz" />);
    // Open from the start, as something the form needs is missing.
    expect(await screen.findByRole("button", { name: "Details forms ask for" })).toHaveAttribute("aria-expanded", "true");
    await user.selectOptions(screen.getByLabelText("Gender"), "Feminino");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saveApplyPersonal).toHaveBeenCalledWith(expect.objectContaining({ gender: "Feminino" }));
  });

  describe("Send from here", () => {
    const preview = { rows: [{ id: "name", label: "Nome", value: "Marta Sitoe", required: true }, { id: "occupation_id", label: "Cargo 1", value: "Gestor/a de produto", matched: "Gestor/a de produto", required: true }], unresolved: [], fileName: "Marta – CV.pdf", alreadySent: false };
    async function toReview() {
      const user = userEvent.setup();
      render(<ApplyFormPanel applicationId="a1" site="kukwira.co.mz" initialMode="send" />);
      await user.click(await screen.findByRole("button", { name: "Review before sending" }));
      await screen.findByRole("list", { name: "What goes to Kukwira" });
      return user;
    }

    it("shows everything that goes, and sends only after the privacy tick", async () => {
      vi.mocked(previewKukwiraSend).mockResolvedValue({ ok: true, data: preview });
      vi.mocked(sendKukwiraApplication).mockResolvedValue({ ok: true, data: { sent: true } });
      const user = await toReview();
      const list = screen.getByRole("list", { name: "What goes to Kukwira" });
      expect(within(list).getByText("Marta – CV.pdf")).toBeInTheDocument();
      expect(within(list).getByText(/Chosen from Kukwira's list: Gestor\/a de produto/)).toBeInTheDocument();
      const send = screen.getByRole("button", { name: "Send to Kukwira" });
      expect(send).toBeDisabled();
      await user.click(screen.getByLabelText("I have read and accept Kukwira's privacy policy."));
      await user.click(send);
      expect(sendKukwiraApplication).toHaveBeenCalledWith({ applicationId: "a1", edits: {}, acceptedPrivacy: true, again: false });
      await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    });

    it("won't send while something required is missing, and takes it typed", async () => {
      vi.mocked(previewKukwiraSend).mockResolvedValue({ ok: true, data: { ...preview, unresolved: [{ id: "occupation_id", label: "Cargo 1", note: "Escolha na lista o cargo mais próximo." }] } });
      const user = await toReview();
      await user.click(screen.getByLabelText("I have read and accept Kukwira's privacy policy."));
      expect(screen.getByRole("button", { name: "Send to Kukwira" })).toBeDisabled();
      await user.type(screen.getByLabelText("Cargo 1"), "A");
      expect(loadApplyForm).toHaveBeenCalledTimes(2);
    });

    it("asks to confirm sending an application that's already marked as sent", async () => {
      vi.mocked(previewKukwiraSend).mockResolvedValue({ ok: true, data: { ...preview, alreadySent: true } });
      const user = await toReview();
      await user.click(screen.getByLabelText("I have read and accept Kukwira's privacy policy."));
      expect(screen.getByRole("button", { name: "Send to Kukwira" })).toBeDisabled();
      await user.click(screen.getByLabelText(/already marked as sent/));
      expect(screen.getByRole("button", { name: "Send to Kukwira" })).toBeEnabled();
    });

    it("isn't offered for a site whose form guards against robots", async () => {
      vi.mocked(loadApplyForm).mockResolvedValue({ ok: true, data: view({ target: "workable", site: "apply.workable.com", canSend: false, missing: [] }) });
      render(<ApplyFormPanel applicationId="a1" site="apply.workable.com" initialMode="send" />);
      expect(await screen.findByText(/doesn't allow sending from here/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Review before sending" })).not.toBeInTheDocument();
    });
  });
});
