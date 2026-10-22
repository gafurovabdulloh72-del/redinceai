"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useChat,
  useIsSpeaking,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useParticipantAttributes,
  useParticipants,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { DisconnectReason, Room, Track, type Participant } from "livekit-client";
import { Hand, Loader2, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Send, SwitchCamera, UserX, Users, Video, VideoOff, X, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/components/motion/useScrollLock";

type Conn = { url: string; token: string; host: boolean; hostId: string; title: string };
type Panel = "chat" | "people" | null;

const nameOf = (p: Participant) => p.name || "Ishtirokchi";

/**
 * Jonli efir (Zoom uslubida): markazda boshlovchi/ekran, pastda sahnadagi ishtirokchilar lentasi,
 * pastki boshqaruv paneli (mikrofon · kamera · ekran · qo'l · ishtirokchilar · chat · chiqish),
 * yon panel: chat va ishtirokchilar ro'yxati (boshlovchi: gapirishga ruxsat / chiqarish).
 * Portal (z-135) — sahifa ichida `fixed` transform tuzog'iga tushmaydi.
 */
export function LiveRoomOverlay({ streamId, onClose }: { streamId: string; onClose: () => void }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [error, setError] = useState("");
  const [bye, setBye] = useState("");
  const [note, setNote] = useState("");
  // Xabarlar efir oynasi ichida (umumiy toast boshqaruv tugmalarini to'sib qo'yardi)
  const flash = useCallback((t: string) => {
    setNote(t);
    window.setTimeout(() => setNote(""), 4500);
  }, []);
  const peak = useRef(0);
  const closed = useRef(false);
  useScrollLock(true);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/live/${streamId}/token`, { method: "POST" })
      .then(async (r) => {
        const j = (await r.json()) as { data?: Conn; error?: string };
        if (!alive) return;
        if (!r.ok || !j.data) setError(j.error || "Efirga ulanib bo'lmadi");
        else setConn(j.data);
      })
      .catch(() => alive && setError("Tarmoq xatosi"));
    return () => {
      alive = false;
    };
  }, [streamId]);

  const leave = useCallback(
    async (endStream: boolean) => {
      if (closed.current) return;
      closed.current = true;
      if (endStream) await fetch(`/api/live/${streamId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ peak: peak.current }) }).catch(() => undefined);
      onClose();
    },
    [streamId, onClose],
  );

  function onDisconnected(reason?: DisconnectReason) {
    if (closed.current) return;
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) return setBye("Boshlovchi sizni efirdan chiqardi");
    if (reason === DisconnectReason.ROOM_DELETED) {
      if (conn?.host) void leave(false);
      else setBye("Efir tugadi");
      return;
    }
    void leave(Boolean(conn?.host));
  }

  if (typeof document === "undefined") return null;
  const msg = error || bye;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Jonli efir" className="fixed inset-0 z-[135] bg-[#0b0b0d] text-white" data-theme="dark">
      {msg ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="text-[16px] font-semibold">{msg}</p>
            <button type="button" className="btn-accent mt-4 h-10 px-5" onClick={() => void leave(false)}>
              Yopish
            </button>
          </div>
        </div>
      ) : !conn ? (
        <div className="grid h-full place-items-center">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <LiveKitRoom serverUrl={conn.url} token={conn.token} connect video={conn.host} audio={conn.host} onDisconnected={onDisconnected} onMediaDeviceFailure={() => flash("Kamera yoki mikrofonga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering")} className="absolute inset-0">
          <Stage conn={conn} streamId={streamId} flash={flash} peak={peak} onLeave={() => void leave(false)} onEnd={() => void leave(true)} />
          <RoomAudioRenderer />
          {note && (
            <p role="status" className="pointer-events-none absolute inset-x-4 top-14 z-20 mx-auto w-fit max-w-[90%] rounded-xl bg-white px-4 py-2.5 text-center text-[13.5px] font-semibold text-black shadow-lg">
              {note}
            </p>
          )}
        </LiveKitRoom>
      )}
    </div>,
    document.body,
  );
}

