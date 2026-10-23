"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { Captions, CaptionsOff } from "lucide-react";
import { cn } from "@/lib/utils";

/* Brauzer nutq tanish (Web Speech API) — TypeScript'da standart turi yo'q, minimal e'lon */
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;

function recognizer(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Brauzer nutq tanishni qo'llab-quvvatlaydimi (Chrome/Edge — ha, Firefox — yo'q) */
export const captionsSupported = () => recognizer() !== null;

const enc = new TextEncoder();
const dec = new TextDecoder();
type Line = { name: string; text: string; at: number };

/**
 * Jonli subtitr: gapiruvchining brauzeri nutqni matnga aylantiradi, matn LiveKit data kanali
 * (`topic=caption`) orqali hammaga uzatiladi va serverga transkript sifatida yoziladi.
 *
 * `speak` — shu qurilma nutqni tanib uzatadimi (faqat sahnadagilar uchun mantiqiy).
 * `startedAt` — efir boshlangan vaqt (transkriptdagi vaqt belgisi uchun).
 */
export function useLiveCaptions({ streamId, speak, startedAt, lang = "uz-UZ" }: { streamId: string; speak: boolean; startedAt: number; lang?: string }) {
  const { localParticipant } = useLocalParticipant();
  const [on, setOn] = useState(false);
  const [line, setLine] = useState<Line | null>(null);
  const srRef = useRef<SR | null>(null);
  const wantRef = useRef(false);

  const { send } = useDataChannel("caption", (msg) => {
    try {
      const j = JSON.parse(dec.decode(msg.payload)) as { name?: string; text?: string };
      if (j.text) setLine({ name: j.name || "Ishtirokchi", text: j.text.slice(0, 300), at: Date.now() });
    } catch {
      /* buzuq paket */
    }
  });

  // Subtitr 6 s dan keyin o'chadi
  useEffect(() => {
    if (!line) return;
    const t = window.setTimeout(() => setLine((l) => (l && Date.now() - l.at >= 5800 ? null : l)), 6000);
    return () => window.clearTimeout(t);
  }, [line]);

  const emit = useCallback(
    (text: string, final: boolean) => {
      const name = localParticipant.name || "Siz";
      setLine({ name, text, at: Date.now() });
      void send(enc.encode(JSON.stringify({ name, text })), { reliable: false }).catch(() => undefined);
      // Transkriptga faqat tugallangan jumlalar yoziladi
      if (final)
        void fetch(`/api/live/${streamId}/subtitr`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: text.slice(0, 300), atSec: Math.max(0, Math.round((Date.now() - startedAt) / 1000)) }),
        }).catch(() => undefined);
    },
    [localParticipant.name, send, streamId, startedAt],
  );

  // Nutq tanishni yoqish/o'chirish (uzilsa avtomatik qayta boshlanadi)
  useEffect(() => {
    wantRef.current = on && speak;
    if (!on || !speak) {
      srRef.current?.stop();
      srRef.current = null;
      return;
    }
    const Ctor = recognizer();
    if (!Ctor) return;
    const sr = new Ctor();
    srRef.current = sr;
    sr.lang = lang;
    sr.continuous = true;
    sr.interimResults = true;
    sr.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (text) emit(text, r.isFinal);
      }
    };
    sr.onerror = () => undefined;
    sr.onend = () => {
      if (wantRef.current)
        try {
          sr.start();
        } catch {
          /* allaqachon ishlayapti */
        }
    };
    try {
      sr.start();
    } catch {
      /* ruxsat yo'q */
    }
    return () => {
      wantRef.current = false;
      sr.onend = null;
      sr.stop();
    };
  }, [on, speak, lang, emit]);

  return { on, setOn, line };
}

/** Subtitr qatori (sahna pastida) */
export function CaptionBar({ line }: { line: { name: string; text: string } | null }) {
  if (!line) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-4">
      <p className="max-w-[92%] rounded-xl bg-black/75 px-3.5 py-2 text-center text-[14px] leading-snug text-white backdrop-blur sm:text-[15px]">
        <span className="mr-1.5 font-semibold text-white/55">{line.name}:</span>
        {line.text}
      </p>
    </div>
  );
}

/** Pastki paneldagi subtitr tugmasi */
export function CaptionButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label="Subtitr" aria-pressed={on} className="group flex w-[54px] flex-col items-center gap-1 outline-none sm:w-[62px]">
      <span className={cn("grid h-11 w-11 place-items-center rounded-full transition group-active:scale-90", on ? "bg-white text-black" : "bg-white/12 text-white")}>
        {on ? <Captions size={20} /> : <CaptionsOff size={20} />}
      </span>
      <span className="text-[10.5px] font-medium text-white/65">Subtitr</span>
    </button>
  );
}
