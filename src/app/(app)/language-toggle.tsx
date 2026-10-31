"use client";

import { Languages } from "lucide-react";

import { cn } from "@/lib/cn";
import { LANGUAGE_COOKIE, rememberPreference, type InterfaceLanguage } from "@/lib/ui-preferences";

import { useSidebarCollapsed } from "./sidebar-frame";

/**
 * The sidebar's language switch: English or Português. It names the other
 * language in that language, so it reads right whichever is showing, and
 * reloads so the whole page comes back in it.
 */
export function LanguageToggle({ language }: { language: InterfaceLanguage }) {
  const collapsed = useSidebarCollapsed();
  const next: InterfaceLanguage = language === "pt-PT" ? "en" : "pt-PT";
  const label = next === "pt-PT" ? "Português" : "English";

  const choose = () => {
    rememberPreference(LANGUAGE_COOKIE, next);
    location.reload();
  };

  return (
    <button
      type="button"
      onClick={choose}
      lang={next === "pt-PT" ? "pt-PT" : "en"}
      // Its name stays in its own language: the translator leaves it be.
      data-no-translate=""
      title={collapsed ? label : undefined}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-control px-3 py-1.5 text-left text-sm font-medium text-muted hover:bg-hover hover:text-ink motion-safe:transition-colors",
        collapsed && "justify-center px-1.5",
      )}
    >
      <Languages size={16} aria-hidden="true" className="shrink-0" />
      <span className={cn(collapsed && "sr-only")}>{label}</span>
    </button>
  );
}