function Initial({ name, size = 64 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="grid place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 45% 38%)` }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Bitta tomosha katagi: video yoki bosh harf, ism, ovoz holati, gapirganda yashil kontur */
function Tile({ tref, small, onPin, pinned }: { tref: TrackReferenceOrPlaceholder; small?: boolean; onPin?: () => void; pinned?: boolean }) {
  const p = tref.participant;
  const speaking = useIsSpeaking(p);
  const { attributes } = useParticipantAttributes({ participant: p });
  const hasVideo = isTrackReference(tref) && !tref.publication.isMuted;
  const isScreen = tref.source === Track.Source.ScreenShare;
  return (
    <div
      onClick={onPin}
      className={cn("relative overflow-hidden rounded-xl bg-[#17171a] transition-shadow", small ? "h-full w-[150px] shrink-0 cursor-pointer sm:w-[176px]" : "h-full w-full", speaking && "ring-[3px] ring-success", pinned && "ring-2 ring-white/70")}
    >
      {hasVideo ? (
        <VideoTrack trackRef={tref} className={cn("h-full w-full", isScreen || !small ? "object-contain" : "object-cover")} />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Initial name={nameOf(p)} size={small ? 44 : 88} />
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[90%] items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[12px] font-medium backdrop-blur">
        {!p.isMicrophoneEnabled && <MicOff size={11} className="shrink-0 text-danger" />}
        <span className="truncate">{nameOf(p)}{p.isLocal ? " (siz)" : ""}{isScreen ? " — ekran" : ""}</span>
      </span>
      {attributes?.hand === "1" && <Hand size={16} className="absolute right-2 top-2 text-[#ffcf40]" />}
    </div>
  );
}

function Stage({ conn, streamId, flash, peak, onLeave, onEnd }: { conn: Conn; streamId: string; flash: (t: string) => void; peak: React.MutableRefObject<number>; onLeave: () => void; onEnd: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const perms = useLocalParticipantPermissions();
  const canPublish = Boolean(perms?.canPublish);
  const everyone = useParticipants();
  const { attributes: myAttrs } = useParticipantAttributes({ participant: localParticipant });
  const handUp = myAttrs?.hand === "1";
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const { chatMessages, send, isSending } = useChat();

  const [panel, setPanel] = useState<Panel>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [cams, setCams] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const wasStage = useRef(canPublish);
  const canShare = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  // Keng ekranda chat avtomatik ochiq
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setPanel("chat");
  }, []);
  useEffect(() => {
    peak.current = Math.max(peak.current, everyone.length - 1);
  }, [everyone.length, peak]);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages.length, panel]);
  // Sahnaga chiqarilganda / tushirilganda xabar
  useEffect(() => {
    if (!conn.host && canPublish !== wasStage.current) {
      flash(canPublish ? "Boshlovchi sizga gapirishga ruxsat berdi — mikrofonni yoqing" : "Sahnadan tushirildingiz");
      if (!canPublish) void localParticipant.setAttributes({ hand: "" }).catch(() => undefined);
    }
    wasStage.current = canPublish;
  }, [canPublish, conn.host, localParticipant, flash]);
  useEffect(() => {
    if (!canPublish) return;
    let alive = true;
    void Room.getLocalDevices("videoinput").then((d) => alive && setCams(d.length)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [canPublish, isCameraEnabled]);
  // Telefon ekrani o'chib qolmasin
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const ask = () => void navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    ask();
    const vis = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Sahnadagi kataklar: kamera (publish huquqi borlar) + ekran ulashish
  const stageTiles = tracks.filter((t) => (t.source === Track.Source.ScreenShare ? isTrackReference(t) && !t.publication.isMuted : Boolean(t.participant.permissions?.canPublish) || t.participant.identity === conn.hostId));
  const screen = stageTiles.find((t) => t.source === Track.Source.ScreenShare);
  const hostTile = stageTiles.find((t) => t.participant.identity === conn.hostId && t.source === Track.Source.Camera);
  const keyOf = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}:${t.source}`;
  const pinned = pin ? stageTiles.find((t) => keyOf(t) === pin) : undefined;
  const main = pinned ?? screen ?? hostTile ?? stageTiles[0];
  const strip = stageTiles.filter((t) => t !== main);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const toggle = (on: boolean, fn: (v: boolean) => Promise<unknown>) => void fn(!on).catch(() => flash("Ruxsat berilmadi — brauzer sozlamalarini tekshiring"));

  async function flip() {
    try {
      const list = await Room.getLocalDevices("videoinput");
      if (list.length < 2) return;
      const cur = localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack.getSettings().deviceId;
      const i = list.findIndex((d) => d.deviceId === cur);
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setCameraEnabled(true, { deviceId: list[(i + 1) % list.length].deviceId });
    } catch {
      flash("Kamerani almashtirib bo'lmadi");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await send(t).catch(() => undefined);
  }

  const raisedCount = everyone.filter((p) => p.attributes?.hand === "1").length;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Yuqori panel */}
      <header className="flex items-center gap-2 px-3 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-danger px-2 py-1 text-[11px] font-bold uppercase tracking-wider">
          <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-white" /> Jonli
        </span>
        <span className="text-[12.5px] tabular-nums text-white/65">{mm}:{ss}</span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{conn.title}</p>
        <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[12px] font-semibold tabular-nums">
          <Users size={12} /> {everyone.length}
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-2 px-2 lg:px-3">
        {/* Sahna */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-1">
            {main ? (
              <Tile tref={main} pinned={Boolean(pinned)} onPin={pinned ? () => setPin(null) : undefined} />
            ) : (
              <div className="grid h-full place-items-center rounded-xl bg-[#17171a] px-6 text-center text-white/65">
                <p className="text-[15px]">{conn.host ? "Kamerangiz yoqilmoqda…" : "Boshlovchi hozircha kamerani yoqmagan"}</p>
              </div>
            )}
          </div>
          {strip.length > 0 && (
            <div className="flex h-[92px] gap-2 overflow-x-auto sm:h-[108px]">
              {strip.map((t) => (
                <Tile key={keyOf(t)} tref={t} small onPin={() => setPin(keyOf(t))} />
              ))}
            </div>
          )}
        </div>

        {/* Yon panel: chat / ishtirokchilar (telefonda pastdan varaq) */}
        {panel && (
          <aside className="absolute inset-x-2 bottom-2 z-10 flex h-[62%] flex-col overflow-hidden rounded-2xl bg-[#17171a] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] lg:static lg:h-auto lg:w-[340px] lg:shrink-0 lg:shadow-none">
            <div className="flex items-center gap-1 border-b border-white/10 p-2">
              {(["chat", "people"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPanel(k)} className={cn("h-8 rounded-lg px-3 text-[13px] font-semibold", panel === k ? "bg-white/15" : "text-white/60 hover:text-white")}>
                  {k === "chat" ? "Chat" : `Ishtirokchilar ${everyone.length}`}
                </button>
              ))}
              <button type="button" aria-label="Yopish" onClick={() => setPanel(null)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            {panel === "chat" ? (
              <>
                <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[13.5px]">
                  {chatMessages.length === 0 && <li className="py-6 text-center text-white/45">Savol yoki fikringizni yozing</li>}
                  {chatMessages.map((m, i) => (
                    <li key={i} className="leading-snug">
                      <span className="font-semibold text-white/60">{m.from?.name || "…"}: </span>
                      <span className="break-words">{m.message}</span>
                    </li>
                  ))}
                </ul>
                <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-2.5">
                  <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Xabar yozing…" aria-label="Efir chati" className="h-10 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[14px] text-white outline-none placeholder:text-white/40 focus:bg-white/15" />
                  <button type="submit" disabled={isSending || !text.trim()} aria-label="Yuborish" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
                {[...everyone]
                  .sort((a, b) => Number(b.identity === conn.hostId) - Number(a.identity === conn.hostId) || Number(b.attributes?.hand === "1") - Number(a.attributes?.hand === "1"))
                  .map((p) => (
                    <PersonRow key={p.identity} p={p} hostId={conn.hostId} iAmHost={conn.host} streamId={streamId} flash={flash} />
                  ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {/* Pastki boshqaruv paneli */}
      <footer className="flex items-center justify-center gap-1.5 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 sm:gap-3">
        {canPublish && (
          <>
            <Btn label={isMicrophoneEnabled ? "O'chirish" : "Mikrofon"} on={isMicrophoneEnabled} off={!isMicrophoneEnabled} onClick={() => toggle(isMicrophoneEnabled, (v) => localParticipant.setMicrophoneEnabled(v))}>
              {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </Btn>
            <Btn label="Kamera" on={isCameraEnabled} off={!isCameraEnabled} onClick={() => toggle(isCameraEnabled, (v) => localParticipant.setCameraEnabled(v))}>
              {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </Btn>
            {cams > 1 && isCameraEnabled && (
              <Btn label="Almashtirish" onClick={() => void flip()}>
                <SwitchCamera size={20} />
              </Btn>
            )}
            {canShare && (
              <Btn label="Ekran" on={isScreenShareEnabled} accent={isScreenShareEnabled} onClick={() => toggle(isScreenShareEnabled, (v) => localParticipant.setScreenShareEnabled(v))}>
                {isScreenShareEnabled ? <Presentation size={20} /> : <MonitorUp size={20} />}
              </Btn>
            )}
          </>
        )}
        {!conn.host && (
          <Btn label={handUp ? "Tushirish" : "Qo'l"} accent={handUp} onClick={() => void localParticipant.setAttributes({ hand: handUp ? "" : "1" }).catch(() => undefined)}>
            <Hand size={20} />
          </Btn>
        )}
        <Btn label="Odamlar" on={panel === "people"} badge={conn.host ? raisedCount : 0} onClick={() => setPanel(panel === "people" ? null : "people")}>
          <Users size={20} />
        </Btn>
        <Btn label="Chat" on={panel === "chat"} onClick={() => setPanel(panel === "chat" ? null : "chat")}>
          <MessageSquare size={20} />
        </Btn>
        <button type="button" onClick={conn.host ? onEnd : onLeave} className="ml-1 inline-flex h-12 items-center gap-2 rounded-full bg-danger px-4 text-[13.5px] font-bold sm:px-5">
          <PhoneOff size={18} /> <span className="max-sm:hidden">{conn.host ? "Efirni tugatish" : "Chiqish"}</span>
        </button>
      </footer>
    </div>
  );
}

function PersonRow({ p, hostId, iAmHost, streamId, flash }: { p: Participant; hostId: string; iAmHost: boolean; streamId: string; flash: (t: string) => void }) {
  const { attributes } = useParticipantAttributes({ participant: p });
  const [busy, setBusy] = useState(false);
  const isHost = p.identity === hostId;
  const onStage = Boolean(p.permissions?.canPublish);
  const hand = attributes?.hand === "1";

  async function act(action: "kick" | "allow" | "revoke") {
    setBusy(true);
    try {
      const r = await fetch(`/api/live/${streamId}/participants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: p.identity, action }) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Xatolik");
      if (action === "kick") flash(`${nameOf(p)} efirdan chiqarildi`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      <Initial name={nameOf(p)} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">{nameOf(p)}{p.isLocal ? " (siz)" : ""}</p>
        <p className="text-[11.5px] text-white/50">{isHost ? "Boshlovchi" : onStage ? "Sahnada" : "Tomoshabin"}</p>
      </div>
      {hand && <Hand size={16} className="text-[#ffcf40]" aria-label="Qo'l ko'tardi" />}
      {onStage ? (p.isMicrophoneEnabled ? <Mic size={14} className="text-white/60" /> : <MicOff size={14} className="text-danger" />) : null}
      {iAmHost && !isHost && !p.isLocal && (
        <div className="flex gap-1">
          <button type="button" disabled={busy} onClick={() => void act(onStage ? "revoke" : "allow")} className={cn("h-8 rounded-lg px-2.5 text-[12px] font-semibold", onStage ? "bg-white/10" : hand ? "bg-accent text-white" : "bg-white/10")}>
            {onStage ? "Tushirish" : "Gapirsin"}
          </button>
          <button type="button" disabled={busy} onClick={() => void act("kick")} aria-label="Efirdan chiqarish" title="Efirdan chiqarish" className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-danger hover:bg-danger hover:text-white">
            <UserX size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

function Btn({ label, onClick, children, on, off, accent, badge }: { label: string; onClick: () => void; children: React.ReactNode; on?: boolean; off?: boolean; accent?: boolean; badge?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={on} className="group relative flex w-[54px] flex-col items-center gap-1 outline-none sm:w-[62px]">
      <span className={cn("grid h-11 w-11 place-items-center rounded-full transition group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-white/60", accent ? "bg-accent text-white" : off ? "bg-danger/90 text-white" : on ? "bg-white text-black" : "bg-white/12 text-white")}>{children}</span>
      <span className="text-[10.5px] font-medium text-white/65">{label}</span>
      {badge ? <span className="absolute right-1 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold">{badge}</span> : null}
    </button>
  );
}
