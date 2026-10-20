"use client";

import { createContext, useContext, useEffect } from "react";
import { DEFAULT_DISPLAY, type DisplayLocale } from "@/lib/i18n";
import { toCyrillic } from "@/lib/i18n/cyrillic";

/** Ko'rinish tili (uz | uz_cyrl | ru | en) — switcher uchun. BASE til `useLocale()` da alohida. */
const DisplayLocaleContext = createContext<DisplayLocale>(DEFAULT_DISPLAY);

export function DisplayLocaleProvider({ value, children }: { value: DisplayLocale; children: React.ReactNode }) {
  return (
    <DisplayLocaleContext.Provider value={value}>
      {children}
      <CyrillicLayer active={value === "uz_cyrl"} />
    </DisplayLocaleContext.Provider>
  );
}

export function useDisplayLocale(): DisplayLocale {
  return useContext(DisplayLocaleContext);
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT", "SVG"]);

/** Matn tuguni kirillga aylantiriladimi */
function convertible(node: Text): boolean {
  const p = node.parentElement;
  if (!p) return false;
  if (SKIP_TAGS.has(p.tagName)) return false;
  if (p.closest('[data-no-cyrl],[contenteditable="true"],input,textarea')) return false;
  return Boolean(node.nodeValue && node.nodeValue.trim());
}

function convertTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (convertible(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const list: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    list.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const t of list) {
    const c = toCyrillic(t.nodeValue ?? "");
    if (c !== t.nodeValue) t.nodeValue = c;
  }
}

function convertPlaceholders(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[placeholder],[data-cyrl-attr]").forEach((el) => {
    const ph = el.getAttribute("placeholder");
    if (ph) {
      const c = toCyrillic(ph);
      if (c !== ph) el.setAttribute("placeholder", c);
    }
  });
}

/**
 * «Ўзбекча» tanlanganda — butun sahifa matnini lotin→kirill aylantiradi (UI + foydalanuvchi kontenti + yangi
 * qo'shilgan har qanday element). Faqat KLIENTDA, gidratsiyadan keyin (SSR hamisha lotin chizadi — mos kelmaslik yo'q).
 * MutationObserver dinamik qo'shilgan matnni ham aylantiradi; o'zgartirish paytida observer o'chadi (sikl bo'lmaydi).
 */
function CyrillicLayer({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.body;
    let obs: MutationObserver | null = null;

    const run = (target: Node | ParentNode) => {
      obs?.disconnect();
      try {
        convertTextNodes(target as Node);
        if ((target as ParentNode).querySelectorAll) convertPlaceholders(target as ParentNode);
      } finally {
        if (obs) obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });
      }
    };

    obs = new MutationObserver((records) => {
      obs?.disconnect();
      try {
        for (const r of records) {
          if (r.type === "characterData" && r.target.nodeType === Node.TEXT_NODE && convertible(r.target as Text)) {
            const t = r.target as Text;
            const c = toCyrillic(t.nodeValue ?? "");
            if (c !== t.nodeValue) t.nodeValue = c;
          } else if (r.type === "attributes" && r.attributeName === "placeholder") {
            const el = r.target as HTMLElement;
            const ph = el.getAttribute?.("placeholder");
            if (ph) {
              const c = toCyrillic(ph);
              if (c !== ph) el.setAttribute("placeholder", c);
            }
          }
          r.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              if (convertible(node as Text)) {
                const t = node as Text;
                const c = toCyrillic(t.nodeValue ?? "");
                if (c !== t.nodeValue) t.nodeValue = c;
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              convertTextNodes(node);
              convertPlaceholders(node as Element);
            }
          });
        }
      } finally {
        obs?.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });
      }
    });

    run(root);
    return () => obs?.disconnect();
  }, [active]);

  return null;
}
