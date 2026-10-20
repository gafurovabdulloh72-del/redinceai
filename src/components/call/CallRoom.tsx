"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2, X } from "lucide-react";

type Target = { kind: "dm" | "group"; id: string };

/** Barqaror stil obyekti — har renderda yangisi bo'lsa LiveKitRoom'ni bezovta qilmasin */
const ROOM_STYLE = { height: "100%" } as const;

/**
 * Video qo'ng'iroq xonasi — butun ekranli ustki qatlam (overlay).
 * `/api/qongiroq/token` dan token oladi (egalik tekshiruvi serverda), keyin LiveKit xonasiga ulanadi.
 * Token server-tomonda beriladi — klientga API_SECRET umuman chiqmaydi.
 *
 * Holatlar: ulanmoqda · xato (503 — qo'ng'iroq o'chiq, yoki ruxsat yo'q) · xona (LiveKit UI).
 */
export function CallRoom({
  target,
  title,
  onClose,
  connection,
}: {
  target?: Target;
  title: string;
  onClose: () => void;
  /** Tayyor ulanish (CallCenter start/accept'dan) — berilsa token qayta so'ralmaydi */
  connection?: { url: string; token: string };
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">(connection ? "ready" : "loading");
  const [conn, setConn] = useState<{ url: string; token: string } | null>(connection ?? null);
  const [error, setError] = useState<string>("");
  const [connected, setConnected] = useState(false);
  // Ulanish holati va onClose'ni ref'da saqlaymiz — LiveKit hodisa funksiyalari BARQAROR bo'lsin
  // (aks holda har renderda yangi funksiya → LiveKitRoom qayta ulanadi → "Client initiated disconnect")
  const connectedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleConnected = useCallback(() => {
    connectedRef.current = true;
    setConnected(true);
    // eslint-disable-next-line no-console
    console.info("[qongiroq] ulandi (connected)");
  }, []);
  const handleDisconnected = useCallback((reason?: unknown) => {
    // Diagnostika: uzilish sababi (DUPLICATE_IDENTITY / SERVER_SHUTDOWN / CLIENT_INITIATED / ...)
    // eslint-disable-next-line no-console
    console.warn("[qongiroq] uzildi — reason:", reason, "| ulangan edi:", connectedRef.current);
    // Ulangandan keyin uzilsa — yopamiz; umuman ulanmagan bo'lsa (tarmoq/boshqa) — xato + sabab ko'rsatiladi
    if (connectedRef.current) onCloseRef.current();
    else {
      setError(`Uzildi: ${reason != null ? String(reason) : "noma'lum"} — internet yoki boshqa tarmoqni sinang.`);
      setState("error");
    }
  }, []);
  const handleError = useCallback((e?: Error) => {
    // eslint-disable-next-line no-console
    console.error("[qongiroq] xato:", e);
    setError(e?.message ? `Ulanib bo'lmadi: ${e.message}` : "Qo'ng'iroq serveriga ulanib bo'lmadi.");
    setState("error");
  }, []);

  useEffect(() => {
    if (connection || !target) return; // tayyor ulanish bor — token so'ralmaydi
    const tgt = target;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/qongiroq/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: tgt.kind, id: tgt.id }),
        });
        // Server javobi ok() o'ramida keladi: { ok:true, data:{ url, token, room } } yoki { ok:false, error }
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { url?: string; token?: string }; error?: string } | null;
        if (!alive) return;
        const payload = json?.data;
        if (!res.ok || !json?.ok || !payload?.url || !payload?.token) {
          setError(res.status === 503 ? "Video qo'ng'iroq hozircha yoqilmagan." : json?.error ?? "Qo'ng'iroqni boshlab bo'lmadi.");
          setState("error");
          return;
        }
        setConn({ url: payload.url, token: payload.token });
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
  }, [target, connection]);

  // Esc bilan yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ulanish taymauti: 25s ichida ulanmasa (ICE/tarmoq bloki) — "Connecting"da cheksiz turmasin
  useEffect(() => {
    if (state !== "ready" || connected) return;
    const t = setTimeout(() => {
      setError("Ulanib bo'lmadi — internet qo'ng'iroq serveriga yetmayapti (Wi-Fi yoki boshqa tarmoqni sinab ko'ring).");
      setState("error");
    }, 25_000);
    return () => clearTimeout(t);
  }, [state, connected]);

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
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
            onError={handleError}
            data-lk-theme="default"
            style={ROOM_STYLE}
          >
            <VideoConference />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}

export default CallRoom;
