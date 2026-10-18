"use client";

import { useEffect, useRef, useState } from "react";

type ApiResp = { ok: boolean; data?: { views: number } };

/**
 * Post ko'rishini hisoblash (Telegram/Instagram uslubi): karta ekranda kamida 50% ko'rinib 1.2 soniya tursa —
 * POST /api/posts/[id]/view (bir sessiyada bir marta; serverda bir foydalanuvchi/IP uchun kuniga bir marta).
 * Sahifa fon tabda (document.hidden) bo'lsa hisoblanmaydi — tab ko'rinishga qaytganda qayta sanaladi.
 * `immediate` — oyna (PostModal) ochilganda darhol. Qaytaradi: element ref'i va yangilangan son.
 */
export function useViewTracker(postId: string, initial: number, opts: { immediate?: boolean; enabled?: boolean } = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const [views, setViews] = useState(initial);
  const { immediate = false, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    const key = `kv:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {}
    let done = false;
    let timer: number | null = null;
    let visible = false;
    const send = () => {
      if (done) return;
      done = true;
      try {
        sessionStorage.setItem(key, "1");
      } catch {}
      fetch(`/api/posts/${encodeURIComponent(postId)}/view`, { method: "POST", keepalive: true })
        .then((r) => r.json() as Promise<ApiResp>)
        .then((j) => {
          if (j.ok && j.data) setViews(j.data.views);
        })
        .catch(() => undefined);
    };
    if (immediate) {
      send();
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const stop = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const arm = () => {
      // Faqat ko'rinadigan tabda va karta yetarli ko'rinib turganda taymer ishlaydi
      if (!visible || document.visibilityState !== "visible" || timer !== null || done) return;
      timer = window.setTimeout(() => {
        send();
        io.disconnect();
      }, 1200);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.intersectionRatio >= 0.5;
          if (visible) arm();
          else stop();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    const onVis = () => (document.visibilityState === "visible" ? arm() : stop());
    io.observe(el);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [postId, immediate, enabled]);

  return { ref, views };
}
