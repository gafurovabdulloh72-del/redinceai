"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2, X } from "lucide-react";

type Target = { kind: "dm" | "group"; id: string };

/**
 * Video qo'ng'iroq xonasi — butun ekranli ustki qatlam (overlay).
 * `/api/qongiroq/token` dan token oladi (egalik tekshiruvi serverda), keyin LiveKit xonasiga ulanadi.
 * Token server-tomonda beriladi — klientga API_SECRET umuman chiqmaydi.
 *
 * Holatlar: ulanmoqda · xato (503 — qo'ng'iroq o'chiq, yoki ruxsat yo'q) · xona (LiveKit UI).
 */
export function CallRoom({ target, title, onClose }: { target: Target; title: string; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/qongiroq/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: target.kind, id: target.id }),
        });
        const data = (await res.json().catch(() => null)) as { url?: string; token?: string; error?: string } | null;
        if (!alive) return;
        if (!res.ok || !data?.url || !data?.token) {
          setError(res.status === 503 ? "Video qo'ng'iroq hozircha yoqilmagan." : data?.error ?? "Qo'ng'iroqni boshlab bo'lmadi.");
          setState("error");
          return;
        }
        setConn({ url: data.url, token: data.token });
        setState("ready");
      } catch {
        if (!alive) return;
        setError("Tarmoq xatosi — qaytadan urinib ko'ring.");
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [target.kind, target.id]);

  // Esc bilan yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[135] flex flex-col bg-[#0b0b0d]" role="dialog" aria-modal="true" aria-label={`Video qo'ng'iroq — ${title}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white/90">
        <span className="min-w-0 truncate text-[14px] font-semibold">{title}</span>
        <button type="button" onClick={onClose} aria-label="Yopish" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {state === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-white/80">
            <span className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-[13.5px]">Ulanmoqda…</span>
            </span>
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/85">
            <span className="flex max-w-sm flex-col items-center gap-4">
              <span className="text-[14px]">{error}</span>
              <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-white/25">
                Yopish
              </button>
            </span>
          </div>
        )}
        {state === "ready" && conn && (
          <LiveKitRoom
            serverUrl={conn.url}
            token={conn.token}
            connect
            video
            audio
            onDisconnected={onClose}
            onError={(e) => {
              // Ulanish xatosi (masalan, server yetib bo'lmadi) — jim yopilmasin, xato ko'rinsin
              setError(e?.message ? `Ulanib bo'lmadi: ${e.message}` : "Qo'ng'iroq serveriga ulanib bo'lmadi.");
              setState("error");
            }}
            data-lk-theme="default"
            style={{ height: "100%" }}
          >
            <VideoConference />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}

export default CallRoom;
