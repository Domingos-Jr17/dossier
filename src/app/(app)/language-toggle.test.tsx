import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseInterfaceLanguage } from "@/lib/ui-preferences";

import { LanguageToggle } from "./language-toggle";
import { SidebarFrame } from "./sidebar-frame";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "dossier_language=; max-age=0; path=/";
});

function renderToggle(language: "en" | "pt-PT") {
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  render(
    <SidebarFrame initialCollapsed={false} brand={<span>Dossier</span>}>
      <LanguageToggle language={language} />
    </SidebarFrame>,
  );
  return reload;
}

describe("LanguageToggle", () => {
  it("offers the other language, in that language, and remembers the choice", async () => {
    const reload = renderToggle("en");
    const button = screen.getByRole("button", { name: "Português" });
    expect(button).toHaveAttribute("lang", "pt-PT");
    expect(button).toHaveAttribute("data-no-translate");

    await userEvent.click(button);
    expect(document.cookie).toContain("dossier_language=pt-PT");
    expect(reload).toHaveBeenCalled();
  });

  it("goes back to English", async () => {
    const reload = renderToggle("pt-PT");
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).toContain("dossier_language=en");
    expect(reload).toHaveBeenCalled();
  });
});

describe("parseInterfaceLanguage", () => {
  it("knows English and European Portuguese, nothing else", () => {
    expect(parseInterfaceLanguage("pt-PT")).toBe("pt-PT");
    expect(parseInterfaceLanguage("en")).toBe("en");
    expect(parseInterfaceLanguage("fr")).toBeUndefined();
    expect(parseInterfaceLanguage(undefined)).toBeUndefined();
  });
});
