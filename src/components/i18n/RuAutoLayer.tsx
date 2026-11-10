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

/**
 * Tugunni React allaqachon JONLANTIRGANMI (gidratsiya qilganmi). React jonlantirgan har DOM tuguniga `__reactFiber$…`
 * xususiyatini yozadi. Sahifa bo'laklab jonlanadi (Suspense, tanlab gidratsiya) va bu `load` hodisasidan KEYIN ham davom
 * etadi: hali jonlanmagan bo'lakdagi matnni almashtirsak, React «server matni mos emas» (#418) deb o'sha bo'lakni
 * boshidan chizadi — konsol xatosi va ortiqcha ish. Shuning uchun faqat jonlangan tugunlarga tegamiz; qolganlari keyingi
 * aylanishda (pastdagi `sweep`) almashadi — jonlanish DOM'ni o'zgartirmaydi, kuzatuvchi buni sezmaydi.
 */
function hydrated(node: Node): boolean {
  for (const k in node) if (k.startsWith("__reactFiber$") || k.startsWith("__reactProps$")) return true;
  return false;
}
/** Oxirgi aylanishda jonlanmagani uchun o'tkazib yuborilgan tugunlar soni */
let skippedCold = 0;

function eligible(node: Text): boolean {
  const p = node.parentElement;
  // SVG elementlarda tagName kichik harfda (svg/text/tspan) — toUpperCase bilan tekshiramiz
  if (!p || SKIP_TAGS.has(p.tagName.toUpperCase()) || p.closest("svg")) return false;
  if (p.closest('[data-no-auto],[data-no-cyrl],[contenteditable="true"],input,textarea')) return false;
  const v = node.nodeValue ?? "";
  // Lotin harfli har qanday matn LUG'ATDAN qidiriladi (bitta so'zli yorliqlar ham: «Yangi», «Tarix», «Hammasi»); AI'ga esa
  // faqat `looksUzbek` matnlar yuboriladi (applyText). Ilgari bu yerda `looksUzbek` turardi va bitta so'zli yorliqlar
  // lug'atda bo'lsa ham tarjima qilinmasdi (ruscha sahifada «Yangi → Принято → Jarayonda» kabi aralash ko'rinardi).
  // Kirill harfi bor tugun odatda allaqachon tarjima qilingan; istisno — «·» bilan yig'ilgan satrlar («Контакт · 80 ming so'm»)
  if (!(Boolean(v.trim()) && /[a-z]/i.test(v) && v.length <= 200 && (!/[а-яё]/i.test(v) || v.includes("·")))) return false;
  // Matn tugunining o'z belgisi bor; yagona satr-bola («<span>Matn</span>») holatida React matnni ota elementning
  // mazmuni sifatida jonlantiradi — belgi faqat otada bo'ladi. Aralash bolali otaning belgisi YETARLI EMAS: React ota bilan
  // bolalar orasida to'xtab turishi mumkin (bo'lib-bo'lib ishlash).
  if (hydrated(node) || (p.childNodes.length === 1 && hydrated(p))) return true;
  skippedCold++;
  return false;
}

/**
 * «·» bilan yig'ilgan satr («Motion dizayner · Nukus · Qoraqalpog'iston», «3D artist · », «Контакт · 80 ming so'm»):
 * har bo'lak ALOHIDA lug'atdan qidiriladi — butun satr lug'atda bo'lmaydi (kasb × shahar × hudud kombinatsiyalari cheksiz).
 * Ajratgichlar (atrofidagi bo'shliqlari bilan) o'zgarishsiz qoladi. Hech bo'lak topilmasa — null.
 */
