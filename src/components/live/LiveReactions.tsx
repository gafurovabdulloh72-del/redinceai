"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiSticker, EmojiStack } from "@/components/social/EmojiSticker";

/** Efirda uchib chiqadigan reaksiyalar (Zoom/Instagram naqshi) */
export const LIVE_REACTIONS = ["❤️", "👏", "🔥", "😂", "😮", "👍", "🙌", "🎉"] as const;

type Floating = { key: number; emoji: string; name: string; x: number; delay: number };

const enc = new TextEncoder();
const dec = new TextDecoder();
let seq = 0;

/**
 * Reaksiya qatlami: LiveKit data kanali orqali (`topic=reaction`) emoji yuboriladi va
 * hamma ekranida pastdan yuqoriga uchib chiqadi. Serverga yozilmaydi — faqat efir ichida.
 * Qaytaradi: uchayotgan reaksiyalar qatlami va tanlash tugmasi.
 */
export function useLiveReactions() {
  const { localParticipant } = useLocalParticipant();
  const [items, setItems] = useState<Floating[]>([]);
  const timers = useRef<number[]>([]);

  const push = useCallback((emoji: string, name: string) => {
    const key = ++seq;
    setItems((l) => [...l.slice(-24), { key, emoji, name, x: 6 + Math.random() * 80, delay: Math.random() * 180 }]);
    const t = window.setTimeout(() => setItems((l) => l.filter((i) => i.key !== key)), 3600);
    timers.current.push(t);
  }, []);

  const { send } = useDataChannel("reaction", (msg) => {
    try {
      const j = JSON.parse(dec.decode(msg.payload)) as { emoji?: string; name?: string };
      if (j.emoji && LIVE_REACTIONS.includes(j.emoji as (typeof LIVE_REACTIONS)[number])) push(j.emoji, j.name || "Ishtirokchi");
    } catch {
      /* buzuq paket — e'tiborsiz */
    }
  });

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const react = useCallback(
    (emoji: string) => {
      const name = localParticipant.name || "Siz";
      push(emoji, name);
      void send(enc.encode(JSON.stringify({ emoji, name })), { reliable: false }).catch(() => undefined);
    },
    [localParticipant.name, push, send],
  );

  return { items, react };
}

/** Uchayotgan reaksiyalar (sahna ustida, bosilmaydi) */
export function ReactionLayer({ items }: { items: Floating[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {items.map((i) => (
        <span key={i.key} className="absolute bottom-2 inline-flex animate-live-float leading-none" style={{ left: `${i.x}%`, animationDelay: `${i.delay}ms` }}>
          <EmojiSticker e={i.emoji} size={32} />
        </span>
      ))}
    </div>
  );
}

/** Reaksiya tanlash paneli (pastki boshqaruvdagi tugma ustida ochiladi) */
export function ReactionPicker({ open, onPick, onClose }: { open: boolean; onPick: (e: string) => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-full bg-[#1f1f23] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)]" role="menu" aria-label="Reaksiya">
      <div className="flex gap-0.5">
        {LIVE_REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            role="menuitem"
            onClick={() => {
              onPick(e);
              onClose();
            }}
            className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/15 active:scale-90"
            aria-label={e}
          >
            <EmojiSticker e={e} size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pastki paneldagi reaksiya tugmasi (panelni o'zi ochadi) */
export function ReactionButton({ react }: { react: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(t);
  }, [open]);
  return (
    <div className="relative">
      <ReactionPicker open={open} onPick={react} onClose={() => setOpen(false)} />
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Reaksiya" aria-expanded={open} className="group flex w-[54px] flex-col items-center gap-1 outline-none sm:w-[62px]">
        <span className={cn("grid h-11 w-11 place-items-center rounded-full transition group-active:scale-90", open ? "bg-white text-black" : "bg-white/12 text-white")}>
          <Smile size={20} />
        </span>
        <span className="text-[10.5px] font-medium text-white/65">Reaksiya</span>
      </button>
    </div>
  );
}
