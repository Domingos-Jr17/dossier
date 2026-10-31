// How the app looks, as the browser last chose it: the colour scheme and
// whether the sidebar is collapsed. Both live in cookies, so the server
// renders the right one from the first paint, with no flash and no inline
// script. Read on the server and the client alike.

export const COLOR_SCHEME_COOKIE = "dossier_theme";
export const SIDEBAR_COOKIE = "dossier_sidebar";
export const LANGUAGE_COOKIE = "dossier_language";

/** The interface's language: English, as written, or European Portuguese through src/lib/i18n. */
export type InterfaceLanguage = "en" | "pt-PT";

/** The language the sidebar's switch chose; undefined until it's used. */
export function parseInterfaceLanguage(value: string | undefined): InterfaceLanguage | undefined {
  return value === "en" || value === "pt-PT" ? value : undefined;
}

export type ColorScheme = "light" | "dark";

/** The scheme the sidebar's switch chose; undefined follows the system. */
export function parseColorScheme(value: string | undefined): ColorScheme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

/** Whether the sidebar was left collapsed. */
export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Remembers a preference for a year, from the browser. */
export function rememberPreference(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}
