"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Real-time chat oqimi (SSE, `/api/chat/stream`). Hodisa kelganda mijoz odatdagi API'dan qayta so'raydi —
 * oqimda matn yo'q. Yashirin tabda yopiladi, ko'ringanda qayta ulanadi; server 50 s da `reconnect`
 * yuboradi — EventSource `Last-Event-ID` bilan o'zi qayta ulanadi. Qaytadi: ulanganmi (polling'ni sekinlashtirish uchun).
 *
 * Hodisalar: `dm {conv}` (suhbat), `inbox` (chat ro'yxati eskirdi), `group` (jamoa chati), `posts` (kanal postlari).
 * `only: "group"` — faqat jamoa hodisalari (GroupChat/ChannelPosts o'z ulanishida shaxsiy suhbat so'rovlari bajarilmaydi).
 */
export function useChatStream(opts: {
  conv?: string | null;
  group?: string | null;
  only?: "group";
  enabled?: boolean;
  onDm?: (conv: string) => void;
  onInbox?: () => void;
  onGroup?: () => void;
  onPosts?: () => void;
}): boolean {
  const [connected, setConnected] = useState(false);
  const cb = useRef(opts);
  cb.current = opts;
  const enabled = opts.enabled !== false;
  const conv = opts.conv ?? null;
  const group = opts.group ?? null;
  const only = opts.only ?? null;

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let stopped = false;
    const url = () => {
      const sp = new URLSearchParams();
      if (conv) sp.set("conv", conv);
      if (group) sp.set("group", group);
      if (only) sp.set("only", only);
      return `/api/chat/stream${sp.size ? `?${sp}` : ""}`;
    };
    const open = () => {
      if (stopped || es || document.hidden) return;
      es = new EventSource(url());
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false); // brauzer o'zi qayta uladi (retry); 4xx javobda qayta ulanmaydi
      es.addEventListener("dm", (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data) as { conv?: string };
          if (d.conv) cb.current.onDm?.(d.conv);
        } catch {
          /* bo'sh */
        }
      });
      es.addEventListener("inbox", () => cb.current.onInbox?.());
      es.addEventListener("group", () => cb.current.onGroup?.());
      es.addEventListener("posts", () => cb.current.onPosts?.());
      es.addEventListener("reconnect", () => {
        // Server oqimni yopmoqchi — darhol yangi ulanish (brauzer retry'ini kutmasdan)
        es?.close();
        es = null;
        setConnected(false);
        open();
      });
    };
    const close = () => {
      es?.close();
      es = null;
      setConnected(false);
    };
    const onVis = () => (document.hidden ? close() : open());
    open();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      close();
    };
  }, [enabled, conv, group, only]);

  return connected;
}
