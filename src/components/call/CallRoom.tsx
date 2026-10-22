"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure, Room, Track, type Participant } from "livekit-client";
import { Loader2, Maximize2, Mic, MicOff, Minimize2, MonitorUp, MonitorX, PhoneOff, SwitchCamera, Video, VideoOff, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { clockDuration } from "@/lib/call/format";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { CallAvatar } from "./CallAvatar";

type Target = { kind: "dm" | "group" | "consult"; id: string };

/** Barqaror className — har renderda yangi qiymat LiveKitRoom'ni bezovta qilmasin */
const ROOM_CLASS = "absolute inset-0 bg-[#0a0a0c]";

const nameOf = (p: Participant) => p.name || p.identity;

/** Kamera o'chiq bo'lganda: ismning bosh harfi bilan dumaloq avatar */
function Initial({ name, size }: { name: string; size: number }) {
  return (
    <span className="rounded-full shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] ring-[3px] ring-white/20">
      <CallAvatar name={name} size={size} />
    </span>
  );
}

/** Dumaloq boshqaruv tugmasi (iOS uslubi): yoniq = oq fon, o'chiq = shisha, xavfli = qizil */
function Ctl({
  label,
  onClick,
  active,
  danger,
  big,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className="group flex flex-col items-center gap-2 outline-none">
      <span
        className={cn(
          "grid place-items-center rounded-full transition group-active:scale-90 group-focus-visible:ring-4 group-focus-visible:ring-white/50",
          big ? "h-16 w-16" : "h-14 w-14",
          danger ? "bg-danger text-white" : active ? "bg-white text-[#0a0a0c]" : "bg-white/16 text-white backdrop-blur-xl",
        )}
      >
        {children}
      </span>
      <span className="text-[11.5px] font-medium text-white/75">{label}</span>
    </button>
  );
}

/** Guruh qo'ng'irog'ida bitta ishtirokchi katagi (gapirayotganda yashil kontur) */
function Tile({ p, cam }: { p: Participant; cam?: TrackReference }) {
  const speaking = useIsSpeaking(p);
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-white/[0.06] transition-shadow", speaking && "ring-[3px] ring-success")}>
      {cam ? (
        <VideoTrack trackRef={cam} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Initial name={nameOf(p)} size={64} />
        </div>
      )}
      <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-md">{nameOf(p)}</span>
    </div>
  );
}

/**
 * Xona ichidagi interfeys — LiveKitRoom kontekstida ishlaydi.
 * Telefon uchun noldan: to'liq ekranli suhbatdosh videosi, o'z kamerasi kichik oynada, taymer,
 * pastda katta tugmalar (mikrofon · kamera · kamerani almashtirish · ekran · tugatish).
 * Ekranga tegilsa boshqaruv paneli yashiriladi/ko'rinadi (video bor paytda 5 s dan keyin o'zi yashiriladi).
 */
