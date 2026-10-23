"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useChat,
  useConnectionQualityIndicator,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useLocalParticipantPermissions,
  useParticipantAttributes,
  useParticipants,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionQuality, ConnectionState, DisconnectReason, Room, RoomOptions, Track, VideoPresets, type Participant } from "livekit-client";
import { Circle, Hand, HelpCircle, Loader2, Signal, SignalLow, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Pencil, Send, Sparkles, SwitchCamera, SlidersHorizontal, UserX, Users, Video, VideoOff, X, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { LiveQA } from "./LiveQA";
import { LiveGate, type Gate } from "./LiveGate";
import { ReactionButton, ReactionLayer, useLiveReactions } from "./LiveReactions";
import { CaptionBar, CaptionButton, captionsSupported, useLiveCaptions } from "./LiveCaptions";
import { LiveWhiteboard } from "./LiveWhiteboard";
import { CohostToggle, HostTools } from "./LiveHostTools";
import { useVirtualBg, type BgMode } from "./useVirtualBg";

type Conn = {
  url: string;
  token: string;
  host: boolean;
  /** Boshlovchi yoki hammuallif — moderatsiya va gapirish huquqi */
  moderator: boolean;
  hostId: string;
  title: string;
  recording?: string;
  canRecord?: boolean;
  /** Kichik xonada bo'lsa — xona nomi */
  breakout: string | null;
  waitingRoom: boolean;
  hasPasscode: boolean;
  /** Faqat boshqaruvchiga: amaldagi kod */
  passcode?: string | null;
  breakoutOpen: boolean;
  startedAt: number;
};
type TokenResp = (Conn & { gate: "open" }) | { gate: Gate; title: string };
type Panel = "chat" | "people" | "qa" | "host" | null;
type HostTab = "navbat" | "xonalar" | "davomat" | "kirish";
type Devices = { video: boolean; audio: boolean; videoId?: string; audioId?: string };

/**
 * Sifat: kuchli kompyuterda 1080p/30 (4.5 Mbit/s) + simulcast (720p/360p); telefon va kuchsiz qurilmada 720p/30 (2.2 Mbit/s) + 360p —
 * kodlash CPU'ni bo'g'ib uzilishga olib kelmasin. Ekran ulashish 5 Mbit/s. Ovoz DTX. Tomoshabinda adaptiveStream — ko'rinmagan/kichik katak trafik yemaydi.
 */
function roomOptions(): RoomOptions {
  const strong = typeof navigator !== "undefined" && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && (navigator.hardwareConcurrency ?? 4) >= 8;
  return {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: (strong ? VideoPresets.h1080 : VideoPresets.h720).resolution, facingMode: "user" },
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    publishDefaults: {
      simulcast: true,
      videoEncoding: strong ? { maxBitrate: 4_500_000, maxFramerate: 30 } : { maxBitrate: 2_200_000, maxFramerate: 30 },
      videoSimulcastLayers: strong ? [VideoPresets.h720, VideoPresets.h360] : [VideoPresets.h360],
      screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 30 },
      dtx: true,
    },
  };
}

const nameOf = (p: Participant) => p.name || "Ishtirokchi";

/**
 * Jonli efir (Zoom uslubida): markazda boshlovchi/ekran, pastda sahnadagi ishtirokchilar lentasi,
 * pastki boshqaruv paneli (mikrofon · kamera · ekran · qo'l · ishtirokchilar · chat · chiqish),
 * yon panel: chat va ishtirokchilar ro'yxati (boshlovchi: gapirishga ruxsat / chiqarish).
 * Portal (z-135) — sahifa ichida `fixed` transform tuzog'iga tushmaydi.
 */
