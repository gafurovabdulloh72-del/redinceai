"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Real-time chat oqimi (SSE, `/api/chat/stream`). Hodisa kelganda mijoz odatdagi API'dan qayta so'raydi —
 * oqimda matn yo'q. Yashirin tabda yopiladi, ko'ringanda qayta ulanadi; server 50 s da `reconnect`
 * yuboradi — EventSource `Last-Event-ID` bilan o'zi qayta ulanadi. Qaytadi: ulanganmi (polling'ni sekinlashtirish uchun).
 */
export function useChatStream(opts: { conv?: string | null; group?: string | null; enabled?: boolean; onDm?: (conv: string) => void; onGroup?: () => void }): boolean {
  const [connected, setConnected] = useState(false);
  const cb = useRef(opts);
  cb.current = opts;
  const enabled = opts.enabled !== false;
  const conv = opts.conv ?? null;
  const group = opts.group ?? null;

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let stopped = false;
    const url = () => {
      const sp = new URLSearchParams();
      if (conv) sp.set("conv", conv);
      if (group) sp.set("group", group);
      return `/api/chat/stream${sp.size ? `?${sp}` : ""}`;
    };
    const open = () => {
      if (stopped || es || document.hidden) return;
      es = new EventSource(url());
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false); // brauzer o'zi qayta uladi (retry)
      es.addEventListener("dm", (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data) as { conv?: string };
          if (d.conv) cb.current.onDm?.(d.conv);
        } catch {
          /* bo'sh */
        }
      });
      es.addEventListener("group", () => cb.current.onGroup?.());
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
  }, [enabled, conv, group]);

  return connected;
}
