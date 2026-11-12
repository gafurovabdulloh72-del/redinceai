"use client";

import { prefersReducedMotion } from "@/components/motion/haptics";

/**
 * Story harakatlari (Instagram uslubi) — Web Animations API bilan, CSS keyframes'siz:
 *  - openFrom: karta bosilgan avatar joyidan kattalashib ochiladi;
 *  - closeTo: karta avatarga qaytib kichrayadi (avatar ko'rinmasa — pastga tushib yo'qoladi);
 *  - cubeSwap: muallif almashganda kub aylanishi (eski yuz nusxasi + yangi yuz).
 * Harakat kamaytirilgan bo'lsa (OS yoki Ko'rinish paneli) hammasi darhol bajariladi.
 */

export type OriginRect = { x: number; y: number; w: number; h: number };

const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.2, 1)";

export function rectOf(el: Element | null | undefined): OriginRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Kartani origin (avatar) to'rtburchagiga tushiradigan transform */
function toOrigin(card: HTMLElement, o: OriginRect): string {
  const r = card.getBoundingClientRect();
  const s = o.w / r.width;
  const dx = o.x + o.w / 2 - (r.left + r.width / 2);
  const dy = o.y + o.h / 2 - (r.top + r.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${s})`;
}

export function openFrom(card: HTMLElement | null, backdrop: HTMLElement | null, origin: OriginRect | null): void {
  if (!card || prefersReducedMotion()) return;
  const radius = getComputedStyle(card).borderRadius || "0px";
  const dur = 340;
  if (origin) {
    const r = card.getBoundingClientRect();
    card.animate(
      [
        { transform: toOrigin(card, origin), borderRadius: `${r.width / 2}px`, opacity: 0.7 },
        { transform: "none", borderRadius: radius, opacity: 1 },
      ],
      { duration: dur, easing: EASE_OUT },
    );
  } else {
    card.animate([{ transform: "translateY(6%) scale(0.92)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 280, easing: EASE_OUT });
  }
  backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: "ease-out" });
}

/** Yopish: karta joriy holatidan (masalan, pastga tortilgan) avatarga yoki pastga. Tugagach resolve */
export function closeTo(card: HTMLElement | null, backdrop: HTMLElement | null, origin: OriginRect | null): Promise<void> {
  if (!card || prefersReducedMotion()) return Promise.resolve();
  const from = card.style.transform || "none";
  const fromOpacity = backdrop ? getComputedStyle(backdrop).opacity : "1";
  const dur = 300;
  // Animatsiya boshlangach inline holat kerak emas — oxirgi kadr fill bilan ushlab turiladi
  card.style.transform = "";
  card.style.borderRadius = "";
  if (backdrop) backdrop.style.opacity = "";
  backdrop?.animate([{ opacity: fromOpacity }, { opacity: 0 }], { duration: dur, easing: "ease-out", fill: "forwards" });
  const r = card.getBoundingClientRect();
  const a = origin
    ? card.animate(
        [
          { transform: from, opacity: 1 },
          { transform: toOrigin(card, origin), borderRadius: `${r.width / 2}px`, opacity: 0 },
        ],
        { duration: dur, easing: EASE_IN_OUT, fill: "forwards" },
      )
    : card.animate([{ transform: from, opacity: 1 }, { transform: "translateY(40%) scale(0.8)", opacity: 0 }], { duration: dur, easing: EASE_IN_OUT, fill: "forwards" });
  return a.finished.then(
    () => undefined,
    () => undefined,
  );
}

/** Pastga tortilgan kartani joyiga qaytarish (yopish chegarasiga yetmagan) */
export function springBack(card: HTMLElement | null, backdrop: HTMLElement | null): void {
  if (!card) return;
  const from = card.style.transform || "none";
  const fromR = card.style.borderRadius;
  card.style.transform = "";
  card.style.borderRadius = "";
  const op = backdrop?.style.opacity || "1";
  if (backdrop) backdrop.style.opacity = "";
  if (prefersReducedMotion()) return;
  card.animate([{ transform: from, borderRadius: fromR || undefined }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(0.34, 1.4, 0.5, 1)" });
  backdrop?.animate([{ opacity: op }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
}

/**
 * Kub aylanishi. `apply` — React holatini almashtiradi (yangi muallif). Avval kartaning ko'rinib turgan nusxasi (video —
 * joriy kadr canvas'da) shu joyga qo'yiladi, keyin eski yuz chetga burilib ketadi, yangisi qarama-qarshi tomondan kiradi.
 */
export function cubeSwap(card: HTMLElement | null, dir: 1 | -1, apply: () => void): void {
  const stage = card?.parentElement;
  if (!card || !stage || prefersReducedMotion()) return apply();
  const ghost = card.cloneNode(true) as HTMLElement;
  // Videolar — joriy kadr (canvas'ga chizish begona domendan bo'lsa ham ishlaydi; faqat o'qish taqiqlanadi)
  const srcVideos = card.querySelectorAll("video");
  ghost.querySelectorAll("video").forEach((v, i) => {
    const src = srcVideos[i];
    const c = document.createElement("canvas");
    c.className = v.className;
    try {
      c.width = src?.videoWidth || 1;
      c.height = src?.videoHeight || 1;
      if (src) c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
    } catch {
      /* chizib bo'lmasa — bo'sh qora yuz */
    }
    v.replaceWith(c);
  });
  ghost.querySelectorAll("audio").forEach((a) => a.remove());
  ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  ghost.setAttribute("aria-hidden", "true");
  ghost.removeAttribute("role");
  Object.assign(ghost.style, {
    position: "absolute",
    left: `${card.offsetLeft}px`,
    top: `${card.offsetTop}px`,
    width: `${card.offsetWidth}px`,
    height: `${card.offsetHeight}px`,
    margin: "0",
    pointerEvents: "none",
    backfaceVisibility: "hidden",
    transform: "none",
  });
  stage.appendChild(ghost);
  apply();
  const dur = 460;
  const opts: KeyframeAnimationOptions = { duration: dur, easing: EASE_IN_OUT, fill: "forwards" };
  const out = ghost.animate(
    [
      { transform: "translateX(0) rotateY(0deg)", transformOrigin: dir > 0 ? "100% 50%" : "0% 50%", filter: "brightness(1)" },
      { transform: `translateX(${-dir * 100}%) rotateY(${-dir * 90}deg)`, transformOrigin: dir > 0 ? "100% 50%" : "0% 50%", filter: "brightness(0.35)" },
    ],
    opts,
  );
  card.animate(
    [
      { transform: `translateX(${dir * 100}%) rotateY(${dir * 90}deg)`, transformOrigin: dir > 0 ? "0% 50%" : "100% 50%", filter: "brightness(0.35)" },
      { transform: "translateX(0) rotateY(0deg)", transformOrigin: dir > 0 ? "0% 50%" : "100% 50%", filter: "brightness(1)" },
    ],
    { duration: dur, easing: EASE_IN_OUT },
  );
  const done = () => ghost.remove();
  out.finished.then(done, done);
}
