"use client";

import { useEffect, useRef, useState } from "react";

type ApiResp = { ok: boolean; data?: { views: number } };

/**
 * Post ko'rishini hisoblash (Telegram/Instagram uslubi): karta ekranda kamida 50% ko'rinib 1.2 soniya tursa —
 * POST /api/posts/[id]/view (bir sessiyada bir marta; serverda bir foydalanuvchi/IP uchun kuniga bir marta).
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
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.5) {
            if (timer === null) timer = window.setTimeout(() => { send(); io.disconnect(); }, 1200);
          } else if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [postId, immediate, enabled]);

  return { ref, views };
}
