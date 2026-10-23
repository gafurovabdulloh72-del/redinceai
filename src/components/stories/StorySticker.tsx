"use client";

import { useEffect, useState } from "react";
import { BarChart3, Check, ExternalLink, HelpCircle, Loader2, Timer } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import type { StorySticker as Sticker } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface State {
  counts: [number, number];
  answers: number;
  myChoice: number | null;
  myText: string | null;
}
type Resp<T> = { ok: boolean; data?: T; error?: string };

/** Qolgan vaqt: «2 kun 3 soat» ko'rinishida */
function left(at: number): string {
  const ms = at - Date.now();
  if (ms <= 0) return "Vaqt tugadi";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d) return `${d} kun ${h} soat`;
  if (h) return `${h} soat ${m} daq`;
  return `${m} daqiqa`;
}

/**
 * Story stikeri (ko'ruvchi tomoni): so'rovnomaga ovoz berish, savolga javob yozish,
 * hisoblagich va havola. Javob bergach natija ko'rinadi (so'rovnomada foizlar).
 */
export function StoryStickerCard({ storyId, sticker, isMe, onBusy }: { storyId: string; sticker: Sticker; isMe: boolean; onBusy?: (b: boolean) => void }) {
  const [st, setSt] = useState<State | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSt(null);
    setText("");
  }, [storyId]);

  // Hisoblagich har daqiqada yangilanadi
  useEffect(() => {
    if (sticker.kind !== "countdown") return;
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, [sticker.kind]);

  async function send(payload: { choice?: number; text?: string }) {
    if (sending) return;
    setSending(true);
    onBusy?.(true);
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/sticker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = (await res.json()) as Resp<State>;
      if (!res.ok || !j.data) throw new Error(j.error || "Yuborilmadi");
      setSt(j.data);
      if (payload.text) showToast("Javobingiz yuborildi", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuborilmadi", "error");
    } finally {
      setSending(false);
      onBusy?.(false);
    }
  }

  if (sticker.kind === "link") {
    return (
      <a href={sticker.url} target="_blank" rel="noopener noreferrer nofollow" className="press inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-white/90 px-4 py-2 text-[13.5px] font-bold text-black backdrop-blur">
        <ExternalLink size={14} /> {sticker.label || "Havola"}
      </a>
    );
  }

  if (sticker.kind === "countdown") {
    void tick;
    return (
      <div className="rounded-[16px] bg-white/90 px-4 py-2.5 text-center text-black backdrop-blur">
        <p className="flex items-center justify-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-black/60">
          <Timer size={12} /> {sticker.title}
        </p>
        <p className="mt-0.5 text-[16px] font-bold tabular-nums">{left(sticker.at)}</p>
      </div>
    );
  }

  if (sticker.kind === "question") {
    const answered = st?.myText != null;
    return (
      <div className="w-full max-w-[280px] rounded-[16px] bg-white/90 p-3 text-black backdrop-blur">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-black/70">
          <HelpCircle size={13} /> {sticker.prompt}
        </p>
        {isMe ? (
          <p className="mt-2 text-[12.5px] text-black/60">Javoblar kabinetda ko&apos;rinadi.</p>
        ) : answered ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-black">
            <Check size={14} /> Javobingiz yuborildi
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send({ text: text.trim() });
            }}
            className="mt-2 flex gap-1.5"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Javobingiz…" aria-label="Javob" className="h-9 min-w-0 flex-1 rounded-full border border-black/15 bg-white px-3 text-[13px] text-black outline-none focus:border-black" />
            <button type="submit" disabled={!text.trim() || sending} className="h-9 shrink-0 rounded-full bg-black px-3 text-[12.5px] font-bold text-white disabled:opacity-50">
              {sending ? <Loader2 size={13} className="animate-spin" /> : "Yuborish"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // So'rovnoma
  const total = st ? st.counts[0] + st.counts[1] : 0;
  const voted = st?.myChoice != null || isMe;
  return (
    <div className="w-full max-w-[280px] rounded-[16px] bg-white/90 p-3 text-black backdrop-blur">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-black/70">
        <BarChart3 size={13} /> {sticker.question}
      </p>
      <div className="mt-2 grid gap-1.5">
        {sticker.options.map((opt, i) => {
          const pct = total ? Math.round(((st?.counts[i] ?? 0) / total) * 100) : 0;
          const mine = st?.myChoice === i;
          return (
            <button
              key={i}
              type="button"
              disabled={voted || sending}
              onClick={() => void send({ choice: i })}
              className={cn("relative overflow-hidden rounded-[10px] border px-3 py-1.5 text-left text-[13px] font-semibold transition", mine ? "border-black" : "border-black/15", !voted && "hover:border-black")}
            >
              {voted && <span className="absolute inset-y-0 left-0 bg-black/10" style={{ width: `${pct}%` }} aria-hidden />}
              <span className="relative flex items-center justify-between gap-2">
                <span className="truncate">{opt}</span>
                {voted && <span className="shrink-0 tabular-nums text-black/60">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {voted && <p className="mt-1.5 text-[11.5px] text-black/55">{total} ta ovoz</p>}
    </div>
  );
}
