"use client";

import { useEffect } from "react";
import { ensureDict, lookupRu, looksUzbek, normalizeUz, rememberRu } from "@/lib/i18n/auto";

/**
 * AVTOMATIK RU QATLAM (2026-11-04): rus rejimida lug'atga ulanmagan o'zbekcha UI matnini DOM'da ruschaga almashtiradi —
 * CyrillicLayer naqshi (faqat klientda, gidratsiyadan keyin, MutationObserver bilan yangi elementlar ham).
 *  1) `lookupRu` (statik lug'at + sessiya keshi) — darhol;
 *  2) topilmagan o'zbekcha matnlar 400 ms ichida yig'ilib `/api/i18n/avto` ga ketadi (baza keshi → Gemini) va kelgach almashadi.
 * Chetlab o'tiladi: input/textarea/contenteditable, code/pre, `[data-no-auto]` (foydalanuvchi kontenti: post matni, chat, bio).
 * Asl matn `data-uz` atributida (ota elementda) saqlanadi — React qayta chizsa observer yana almashtiradi.
 */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT", "SVG", "KBD"]);
const ATTRS = ["placeholder", "title", "aria-label"] as const;

function eligible(node: Text): boolean {
  const p = node.parentElement;
  // SVG elementlarda tagName kichik harfda (svg/text/tspan) — toUpperCase bilan tekshiramiz
  if (!p || SKIP_TAGS.has(p.tagName.toUpperCase()) || p.closest("svg")) return false;
  if (p.closest('[data-no-auto],[data-no-cyrl],[contenteditable="true"],input,textarea')) return false;
  const v = node.nodeValue ?? "";
  return Boolean(v.trim()) && looksUzbek(v);
}

export function RuAutoLayer({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.body;
    let obs: MutationObserver | null = null;
    const queue = new Set<string>();
    let timer: number | null = null;
    const asked = new Set<string>();

    const observe = () => obs?.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    const pause = () => obs?.disconnect();

    /** Matn tugunini almashtirish; topilmasa navbatga */
    const applyText = (t: Text) => {
      const v = t.nodeValue ?? "";
      const ru = lookupRu(v);
      if (ru) {
        // bo'shliqlarni saqlab almashtiramiz (inline matn yonidagi probel)
        const lead = v.match(/^\s*/)?.[0] ?? "";
        const trail = v.match(/\s*$/)?.[0] ?? "";
        const next = lead + ru + trail;
        if (next !== v) t.nodeValue = next;
      } else {
        const k = normalizeUz(v);
        if (!asked.has(k)) queue.add(k);
      }
    };
    const applyAttrs = (el: Element) => {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v || !looksUzbek(v)) continue;
        const ru = lookupRu(v);
        if (ru) {
          if (ru !== v) el.setAttribute(a, ru);
        } else {
          const k = normalizeUz(v);
          if (!asked.has(k)) queue.add(k);
        }
      }
    };
    const walk = (target: Node) => {
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (eligible(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      const list: Text[] = [];
      let cur = walker.nextNode();
      while (cur) {
        list.push(cur as Text);
        cur = walker.nextNode();
      }
      for (const t of list) applyText(t);
      if ((target as Element).querySelectorAll) {
        (target as Element).querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((el) => {
          if (!el.closest("[data-no-auto]")) applyAttrs(el);
        });
        if ((target as Element).getAttribute) applyAttrs(target as Element);
      }
      schedule();
    };

    const run = (target: Node) => {
      pause();
      try {
        walk(target);
      } finally {
        observe();
      }
    };

    /** Navbatdagi matnlarni serverdan so'rash (bitta so'rovda ≤60) */
    const flush = async () => {
      timer = null;
      const texts = [...queue].slice(0, 60);
      texts.forEach((t) => {
        queue.delete(t);
        asked.add(t);
      });
      if (texts.length === 0) return;
      try {
        const r = await fetch("/api/i18n/avto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts }) });
        if (!r.ok) return;
        const j = (await r.json()) as { ok: boolean; data?: { map: Record<string, string> } };
        const map = j.data?.map ?? {};
        const got = Object.keys(map);
        if (got.length === 0) return;
        for (const k of got) rememberRu(k, map[k]);
        run(root); // endi lug'atda bor — DOM'ga qo'llaymiz
      } catch {
        /* tarmoq xatosi — matn o'zbekcha qoladi */
      }
      if (queue.size) schedule();
    };
    const schedule = () => {
      if (queue.size === 0 || timer !== null) return;
      timer = window.setTimeout(() => void flush(), 400);
    };

    obs = new MutationObserver((records) => {
      pause();
      try {
        for (const r of records) {
          if (r.type === "characterData" && r.target.nodeType === Node.TEXT_NODE) {
            if (eligible(r.target as Text)) applyText(r.target as Text);
          } else if (r.type === "attributes") {
            const el = r.target as Element;
            if (!el.closest("[data-no-auto]")) applyAttrs(el);
          }
          r.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              if (eligible(node as Text)) applyText(node as Text);
            } else if (node.nodeType === Node.ELEMENT_NODE) walk(node);
          });
        }
        schedule();
      } finally {
        observe();
      }
    });

    let cancelled = false;
    void ensureDict().then(() => {
      if (!cancelled) run(root);
    });
    return () => {
      cancelled = true;
      obs?.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [active]);

  return null;
}
