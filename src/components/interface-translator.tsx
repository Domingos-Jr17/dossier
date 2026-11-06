"use client";

import { useEffect, useState } from "react";

import { translateText, type Dictionary } from "@/lib/i18n/translate";
import type { InterfaceLanguage } from "@/lib/ui-preferences";

// Puts the interface in another language once the page is showing: every
// text and the attributes people read (placeholders, labels for screen
// readers, tooltips) are looked up in the dictionary, and whatever the page
// renders next is too. It waits until React has hydrated the whole page
// (whenHydrated), so the server's HTML and React's never disagree; when React
// writes English back, it's translated again.

/** Where the user wrote, or the AI wrote for them: it stays as written, labels and all. */
const WRITTEN_AREAS = [
  "[data-no-translate]",
  "[contenteditable]",
  "pre",
  "code",
  'article[aria-label="Resume"]',
  'article[aria-label="Cover letter"]',
  'article[aria-label="Email"]',
  '[role="region"][aria-label="Posting text"]',
];
/** Text that's kept: the written areas, and what's typed in a field (a field's placeholder and label are translated). */
export const KEEP_AS_WRITTEN = [...WRITTEN_AREAS, "textarea"].join(",");
const KEEP_ATTRIBUTES = WRITTEN_AREAS.join(",");

const ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"] as const;

/**
 * Whether `element` is in what the user or the AI wrote. The buttons of a
 * section of a document (Edit, Regenerate, Ask AI, Leave out) are inside it
 * but are interface, so they're translated.
 */
function inWrittenArea(element: Element | null, selector: string): boolean {
  const area = element?.closest(selector);
  if (!element || !area) return false;
  const control = element.closest("button, [role='button']");
  return !(control && control !== area && area.contains(control));
}

export function translateTree(root: Node, dictionary: Dictionary, written: WeakMap<Node, string>): void {
  const kept = (element: Element | null) => inWrittenArea(element, KEEP_AS_WRITTEN);
  const text = (node: Text) => {
    const value = node.nodeValue ?? "";
    if (written.get(node) === value || kept(node.parentElement)) return;
    const translated = translateText(value, dictionary);
    if (translated === null) return;
    written.set(node, translated);
    node.nodeValue = translated;
  };
  const attributes = (element: Element) => {
    if (inWrittenArea(element, KEEP_ATTRIBUTES)) return;
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (!value) continue;
      const translated = translateText(value, dictionary);
      if (translated !== null) element.setAttribute(name, translated);
    }
  };
  if (root.nodeType === Node.TEXT_NODE) return text(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) attributes(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) text(node as Text);
    else attributes(node as Element);
  }
}

/** The dictionaries, each its own chunk, loaded only for the language chosen. */
const DICTIONARIES: Record<Exclude<InterfaceLanguage, "en">, () => Promise<Dictionary>> = {
  "pt-PT": () => import("@/lib/i18n/pt-PT").then((module) => module.PT_PT),
};

/** The interface in `language`, kept so as the page changes. Renders nothing; English needs nothing. */
export function InterfaceTranslator({ language }: { language: InterfaceLanguage }) {
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  useEffect(() => {
    if (language === "en") return;
    let live = true;
    void DICTIONARIES[language]().then((loaded) => live && setDictionary(loaded));
    return () => {
      live = false;
    };
  }, [language]);
  return dictionary ? <Translating dictionary={dictionary} /> : null;
}

/** Whether a Suspense boundary is still waiting for its streamed content: React marks it `<!--$?-->` until the content arrives. */
function boundaryPending(): boolean {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node as Comment).data === "$?") return true;
  return false;
}

/**
 * Calls `run` once the page has hydrated: loaded, with no Suspense boundary
 * waiting for streamed content, and the browser idle. Changing the text of a
 * part React hasn't hydrated makes it fail to ("Minified React error #418")
 * and leaves "A carregar o seu painel…" showing. Gives up waiting after
 * `limit` milliseconds. Returns what cancels it.
 */
export function whenHydrated(run: () => void, limit = 8000): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const go = () => {
    const idle = typeof window.requestIdleCallback === "function" ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 500 }) : (callback: () => void) => setTimeout(callback, 50);
    idle(() => {
      if (!cancelled) run();
    });
  };
  const check = () => {
    if (cancelled) return;
    if ((document.readyState === "complete" && !boundaryPending()) || Date.now() - started > limit) go();
    else timer = setTimeout(check, 100);
  };
  check();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Translates the page with `dictionary`, and keeps it translated, once it has
 * hydrated (at once with `immediate`, for tests). Renders nothing.
 */
export function Translating({ dictionary, immediate = false }: { dictionary: Dictionary; immediate?: boolean }) {
  useEffect(() => {
    const written = new WeakMap<Node, string>();
    const translate = (node: Node) => translateTree(node, dictionary, written);
    const title = () => {
      const translated = translateText(document.title.replace(/ · Dossier$/, ""), dictionary);
      if (translated !== null) document.title = `${translated} · Dossier`;
    };
    let observer: MutationObserver | undefined;
    let head: MutationObserver | undefined;
    const start = () => {
      translate(document.body);
      title();
      observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData") translate(record.target);
          else if (record.type === "attributes") translate(record.target);
          else record.addedNodes.forEach(translate);
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
      head = new MutationObserver(title);
      const titleElement = document.querySelector("title");
      if (titleElement) head.observe(titleElement, { childList: true, characterData: true, subtree: true });
    };
    let cancel = () => {};
    if (immediate) start();
    else cancel = whenHydrated(start);
    return () => {
      cancel();
      observer?.disconnect();
      head?.disconnect();
    };
  }, [dictionary, immediate]);
  return null;
}
