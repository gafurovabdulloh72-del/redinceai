"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { IncomingCall, OutgoingCall } from "./CallScreens";
import { startRing, stopRing } from "@/lib/call/ring";

const CallRoom = lazy(() => import("./CallRoom"));

type Person = { name: string; avatarUrl: string | null };
type Conn = { url: string; token: string };

/** Chaqiruvni boshlash hodisasi (CallButton → CallCenter): DM uchun. video=false → oddiy ovozli qo'ng'iroq */
export type CallStartDetail = { conversationId: string; name: string; video: boolean };
const START_EVENT = "kasb:call-start";

type Mode =
  | { k: "idle" }
  | { k: "outgoing"; inviteId: string; conn: Conn; peer: Person; caption: string; video: boolean }
  | { k: "incoming"; inviteId: string; caller: Person; video: boolean }
  | { k: "call"; inviteId: string; conn: Conn; title: string; video: boolean };

/**
 * Global qo'ng'iroq markazi (Telegram uslubi). Faqat kirgan foydalanuvchilar uchun va LiveKit yoqilgan bo'lsa.
 * - Kiruvchi: /api/qongiroq/incoming ni polling qiladi → jiringlash ekrani (Qabul/Rad) + ovoz.
 * - Chiquvchi: `kasb:call-start` hodisasi → /api/qongiroq/call → "Chaqirilmoqda…" + ovoz, holatni polling.
 * - Qabul qilinsa ikki tomon LiveKit xonasiga kiradi (CallRoom).
 */
export function CallCenter({ enabled }: { enabled: boolean }) {
  const callsOn = enabled && Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const [mode, setMode] = useState<Mode>({ k: "idle" });
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const goIdle = useCallback(() => {
    stopRing();
    setMode({ k: "idle" });
  }, []);

  // Ovoz: rejimga qarab
  useEffect(() => {
    if (mode.k === "incoming") startRing("incoming");
    else if (mode.k === "outgoing") startRing("outgoing");
    else stopRing();
  }, [mode.k]);

  // Kiruvchi qo'ng'iroqni kutish (faqat bo'sh holatda)
  useEffect(() => {
    if (!callsOn) return;
    let stop = false;
    const tick = async () => {
      if (stop || modeRef.current.k !== "idle" || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/qongiroq/incoming", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { incoming?: { id: string; caller: Person; video?: boolean } | null } };
        const inc = json.data?.incoming;
        if (inc && modeRef.current.k === "idle") setMode({ k: "incoming", inviteId: inc.id, caller: inc.caller, video: inc.video !== false });
      } catch {
        /* tarmoq — keyingi tick */
      }
    };
    const t = setInterval(tick, 2500);
    void tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [callsOn]);

  // Chiquvchi qo'ng'iroq boshlash (hodisa)
  useEffect(() => {
    if (!callsOn) return;
    const onStart = async (e: Event) => {
      const detail = (e as CustomEvent<CallStartDetail>).detail;
      if (!detail?.conversationId || modeRef.current.k !== "idle") return;
      const wantVideo = detail.video !== false;
      try {
        const res = await fetch("/api/qongiroq/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: detail.conversationId, video: wantVideo }),
        });
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: { inviteId: string; url: string; token: string; peer: Person; video?: boolean }; error?: string }
          | null;
        if (!res.ok || !json?.ok || !json.data) {
          goIdle();
          return;
        }
        const d = json.data;
        setMode({ k: "outgoing", inviteId: d.inviteId, conn: { url: d.url, token: d.token }, peer: d.peer, caption: "Chaqirilmoqda…", video: d.video !== false });
      } catch {
        goIdle();
      }
    };
    window.addEventListener(START_EVENT, onStart as EventListener);
    return () => window.removeEventListener(START_EVENT, onStart as EventListener);
  }, [callsOn, goIdle]);

  // Chiquvchi holatni kuzatish: qabul → xona, rad/javobsiz → yopiladi
  useEffect(() => {
    if (mode.k !== "outgoing") return;
    const inviteId = mode.inviteId;
    const conn = mode.conn;
    const peerName = mode.peer.name;
    const video = mode.video;
    let stop = false;
    const poll = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/qongiroq/call/${inviteId}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { data?: { status?: string } } | null;
        // Fetch davomida rejim o'zgargan bo'lishi mumkin (xonaga o'tdik) — eski javob xonani yopib yubormasin
        if (stop || modeRef.current.k !== "outgoing") return;
        const st = json?.data?.status;
        if (st === "accepted") {
          setMode({ k: "call", inviteId, conn, title: peerName, video });
        } else if (st === "declined" || st === "missed" || st === "cancelled" || st === "ended") {
          setMode((m) => (m.k === "outgoing" ? { ...m, caption: st === "declined" ? "Rad etildi" : st === "missed" ? "Javob bermadi" : "Tugatildi" } : m));
          setTimeout(() => goIdle(), 1600);
          stop = true;
        }
      } catch {
        /* keyingi */
      }
    };
    const t = setInterval(poll, 1500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [mode, goIdle]);

  const accept = useCallback(async () => {
    const m = modeRef.current;
    if (m.k !== "incoming") return;
    stopRing();
    try {
      const res = await fetch(`/api/qongiroq/call/${m.inviteId}/accept`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { url: string; token: string; video?: boolean } } | null;
      if (!res.ok || !json?.ok || !json.data) {
        goIdle();
        return;
      }
      setMode({ k: "call", inviteId: m.inviteId, conn: { url: json.data.url, token: json.data.token }, title: m.caller.name, video: json.data.video !== false });
    } catch {
      goIdle();
    }
  }, [goIdle]);

  const decline = useCallback(async () => {
    const m = modeRef.current;
    if (m.k === "incoming") void fetch(`/api/qongiroq/call/${m.inviteId}/decline`, { method: "POST" }).catch(() => undefined);
    goIdle();
  }, [goIdle]);

  const cancelOutgoing = useCallback(async () => {
    const m = modeRef.current;
    if (m.k === "outgoing") void fetch(`/api/qongiroq/call/${m.inviteId}/cancel`, { method: "POST" }).catch(() => undefined);
    goIdle();
  }, [goIdle]);

  const endCall = useCallback(async () => {
    const m = modeRef.current;
    if (m.k === "call") void fetch(`/api/qongiroq/call/${m.inviteId}/cancel?end=1`, { method: "POST" }).catch(() => undefined);
    goIdle();
  }, [goIdle]);

  if (!callsOn || mode.k === "idle") return null;

  if (mode.k === "incoming") return <IncomingCall caller={mode.caller} video={mode.video} onAccept={accept} onDecline={decline} />;
  if (mode.k === "outgoing") return <OutgoingCall peer={mode.peer} caption={mode.caption} video={mode.video} onCancel={cancelOutgoing} />;
  // mode.k === "call"
  return (
    <Suspense fallback={null}>
      <CallRoom connection={mode.conn} title={mode.title} startWithVideo={mode.video} onClose={endCall} />
    </Suspense>
  );
}