function CallStage({ title, autoEndOnPeerLeft, notice, mini, onToggleMini, onEnd }: { title: string; autoEndOnPeerLeft: boolean; notice: string; mini: boolean; onToggleMini: () => void; onEnd: () => void }) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const [ui, setUi] = useState(true);
  const [localNotice, setLocalNotice] = useState("");
  const [cams, setCams] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [peerLeft, setPeerLeft] = useState(false);
  const startedAt = useRef<number | null>(null);
  const hadRemote = useRef(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const refs = tracks.filter(isTrackReference).filter((t) => !t.publication.isMuted);
  const camOf = (p: Participant) => refs.find((t) => t.participant.identity === p.identity && t.source === Track.Source.Camera);
  const screen = refs.find((t) => t.source === Track.Source.ScreenShare);
  const localCam = camOf(localParticipant);
  const remoteCams = remotes.map((p) => camOf(p)).filter((t): t is TrackReference => Boolean(t));
  const hasVideo = Boolean(screen) || remoteCams.length > 0;
  const first = remotes[0];

  // Taymer: birinchi suhbatdosh qo'shilgandan boshlanadi
  useEffect(() => {
    if (remotes.length > 0 && startedAt.current === null) startedAt.current = Date.now();
    if (startedAt.current === null) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(id);
  }, [remotes.length]);

  // Suhbatdosh chiqib ketdi (DM) — qisqa xabar ko'rsatib, qo'ng'iroqni yopamiz
  useEffect(() => {
    if (remotes.length > 0) {
      hadRemote.current = true;
      setPeerLeft(false);
      return;
    }
    if (!hadRemote.current || !autoEndOnPeerLeft) return;
    setPeerLeft(true);
    const t = setTimeout(onEnd, 1400);
    return () => clearTimeout(t);
  }, [remotes.length, autoEndOnPeerLeft, onEnd]);

  // Kamera qurilmalari soni (almashtirish tugmasi faqat 2+ bo'lsa)
  useEffect(() => {
    if (!isCameraEnabled) return;
    let alive = true;
    void Room.getLocalDevices("videoinput")
      .then((d) => alive && setCams(d.length))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isCameraEnabled]);

  // Telefon ekrani suhbat paytida o'chib qolmasin
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const ask = () => {
      void navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    };
    ask();
    const onVis = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Video bor paytda boshqaruv paneli 5 s dan keyin yashirinadi
  useEffect(() => {
    if (!ui || !hasVideo) return;
    const t = setTimeout(() => setUi(false), 5000);
    return () => clearTimeout(t);
  }, [ui, hasVideo]);
  useEffect(() => {
    if (!hasVideo) setUi(true);
  }, [hasVideo]);

  const flash = useCallback((text: string) => {
    setLocalNotice(text);
    setTimeout(() => setLocalNotice(""), 4000);
  }, []);

  const toggleMic = () => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => flash("Mikrofonga ruxsat berilmadi"));
  const toggleCam = () =>
    void localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => flash("Kameraga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering"));
  const toggleScreen = () => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled).catch(() => undefined);
  const flip = async () => {
    try {
      const list = await Room.getLocalDevices("videoinput");
      if (list.length < 2) return;
      const cur = room.getActiveDevice("videoinput");
      const i = list.findIndex((d) => d.deviceId === cur);
      await room.switchActiveDevice("videoinput", list[(i + 1) % list.length].deviceId);
    } catch {
      flash("Kamerani almashtirib bo'lmadi");
    }
  };

  const reconnecting = connection === ConnectionState.Reconnecting;
  const status = peerLeft
    ? "Suhbatdosh chiqib ketdi"
    : reconnecting
      ? "Qayta ulanmoqda…"
      : remotes.length === 0
        ? "Ulanmoqda…"
        : clockDuration(elapsed);
  const shownNotice = notice || localNotice;
  const group = remotes.length > 1;

  // Kichraytirilgan ko'rinish: burchakdagi suzuvchi oyna (xona uzilmaydi — faqat ko'rinish o'zgaradi)
  if (mini) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#0a0a0c] text-white">
        <RoomAudioRenderer />
        {screen ? (
          <VideoTrack trackRef={screen} className="h-full w-full bg-black object-contain" />
        ) : remoteCams[0] ? (
          <VideoTrack trackRef={remoteCams[0]} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(120%_80%_at_50%_0%,#1d1d22_0%,#0a0a0c_70%)]">
            <Initial name={first ? nameOf(first) : title} size={52} />
          </div>
        )}
        <button type="button" onClick={onToggleMini} aria-label="Qo'ng'iroqni kengaytirish" className="absolute inset-0 outline-none focus-visible:ring-4 focus-visible:ring-white/50" />
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums backdrop-blur-md">
          {reconnecting && <WifiOff size={11} aria-hidden="true" />}
          {status}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 backdrop-blur-md">
          <Maximize2 size={12} aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={toggleMic}
          aria-label={isMicrophoneEnabled ? "Ovozni o'chirish" : "Ovozni yoqish"}
          className={cn("absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full transition active:scale-90", isMicrophoneEnabled ? "bg-black/60 text-white backdrop-blur-md" : "bg-white text-[#0a0a0c]")}
        >
          {isMicrophoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <button type="button" onClick={onEnd} aria-label="Tugatish" className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-danger text-white transition active:scale-90">
          <PhoneOff size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0a0a0c] text-white">
      <RoomAudioRenderer />

      {/* Asosiy sahna — tegilsa boshqaruv panelini ko'rsatadi/yashiradi */}
      <div className="absolute inset-0" onPointerDown={() => hasVideo && setUi((v) => !v)}>
        {screen ? (
          <VideoTrack trackRef={screen} className="h-full w-full bg-black object-contain" />
        ) : group ? (
          <div className="grid h-full auto-rows-fr grid-cols-2 gap-1.5 p-1.5 pb-44 pt-28">
            {remotes.map((p) => (
              <Tile key={p.identity} p={p} cam={camOf(p)} />
            ))}
          </div>
        ) : remoteCams[0] ? (
          <VideoTrack trackRef={remoteCams[0]} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(120%_80%_at_50%_0%,#1d1d22_0%,#0a0a0c_70%)] px-6">
            <div className="flex flex-col items-center gap-5 pb-24 text-center">
              <Initial name={first ? nameOf(first) : title} size={132} />
              <p className="max-w-[80vw] truncate font-sans text-[26px] font-semibold tracking-[-0.01em]">{first ? nameOf(first) : title}</p>
              {first && <p className="text-[14px] text-white/55">Kamera o'chiq</p>}
            </div>
          </div>
        )}
      </div>

      {/* Yuqori panel: nom + holat/taymer */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/65 to-transparent px-5 pb-10 pt-[max(env(safe-area-inset-top),14px)] transition duration-300",
          ui ? "opacity-100" : "-translate-y-2 opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{group ? title : first ? nameOf(first) : title}</p>
            <p className={cn("mt-0.5 flex items-center gap-1.5 text-[14px] tabular-nums", reconnecting || peerLeft ? "text-warning" : "text-white/75")} aria-live="polite">
              {reconnecting && <WifiOff size={14} aria-hidden="true" />}
              {status}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleMini}
            aria-label="Kichraytirish"
            title="Kichraytirish — chatdan foydalanish"
            className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/16 text-white backdrop-blur-xl transition active:scale-90"
          >
            <Minimize2 size={20} />
          </button>
        </div>
      </div>

      {/* Ogohlantirish (ruxsat berilmadi va h.k.) */}
      {shownNotice && (
        <div role="alert" className="absolute inset-x-4 top-[calc(max(env(safe-area-inset-top),14px)+72px)] z-10 rounded-2xl bg-black/75 px-4 py-3 text-center text-[13.5px] text-white backdrop-blur-xl">
          {shownNotice}
        </div>
      )}

      {/* O'z kameram — kichik oyna (o'ng yuqori) */}
      {localCam && !isScreenShareEnabled && (
        <div className="absolute right-3 top-[calc(max(env(safe-area-inset-top),14px)+68px)] z-10 aspect-[3/4] w-[104px] overflow-hidden rounded-2xl bg-black shadow-[0_10px_30px_-6px_rgba(0,0,0,0.6)] ring-2 ring-white/25 sm:w-[140px]">
          <VideoTrack trackRef={localCam} className="h-full w-full -scale-x-100 object-cover" />
        </div>
      )}

      {/* Pastki boshqaruv paneli */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),18px)] pt-14 transition duration-300",
          ui ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-md items-end justify-center gap-3.5">
          <Ctl label={isMicrophoneEnabled ? "Ovoz" : "Ovozsiz"} active={!isMicrophoneEnabled} onClick={toggleMic}>
            {isMicrophoneEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </Ctl>
          <Ctl label={isCameraEnabled ? "Kamera" : "Kamera o'chiq"} active={!isCameraEnabled} onClick={toggleCam}>
            {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </Ctl>
          {isCameraEnabled && cams > 1 && (
            <Ctl label="Almashtirish" onClick={() => void flip()}>
              <SwitchCamera size={24} />
            </Ctl>
          )}
          {canShare && (
            <Ctl label={isScreenShareEnabled ? "To'xtatish" : "Ekran"} active={isScreenShareEnabled} onClick={toggleScreen}>
              {isScreenShareEnabled ? <MonitorX size={24} /> : <MonitorUp size={24} />}
            </Ctl>
          )}
          <Ctl label="Tugatish" danger big onClick={onEnd}>
            <PhoneOff size={28} />
          </Ctl>
        </div>
      </div>
    </div>
  );
}

/** Holat ekrani: tokenni kutish / xato (to'liq ekranli, katta tugma) */
function Message({ error, onClose, children }: { error?: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-8 pb-[env(safe-area-inset-bottom)] text-center text-white">
      <div className="flex max-w-sm flex-col items-center gap-5">
        {error ? <WifiOff size={34} className="text-white/60" aria-hidden="true" /> : <Loader2 size={32} className="animate-spin" aria-hidden="true" />}
        <p className="text-[15.5px] leading-relaxed text-white/85">{children}</p>
        {error && (
          <button type="button" onClick={onClose} className="h-12 min-w-[160px] rounded-full bg-white px-7 text-[15px] font-semibold text-[#0a0a0c] transition active:scale-95">
            Yopish
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Video/ovozli qo'ng'iroq xonasi — butun ekranli ustki qatlam (telefon uchun noldan chizilgan).
 * `/api/qongiroq/token` dan token oladi (egalik tekshiruvi serverda) yoki tayyor `connection` bilan ulanadi.
 * Token server-tomonda beriladi — klientga API_SECRET umuman chiqmaydi.
 */
export function CallRoom({
  target,
  title,
  onClose,
  connection,
  startWithVideo = true,
}: {
  target?: Target;
  title: string;
  onClose: () => void;
  /** Tayyor ulanish (CallCenter start/accept'dan) — berilsa token qayta so'ralmaydi */
  connection?: { url: string; token: string };
  /** true = kamera yoqilgan (video qo'ng'iroq), false = faqat ovoz (kamerani keyin yoqish mumkin) */
  startWithVideo?: boolean;
}) {
  const [mini, setMini] = useState(false);
  useScrollLock(!mini);
  const toggleMini = useCallback(() => setMini((v) => !v), []);
  const [state, setState] = useState<"loading" | "ready" | "error">(connection ? "ready" : "loading");
  const [conn, setConn] = useState<{ url: string; token: string } | null>(connection ?? null);
  const [error, setError] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");
  // Ulanish holati va onClose ref'da — LiveKit hodisa funksiyalari BARQAROR bo'lsin
  // (aks holda har renderda yangi funksiya → LiveKitRoom qayta ulanadi → "Client initiated disconnect")
  const connectedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const end = useCallback(() => onCloseRef.current(), []);

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
  const handleMediaFailure = useCallback((f?: MediaDeviceFailure) => {
    setNotice(
      f === MediaDeviceFailure.PermissionDenied
        ? "Kamera/mikrofonga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering"
        : f === MediaDeviceFailure.NotFound
          ? "Kamera yoki mikrofon topilmadi"
          : f === MediaDeviceFailure.DeviceInUse
            ? "Kamera/mikrofon boshqa ilova tomonidan band"
            : "Kamera/mikrofonni ochib bo'lmadi",
    );
    setTimeout(() => setNotice(""), 5000);
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

  // Esc: qo'ng'iroqni tugatmaydi — kichraytiradi (tasodifan uzilib qolmasin)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMini(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ulanish taymauti: 25s ichida ulanmasa (ICE/tarmoq bloki) — "Ulanmoqda"da cheksiz turmasin
  useEffect(() => {
    if (state !== "ready" || connected) return;
    const t = setTimeout(() => {
      setError("Ulanib bo'lmadi — internet qo'ng'iroq serveriga yetmayapti (Wi-Fi yoki boshqa tarmoqni sinab ko'ring).");
      setState("error");
    }, 25_000);
    return () => clearTimeout(t);
  }, [state, connected]);

  return (
    <div
      className={cn(
        "fixed z-[135] overflow-hidden bg-[#0a0a0c] transition-[inset,width,height,border-radius] duration-300",
        mini
          ? "bottom-[calc(env(safe-area-inset-bottom)+92px)] right-3 h-[176px] w-[120px] rounded-2xl shadow-[0_14px_40px_-8px_rgba(0,0,0,0.7)] ring-1 ring-white/25 md:bottom-6 md:right-6 md:h-[170px] md:w-[300px]"
          : "inset-0 h-dvh",
      )}
      role="dialog"
      aria-modal={!mini}
      aria-label={`Qo'ng'iroq — ${title}`}
    >
      {state === "loading" && <Message onClose={end}>Ulanmoqda…</Message>}
      {state === "error" && (
        <Message error onClose={end}>
          {error}
        </Message>
      )}
      {state === "ready" && conn && (
        <LiveKitRoom
          serverUrl={conn.url}
          token={conn.token}
          connect
          video={startWithVideo}
          audio
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          onMediaDeviceFailure={handleMediaFailure}
          className={ROOM_CLASS}
        >
          <CallStage title={title} autoEndOnPeerLeft={!target} notice={notice} mini={mini} onToggleMini={toggleMini} onEnd={end} />
        </LiveKitRoom>
      )}
    </div>
  );
}

export default CallRoom;