function translateParts(v: string): string | null {
  if (!v.includes("·")) return null;
  let changed = false;
  const out = v
    .split(/(\s*·\s*)/)
    .map((part, i) => {
      if (i % 2 === 1 || !part.trim() || !/[a-z]/i.test(part) || /[а-яё]/i.test(part)) return part;
      const ru = lookupRu(part);
      if (!ru) return part;
      changed = true;
      return (part.match(/^\s*/)?.[0] ?? "") + ru + (part.match(/\s*$/)?.[0] ?? "");
    })
    .join("");
  return changed ? out : null;
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
      const mixed = /[а-яё]/i.test(v);
      const ru = mixed ? null : lookupRu(v);
      const parts = ru ? null : translateParts(v);
      if (parts) {
        if (parts !== v) t.nodeValue = parts;
      } else if (mixed) {
        /* kirill + lotin, lekin bo'laklar lug'atda yo'q — tegmaymiz (AI'ga ham yuborilmaydi) */
      } else if (ru) {
        // bo'shliqlarni saqlab almashtiramiz (inline matn yonidagi probel)
        const lead = v.match(/^\s*/)?.[0] ?? "";
        const trail = v.match(/\s*$/)?.[0] ?? "";
        const next = lead + ru + trail;
        if (next !== v) t.nodeValue = next;
      } else if (looksUzbek(v)) {
        const k = normalizeUz(v);
        if (!asked.has(k)) queue.add(k);
      }
    };
    const applyAttrs = (el: Element) => {
      if (!hydrated(el)) {
        skippedCold++;
        return;
      }
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v || !/[a-z]/i.test(v) || /[а-яё]/i.test(v)) continue;
        const ru = lookupRu(v);
        if (ru) {
          if (ru !== v) el.setAttribute(a, ru);
        } else if (looksUzbek(v)) {
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
        applyTitle();
      } catch {
        /* tarmoq xatosi — matn o'zbekcha qoladi */
      }
      if (queue.size) schedule();
    };
    const schedule = () => {
      if (queue.size === 0 || timer !== null) return;
      timer = window.setTimeout(() => void flush(), 400);
    };

    /**
     * Brauzer yorlig'i sarlavhasi (`<title>`, qolip «Bo'lim · Kasb Egalari»): DOM matni emas, shuning uchun alohida.
     * Har bo'lak («·» bo'yicha, kerak bo'lsa «—» bo'yicha ham) lug'atdan qidiriladi; brend va foydalanuvchi matni (ism,
     * post sarlavhasi) lug'atda yo'q — o'zgarmaydi. Telefon yuqori paneli nomni shu sarlavhadan o'qiydi (`useMobileTitle`).
     */
    const ruPart = (seg: string): string => {
      if (!/[a-z]/i.test(seg) || /[а-яё]/i.test(seg)) return seg;
      const whole = lookupRu(seg);
      if (whole) return whole;
      if (looksUzbek(seg)) {
        const k = normalizeUz(seg);
        if (!asked.has(k)) queue.add(k);
      }
      return seg;
    };
    const applyTitle = () => {
      const cur = document.title;
      const m = /^(\(\d+\+?\)\s+)?([\s\S]*)$/.exec(cur);
      const rest = m?.[2] ?? cur;
      const next =
        (m?.[1] ?? "") +
        rest
          .split(" · ")
          .map((seg) => {
            const whole = ruPart(seg);
            if (whole !== seg || !seg.includes(" — ")) return whole;
            return seg.split(" — ").map(ruPart).join(" — ");
          })
          .join(" · ");
      if (next !== cur) document.title = next;
      schedule();
    };
    const titleObs = new MutationObserver(applyTitle);

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
    let idle: number | null = null;
    let sweepTimer: number | null = null;
    /**
     * Birinchi ishga tushish — sahifa TO'LIQ jonlangach (gidratsiyadan keyin): `load` + brauzer bo'sh qolganda.
     * Ilgari lug'at yuklanishi bilan darhol ishlardi; React hali jonlantirmagan bo'laklarning (Suspense oqimi) matni ruschaga
     * almashib qolar va React «server matni mos emas» (#418) deb o'sha bo'lakni qaytadan chizardi — rus tilidagi sahifalarda
     * konsol xatosi va ortiqcha qayta chizish (kabinet/obuna, to'lovlar, xarita…). Kuzatuvchi ham shu paytgacha ulanmaydi.
     */
    /** Jonlanmagan bo'laklar qolgan bo'lsa — birozdan keyin yana aylanamiz (ko'pi bilan 6 marta: ~0.6 s … 8 s) */
    const sweep = (attempt: number) => {
      sweepTimer = null;
      if (cancelled) return;
      skippedCold = 0;
      run(root);
      if (skippedCold > 0 && attempt < 6) sweepTimer = window.setTimeout(() => sweep(attempt + 1), 600 * 1.6 ** attempt);
    };
    const start = () => {
      idle = null;
      if (cancelled) return;
      sweep(0);
      applyTitle();
      titleObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    };
    const whenIdle = () => {
      if (cancelled) return;
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      idle = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 350);
    };
    void ensureDict().then(() => {
      if (cancelled) return;
      if (document.readyState === "complete") whenIdle();
      else window.addEventListener("load", whenIdle, { once: true });
    });
    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
      if (idle !== null) {
        const w = window as Window & { cancelIdleCallback?: (id: number) => void };
        if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
      obs?.disconnect();
      titleObs.disconnect();
      if (timer !== null) window.clearTimeout(timer);
      if (sweepTimer !== null) window.clearTimeout(sweepTimer);
    };
  }, [active]);

  return null;
}
