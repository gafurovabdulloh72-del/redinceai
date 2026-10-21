"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, isTrackReference, useChat, useLocalParticipant, useRemoteParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Loader2, Mic, MicOff, MonitorUp, PhoneOff, Send, Users, Video, VideoOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/components/motion/useScrollLock";

type Conn = { url: string; token: string; host: boolean; title: string };

/** Jonli efir qatlami (portal, z-135): token olish → LiveKit xonasi. Boshlovchi kamera/mikrofonni chiqaradi, tomoshabin faqat ko'radi */
export function LiveRoomOverlay({ streamId, onClose }: { streamId: string; onClose: () => void }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [error, setError] = useState("");
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

  async function leave(endStream: boolean) {
    if (closed.current) return;
    closed.current = true;
    if (endStream) await fetch(`/api/live/${streamId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ peak: peak.current }) }).catch(() => undefined);
    onClose();
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Jonli efir" className="fixed inset-0 z-[135] bg-black text-white" data-theme="dark">
      {error ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <p className="text-[15px] font-semibold">{error}</p>
            <button type="button" className="btn-accent mt-4 h-10 px-5" onClick={() => void leave(false)}>Yopish</button>
          </div>
        </div>
      ) : !conn ? (
        <div className="grid h-full place-items-center">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <LiveKitRoom serverUrl={conn.url} token={conn.token} connect video={conn.host} audio={conn.host} onDisconnected={() => void leave(conn.host)} className="absolute inset-0">
          <Stage conn={conn} peak={peak} onLeave={() => void leave(false)} onEnd={() => void leave(true)} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
    </div>,
    document.body,
  );
}

function Stage({ conn, peak, onLeave, onEnd }: { conn: Conn; peak: React.MutableRefObject<number>; onLeave: () => void; onEnd: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]).filter(isTrackReference).filter((t) => !t.publication.isMuted);
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Boshqa ishtirokchilar soni: boshlovchida — tomoshabinlar; tomoshabinda — boshlovchi + boshqa tomoshabinlar
  const count = remotes.length;
  useEffect(() => {
    peak.current = Math.max(peak.current, count);
  }, [count, peak]);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages.length]);

  // Ko'rsatiladigan manba: ekran ulashish > boshlovchi kamerasi
  const screen = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const hostCam = conn.host ? tracks.find((t) => t.participant.identity === localParticipant.identity && t.source === Track.Source.Camera) : tracks.find((t) => t.source === Track.Source.Camera);
  const main = screen ?? hostCam;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    await send(t).catch(() => undefined);
  }

  return (
    <div className="absolute inset-0 flex flex-col lg:flex-row">
      <div className="relative min-h-0 flex-1 bg-black">
        {main ? (
          <VideoTrack trackRef={main} className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-white/70">
            <p className="text-[15px]">{conn.host ? "Kamerangiz yoqilmoqda…" : "Boshlovchi hozircha kamerani yoqmagan"}</p>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-white" /> Jonli
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold tabular-nums">
            <Users size={12} /> {conn.host ? count : Math.max(1, count)}
          </span>
          <span className="text-[12px] tabular-nums text-white/70">{mm}:{ss}</span>
          <p className="ml-1 min-w-0 flex-1 truncate text-[13.5px] font-semibold">{conn.title}</p>
          <button type="button" aria-label="Yopish" onClick={conn.host ? onEnd : onLeave} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur">
            <X size={18} />
          </button>
        </div>
        {conn.host && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Ctl label="Mikrofon" on={isMicrophoneEnabled} onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => undefined)}>
              {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </Ctl>
            <Ctl label="Kamera" on={isCameraEnabled} onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => undefined)}>
              {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </Ctl>
            <Ctl label="Ekran" on={isScreenShareEnabled} onClick={() => void localParticipant.setScreenShareEnabled(!isScreenShareEnabled).catch(() => undefined)}>
              <MonitorUp size={20} />
            </Ctl>
            <button type="button" onClick={onEnd} className="inline-flex h-12 items-center gap-2 rounded-full bg-danger px-5 text-[14px] font-bold">
              <PhoneOff size={18} /> Tugatish
            </button>
          </div>
        )}
      </div>

      {/* Chat: LiveKit data kanali — efir tugagach saqlanmaydi */}
      <aside className="flex h-[38%] min-h-0 flex-col border-t border-white/10 bg-[#101012] lg:h-auto lg:w-[340px] lg:border-l lg:border-t-0">
        <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-[13.5px]">
          {chatMessages.length === 0 && <li className="py-6 text-center text-white/45">Savol yoki fikringizni yozing</li>}
          {chatMessages.map((m, i) => (
            <li key={i} className="leading-snug">
              <span className="font-semibold text-white/60">{m.from?.name || m.from?.identity || "…"}: </span>
              <span className="break-words">{m.message}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Xabar yozing…" aria-label="Efir chati" className="h-10 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[14px] text-white outline-none placeholder:text-white/40 focus:bg-white/15" />
          <button type="submit" disabled={isSending || !text.trim()} aria-label="Yuborish" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function Ctl({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={onClick} className={cn("grid h-12 w-12 place-items-center rounded-full transition active:scale-90", on ? "bg-white text-black" : "bg-white/15 text-white backdrop-blur")}>
      {children}
    </button>
  );
}