export function LiveRoomOverlay({ streamId, onClose }: { streamId: string; onClose: () => void }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [gate, setGate] = useState<{ gate: Gate; title: string } | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [bye, setBye] = useState("");
  const [note, setNote] = useState("");
  const [dev, setDev] = useState<Devices | null>(null);
  const options = useMemo(roomOptions, []);
  // Xabarlar efir oynasi ichida (umumiy toast boshqaruv tugmalarini to'sib qo'yardi)
  const flash = useCallback((t: string) => {
    setNote(t);
    window.setTimeout(() => setNote(""), 4500);
  }, []);
  const peak = useRef(0);
  const closed = useRef(false);
  useScrollLock(true);

  /**
   * Tokenni so'rash. Darvoza (kod/kutish xonasi) yopiq bo'lsa `gate` qo'yiladi, token berilmaydi.
   * Kichik xonaga ko'chirilganda ham aynan shu chaqiriq ishlaydi — yangi xona tokeni keladi.
   */
  const connect = useCallback(
    async (passcode?: string, silent = false): Promise<boolean> => {
      setGateBusy(true);
      try {
        const r = await fetch(`/api/live/${streamId}/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode }) });
        const j = (await r.json().catch(() => ({}))) as { data?: TokenResp; error?: string };
        if (!r.ok || !j.data) {
          if (!silent) setError(j.error || "Efirga ulanib bo'lmadi");
          return false;
        }
        if (j.data.gate !== "open") {
          setGate({ gate: j.data.gate, title: j.data.title });
          setConn(null);
          return false;
        }
        setGate(null);
        setConn(j.data);
        return true;
      } catch {
        if (!silent) setError("Tarmoq xatosi");
        return false;
      } finally {
        setGateBusy(false);
      }
    },
    [streamId],
  );

  useEffect(() => {
    void connect();
  }, [connect]);

  const leave = useCallback(
    async (endStream: boolean) => {
      if (closed.current) return;
      closed.current = true;
      if (endStream) await fetch(`/api/live/${streamId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ peak: peak.current }) }).catch(() => undefined);
      onClose();
    },
    [streamId, onClose],
  );

  /**
   * Uzilish: xona o'chirilgan yoki chiqarib yuborilgan bo'lsa tokenni qayta so'raymiz —
   * kichik xonaga ko'chirish ham xuddi shunday ko'rinadi (yangi token → yangi xona).
   * Token kelmasa haqiqiy sabab ko'rsatiladi.
   */
  function onDisconnected(reason?: DisconnectReason) {
    if (closed.current) return;
    if (reason === DisconnectReason.PARTICIPANT_REMOVED || reason === DisconnectReason.ROOM_DELETED) {
      if (conn?.host && reason === DisconnectReason.ROOM_DELETED) return void leave(false);
      setMoving(true);
      void connect(undefined, true).then((okNow) => {
        setMoving(false);
        if (!okNow) setBye(reason === DisconnectReason.PARTICIPANT_REMOVED ? "Boshlovchi sizni efirdan chiqardi" : "Efir tugadi");
      });
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
      ) : gate ? (
        <LiveGate gate={gate.gate} title={gate.title} busy={gateBusy} onRetry={(code) => void connect(code, true)} onClose={() => void leave(false)} />
      ) : !conn || moving ? (
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <Loader2 className="mx-auto animate-spin" />
            {moving && <p className="mt-3 text-[13.5px] text-white/60">Xonaga ko&apos;chirilmoqda…</p>}
          </div>
        </div>
      ) : conn.host && !dev ? (
        <PreJoin title={conn.title} onCancel={() => void leave(true)} onReady={setDev} />
      ) : (
        <LiveKitRoom key={conn.token.slice(-28)} serverUrl={conn.url} token={conn.token} connect options={options} video={conn.host && dev?.video ? { deviceId: dev.videoId } : false} audio={conn.host && dev?.audio ? { deviceId: dev.audioId } : false} onDisconnected={onDisconnected} onMediaDeviceFailure={() => flash("Kamera yoki mikrofonga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering")} className="absolute inset-0">
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
        <VideoTrack trackRef={tref} className={cn("h-full w-full", isScreen || !small ? "object-contain" : "object-cover", p.isLocal && !isScreen && "-scale-x-100")} />
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

  const connection = useConnectionState();
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const [rec, setRec] = useState(conn.recording === "recording");
  const [panel, setPanel] = useState<Panel>(null);
  const [hostTab, setHostTab] = useState<HostTab>("navbat");
  const [pin, setPin] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<{ id: string; name: string; body: string }[]>([]);
  const [cams, setCams] = useState(0);
  // Zoom qo'shimchalari
  const [cohosts, setCohosts] = useState<string[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [rules, setRules] = useState({ waitingRoom: conn.waitingRoom, passcode: conn.passcode ?? null });
  const [breakoutOpen, setBreakoutOpen] = useState(conn.breakoutOpen);
  const [board, setBoard] = useState(false);
  const [bgMenu, setBgMenu] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const wasStage = useRef(canPublish);
  const canShare = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const { items: reactions, react } = useLiveReactions();
  const caps = useLiveCaptions({ streamId, speak: canPublish, startedAt: conn.startedAt });
  const bg = useVirtualBg(localParticipant, flash);
  const canDrawBoard = conn.moderator || canPublish;

  // Chat tarixi (kech kirganlar oldingi xabarlarni ko'radi)
  useEffect(() => {
    let alive = true;
    void fetch(`/api/live/${streamId}/chat`)
      .then((r) => r.json())
      .then((j: { data?: { items: { id: string; name: string; body: string }[] } }) => alive && setHistory(j.data?.items ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [streamId]);
  // Keng ekranda chat avtomatik ochiq
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setPanel("chat");
  }, []);
  // Hammuallif ro'yxati (ro'yxatdagi belgilar uchun)
  useEffect(() => {
    let alive = true;
    void fetch(`/api/live/${streamId}/hammuallif`)
      .then((r) => r.json())
      .then((j: { data?: { items: string[] } }) => alive && setCohosts(j.data?.items ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [streamId]);
  // Davomat: har 60 s «tirik» signal (brauzer yopilsa oxirgi signal chiqish vaqti bo'ladi)
  useEffect(() => {
    const ping = () => void fetch(`/api/live/${streamId}/davomat`, { method: "POST", keepalive: true }).catch(() => undefined);
    const t = window.setInterval(ping, 60_000);
    return () => {
      window.clearInterval(t);
      ping();
    };
  }, [streamId]);
  // Navbatdagilar soni (boshqaruvchi panelni ochmasa ham belgi ko'rinadi)
  useEffect(() => {
    if (!conn.moderator || !rules.waitingRoom) return;
    let alive = true;
    const load = () =>
      void fetch(`/api/live/${streamId}/navbat`)
        .then((r) => r.json())
        .then((j: { data?: { items: unknown[] } }) => alive && setWaitingCount(j.data?.items.length ?? 0))
        .catch(() => undefined);
    load();
    const t = window.setInterval(load, 8000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [streamId, conn.moderator, rules.waitingRoom]);
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
  }, [chatMessages.length, history.length, panel]);
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

  async function startRec() {
    try {
      const r = await fetch(`/api/live/${streamId}/recording`, { method: "POST" });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Xatolik");
      setRec(true);
      flash("Yozib olish boshlandi — efir tugagach yozuv ustoz bo'limida paydo bo'ladi");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Yozib olib bo'lmadi");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    // Tarixga yozish (taqiqlangan bo'lsa server rad etadi) + realtime LiveKit data kanali
    const saved = await fetch(`/api/live/${streamId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: t }) }).catch(() => null);
    if (saved && !saved.ok) return flash("Xabar yuborilmadi");
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
        {rec && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-danger">
            <Circle size={8} fill="currentColor" className="animate-ping-soft" /> Yozilmoqda
          </span>
        )}
        <span className="text-[12.5px] tabular-nums text-white/65">{mm}:{ss}</span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{conn.title}</p>
        {(quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#ffcf40]/15 px-2 py-1 text-[11.5px] font-semibold text-[#ffcf40]" title="Internet sekin — sifat avtomatik pasayadi">
            <SignalLow size={12} /> Aloqa sust
          </span>
        )}
        {conn.breakout && <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11.5px] font-semibold">{conn.breakout}</span>}
        <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[12px] font-semibold tabular-nums">
          <Users size={12} /> {everyone.length}
        </span>
      </header>

      {connection === ConnectionState.Reconnecting && (
        <p role="status" className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-lg bg-[#ffcf40] px-3 py-1.5 text-[13px] font-semibold text-black">
          <Loader2 size={14} className="animate-spin" /> Qayta ulanmoqda…
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 gap-2 px-2 lg:px-3">
        {/* Sahna */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative min-h-0 flex-1">
            {main ? (
              <Tile tref={main} pinned={Boolean(pinned)} onPin={pinned ? () => setPin(null) : undefined} />
            ) : (
              <div className="grid h-full place-items-center rounded-xl bg-[#17171a] px-6 text-center text-white/65">
                <p className="text-[15px]">{conn.host ? "Kamerangiz yoqilmoqda…" : "Boshlovchi hozircha kamerani yoqmagan"}</p>
              </div>
            )}
            {/* Uchayotgan reaksiyalar · subtitr · umumiy doska — sahna ustida */}
            <ReactionLayer items={reactions} />
            {caps.on && <CaptionBar line={caps.line} />}
            {board && <LiveWhiteboard canDraw={canDrawBoard} onClose={() => setBoard(false)} />}
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
            {panel === "host" ? (
              <HostTools
                streamId={streamId}
                tab={hostTab}
                setTab={setHostTab}
                waitingCount={waitingCount}
                waitingRoom={rules.waitingRoom}
                passcode={rules.passcode}
                breakoutOpen={breakoutOpen}
                viewerIds={everyone.filter((p) => p.identity !== conn.hostId).map((p) => p.identity)}
                flash={flash}
                onRules={setRules}
                onBreakoutOpen={setBreakoutOpen}
                onWaitingCount={setWaitingCount}
                onClose={() => setPanel(null)}
              />
            ) : (
              <>
            <div className="flex items-center gap-1 border-b border-white/10 p-2">
              {(["chat", "qa", "people"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPanel(k)} className={cn("h-8 rounded-lg px-3 text-[13px] font-semibold", panel === k ? "bg-white/15" : "text-white/60 hover:text-white")}>
                  {k === "chat" ? "Chat" : k === "qa" ? "Savollar" : `Odamlar ${everyone.length}`}
                </button>
              ))}
              <button type="button" aria-label="Yopish" onClick={() => setPanel(null)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            {panel === "chat" ? (
              <>
                <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[13.5px]">
                  {chatMessages.length + history.length === 0 && <li className="py-6 text-center text-white/45">Savol yoki fikringizni yozing</li>}
                  {history.map((m) => (
                    <li key={m.id} className="leading-snug opacity-80">
                      <span className="font-semibold text-white/60">{m.name}: </span>
                      <span className="break-words">{m.body}</span>
                    </li>
                  ))}
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
            ) : panel === "qa" ? (
              <LiveQA streamId={streamId} isHost={conn.host} flash={flash} />
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
                {[...everyone]
                  .sort((a, b) => Number(b.identity === conn.hostId) - Number(a.identity === conn.hostId) || Number(b.attributes?.hand === "1") - Number(a.attributes?.hand === "1"))
                  .map((p) => (
                    <PersonRow
                      key={p.identity}
                      p={p}
                      hostId={conn.hostId}
                      iAmHost={conn.moderator}
                      canAssignCohost={conn.host}
                      isCohost={cohosts.includes(p.identity)}
                      onCohost={(on) => setCohosts((l) => (on ? [...l, p.identity] : l.filter((x) => x !== p.identity)))}
                      streamId={streamId}
                      flash={flash}
                    />
                  ))}
              </ul>
            )}
              </>
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
            {bg.supported && (
              <div className="relative">
                {bgMenu && <BgMenu mode={bg.mode} busy={bg.busy} onPick={(m) => void bg.apply(m)} onClose={() => setBgMenu(false)} />}
                <Btn label="Fon" on={bg.mode !== "off"} onClick={() => setBgMenu((o) => !o)}>
                  <Sparkles size={20} />
                </Btn>
              </div>
            )}
          </>
        )}
        {conn.host && conn.canRecord && !rec && (
          <Btn label="Yozish" onClick={() => void startRec()}>
            <Circle size={20} className="text-danger" fill="currentColor" />
          </Btn>
        )}
        {!conn.host && (
          <Btn label={handUp ? "Tushirish" : "Qo'l"} accent={handUp} onClick={() => void localParticipant.setAttributes({ hand: handUp ? "" : "1" }).catch(() => undefined)}>
            <Hand size={20} />
          </Btn>
        )}
        <ReactionButton react={react} />
        {captionsSupported() && <CaptionButton on={caps.on} onToggle={() => caps.setOn(!caps.on)} />}
        <Btn label="Doska" on={board} accent={board} onClick={() => setBoard(!board)}>
          <Pencil size={20} />
        </Btn>
        <Btn label="Odamlar" on={panel === "people"} badge={conn.moderator ? raisedCount : 0} onClick={() => setPanel(panel === "people" ? null : "people")}>
          <Users size={20} />
        </Btn>
        <Btn label="Savollar" on={panel === "qa"} onClick={() => setPanel(panel === "qa" ? null : "qa")}>
          <HelpCircle size={20} />
        </Btn>
        <Btn label="Chat" on={panel === "chat"} onClick={() => setPanel(panel === "chat" ? null : "chat")}>
          <MessageSquare size={20} />
        </Btn>
        {conn.moderator && (
          <Btn label="Boshqaruv" on={panel === "host"} badge={waitingCount} onClick={() => setPanel(panel === "host" ? null : "host")}>
            <SlidersHorizontal size={20} />
          </Btn>
        )}
        <button type="button" onClick={conn.host ? onEnd : onLeave} className="ml-1 inline-flex h-12 items-center gap-2 rounded-full bg-danger px-4 text-[13.5px] font-bold sm:px-5">
          <PhoneOff size={18} /> <span className="max-sm:hidden">{conn.host ? "Efirni tugatish" : "Chiqish"}</span>
        </button>
      </footer>
    </div>
  );
}

function PersonRow({ p, hostId, iAmHost, canAssignCohost, isCohost, onCohost, streamId, flash }: { p: Participant; hostId: string; iAmHost: boolean; canAssignCohost: boolean; isCohost: boolean; onCohost: (on: boolean) => void; streamId: string; flash: (t: string) => void }) {
  const { attributes } = useParticipantAttributes({ participant: p });
  const [busy, setBusy] = useState(false);
  const isHost = p.identity === hostId;
  const onStage = Boolean(p.permissions?.canPublish);
  const hand = attributes?.hand === "1";

  async function act(action: "kick" | "allow" | "revoke" | "mute") {
    setBusy(true);
    try {
      const r = await fetch(`/api/live/${streamId}/participants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: p.identity, action, trackSid: action === "mute" ? p.getTrackPublication(Track.Source.Microphone)?.trackSid : undefined }) });
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
        <p className="text-[11.5px] text-white/50">{isHost ? "Boshlovchi" : isCohost ? "Hammuallif" : onStage ? "Sahnada" : "Tomoshabin"}</p>
      </div>
      {hand && <Hand size={16} className="text-[#ffcf40]" aria-label="Qo'l ko'tardi" />}
      {onStage ? (p.isMicrophoneEnabled ? <Mic size={14} className="text-white/60" /> : <MicOff size={14} className="text-danger" />) : null}
      {iAmHost && !isHost && !p.isLocal && (
        <div className="flex gap-1">
          {canAssignCohost && <CohostToggle streamId={streamId} userId={p.identity} on={isCohost} flash={flash} onToggle={onCohost} />}
          {onStage && p.isMicrophoneEnabled && (
            <button type="button" disabled={busy} onClick={() => void act("mute")} aria-label="Mikrofonni o'chirish" title="Mikrofonni o'chirish" className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20">
              <MicOff size={14} />
            </button>
          )}
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


/** Virtual fon menyusi: o'chiq · bulutlash · kuchli bulutlash (MediaPipe segmentatsiyasi) */
function BgMenu({ mode, busy, onPick, onClose }: { mode: BgMode; busy: boolean; onPick: (m: BgMode) => void; onClose: () => void }) {
  const items: [BgMode, string][] = [
    ["off", "O'chiq"],
    ["blur", "Bulutlash"],
    ["blur-strong", "Kuchli bulutlash"],
  ];
  return (
    <div className="absolute bottom-full left-1/2 mb-2 w-[172px] -translate-x-1/2 rounded-xl bg-[#1f1f23] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.6)]" role="menu" aria-label="Virtual fon">
      {items.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => {
            onPick(k);
            onClose();
          }}
          className={cn("flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-semibold transition disabled:opacity-50", mode === k ? "bg-white/15" : "hover:bg-white/10")}
        >
          {busy && mode !== k ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className={mode === k ? "text-accent" : "text-white/50"} />}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Boshlovchi uchun efirdan oldingi oyna: kamera ko'rinishi, qurilma tanlash, mikrofon/kamerani yoqish-o'chirish */
function PreJoin({ title, onReady, onCancel }: { title: string; onReady: (d: Devices) => void; onCancel: () => void }) {
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>();
  const [micId, setMicId] = useState<string>();
  const [err, setErr] = useState("");
  const ref = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    let alive = true;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (!video) return;
    void navigator.mediaDevices
      .getUserMedia({ video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
      .then(async (st) => {
        if (!alive) return st.getTracks().forEach((t) => t.stop());
        stream.current = st;
        if (ref.current) ref.current.srcObject = st;
        setErr("");
        const list = await navigator.mediaDevices.enumerateDevices();
        setCams(list.filter((d) => d.kind === "videoinput"));
        setMics(list.filter((d) => d.kind === "audioinput"));
      })
      .catch(() => alive && setErr("Kameraga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering yoki kamerasiz davom eting"));
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [video, camId]);

  // Mikrofon ro'yxati kamera o'chiq bo'lsa ham kerak
  useEffect(() => {
    if (video) return;
    void navigator.mediaDevices.enumerateDevices().then((l) => setMics(l.filter((d) => d.kind === "audioinput"))).catch(() => undefined);
  }, [video]);

  function go() {
    stream.current?.getTracks().forEach((t) => t.stop());
    onReady({ video, audio, videoId: camId, audioId: micId });
  }

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-4">
      <div className="w-full max-w-[560px]">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-white/50">Efirga tayyorlanish</p>
        <h2 className="mt-1 text-center text-[20px] font-bold">{title}</h2>
        <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl bg-[#17171a]">
          {video && !err ? <video ref={ref} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center px-6 text-center text-[13.5px] text-white/60">{err || "Kamera o'chiq"}</div>}
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-3">
            <Btn label="Mikrofon" on={audio} off={!audio} onClick={() => setAudio(!audio)}>
              {audio ? <Mic size={20} /> : <MicOff size={20} />}
            </Btn>
            <Btn label="Kamera" on={video} off={!video} onClick={() => setVideo(!video)}>
              {video ? <Video size={20} /> : <VideoOff size={20} />}
            </Btn>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select value={camId ?? ""} onChange={(e) => setCamId(e.target.value || undefined)} aria-label="Kamera" className="h-10 rounded-lg bg-white/10 px-3 text-[13.5px] text-white outline-none">
            <option value="">Kamera (standart)</option>
            {cams.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || `Kamera ${i + 1}`}</option>
            ))}
          </select>
          <select value={micId ?? ""} onChange={(e) => setMicId(e.target.value || undefined)} aria-label="Mikrofon" className="h-10 rounded-lg bg-white/10 px-3 text-[13.5px] text-white outline-none">
            <option value="">Mikrofon (standart)</option>
            {mics.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || `Mikrofon ${i + 1}`}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" onClick={onCancel} className="h-11 rounded-full bg-white/10 px-5 text-[14px] font-semibold">Bekor qilish</button>
          <button type="button" onClick={go} className="btn-accent inline-flex h-11 items-center gap-2 px-6 text-[14px]">
            <Signal size={16} /> Efirga chiqish
          </button>
        </div>
      </div>
    </div>
  );
}
