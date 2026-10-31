"use client";

import { useEffect, useState } from "react";

import { translateText, type Dictionary } from "@/lib/i18n/translate";
import type { InterfaceLanguage } from "@/lib/ui-preferences";

// Puts the interface in another language once the page is showing: every
// text and the attributes people read (placeholders, labels for screen
// readers, tooltips) are looked up in the dictionary, and whatever the page
// renders next is too. It runs after React has hydrated, so the server's
// HTML and React's never disagree; when React writes English back, it's
// translated again.

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

export function translateTree(root: Node, dictionary: Dictionary, written: WeakMap<Node, string>): void {
  const kept = (element: Element | null) => Boolean(element?.closest(KEEP_AS_WRITTEN));
  const text = (node: Text) => {
    const value = node.nodeValue ?? "";
    if (written.get(node) === value || kept(node.parentElement)) return;
    const translated = translateText(value, dictionary);
    if (translated === null) return;
    written.set(node, translated);
    node.nodeValue = translated;
  };
  const attributes = (element: Element) => {
    if (element.closest(KEEP_ATTRIBUTES)) return;
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

/** Translates the page with `dictionary`, and keeps it translated. Renders nothing. */
export function Translating({ dictionary }: { dictionary: Dictionary }) {
  useEffect(() => {
    const written = new WeakMap<Node, string>();
    const translate = (node: Node) => translateTree(node, dictionary, written);
    translate(document.body);
    const title = () => {
      const translated = translateText(document.title.replace(/ · Dossier$/, ""), dictionary);
      if (translated !== null) document.title = `${translated} · Dossier`;
    };
    title();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") translate(record.target);
        else if (record.type === "attributes") translate(record.target);
        else record.addedNodes.forEach(translate);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
    const head = new MutationObserver(title);
    const titleElement = document.querySelector("title");
    if (titleElement) head.observe(titleElement, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      head.disconnect();
    };
  }, [dictionary]);
  return null;
}
