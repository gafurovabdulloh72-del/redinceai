"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Music2, Pause, Play, Search, Upload, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { uploadMusic } from "@/components/chat/attachments";
import type { QuotaInfo } from "@/lib/social/limits";
import { cn } from "@/lib/utils";

export interface MusicDraft {
  url: string;
  title: string;
  artist: string;
  /** Faqat ko'rsatish uchun (serverga yuborilmaydi) */
  cover?: string | null;
}

interface Track {
  id: string;
  url: string;
  title: string;
  artist: string | null;
  cover?: string | null;
  source: "library" | "catalog";
}

const MUSIC_TAGS = ["Trend", "Uzbek", "Lo-fi", "Hip hop", "Pop", "Cinematic"];

/** Muqova (yoki yozilmagan bo'lsa gradient + nota) */
export function Cover({ src, size = 48, className }: { src?: string | null; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-[10px] object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#ff7a45] to-[#c25cff] text-white", className)} style={{ width: size, height: size }}>
      <Music2 size={Math.round(size * 0.42)} />
    </span>
  );
}

/** Instagram uslubidagi musiqa qidiruvi: internet katalogi + saytdagi kutubxona, 30 s namuna, o'z faylini yuklash */
export function MusicSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: MusicDraft) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Track[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };
  useEffect(() => {
    if (!open) {
      stop();
      setQ("");
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      setItems(null);
      fetch(`/api/music?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { data?: { items: Track[] } }) => setItems(j.data?.items ?? []))
        .catch((e) => {
          if (e?.name !== "AbortError") setItems([]);
        });
    }, q ? 350 : 0);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q, open]);
  useEffect(() => () => audioRef.current?.pause(), []);

  function toggle(t: Track) {
    if (playing === t.id) return stop();
    audioRef.current?.pause();
    const a = audioRef.current ?? (audioRef.current = new Audio());
    a.src = t.url;
    a.onended = () => setPlaying(null);
    void a.play().then(() => setPlaying(t.id)).catch(() => showToast("Eshittirib bo'lmadi", "error"));
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadMusic(f);
      onPick({ url, title: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80), artist: "" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Musiqa" size="md" className="sm:!h-[640px]">
      <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qo'shiq yoki ijrochi qidiring" aria-label="Musiqa qidirish" className="h-11 w-full rounded-full bg-fg/6 pl-11 pr-4 text-[14.5px] text-fg outline-none placeholder:text-fg-3 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-fg/15" />
      </label>
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        {MUSIC_TAGS.map((t) => (
          <button key={t} type="button" onClick={() => setQ(t === "Trend" ? "top hits" : t)} className="press shrink-0 rounded-full bg-fg/6 px-3.5 py-1.5 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/10">
            {t}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="press mt-3 flex w-full items-center gap-3 rounded-[14px] py-2 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] border border-dashed border-line-2 text-fg-2">{busy ? <Spinner /> : <Upload size={18} />}</span>
        <span className="min-w-0">
          <span className="block text-[14.5px] font-semibold text-fg">O&apos;z faylingizni yuklash</span>
          <span className="block text-[12.5px] text-fg-3">MP3, M4A yoki OGG</span>
        </span>
      </button>
      <div className="mt-1 pb-3">
        <p className="px-0.5 pb-1 pt-2 text-[12px] font-bold uppercase tracking-[0.08em] text-fg-3">{q.trim() ? "Natijalar" : "Ommabop"}</p>
        {items === null ? (
          <div className="grid h-40 place-items-center text-fg-3">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] leading-relaxed text-fg-3">{q.trim() ? "Hech narsa topilmadi — boshqa so'z yozing" : "Qo'shiq nomini yozib qidiring yoki o'zingiznikini yuklang"}</p>
        ) : (
          <ul>
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1.5">
                <button type="button" onClick={() => toggle(t)} aria-label={playing === t.id ? "To'xtatish" : "Eshitish"} className="press relative shrink-0">
                  <Cover src={t.cover} />
                  <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-black/35 text-white">{playing === t.id ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</span>
                </button>
                <button type="button" onClick={() => (stop(), onPick({ url: t.url, title: t.title, artist: t.artist ?? "", cover: t.cover }))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[14.5px] font-semibold text-fg">{t.title}</span>
                  <span className="block truncate text-[12.5px] text-fg-3">{t.artist ?? "—"}</span>
                </button>
                <button type="button" onClick={() => (stop(), onPick({ url: t.url, title: t.title, artist: t.artist ?? "", cover: t.cover }))} className="press shrink-0 rounded-full bg-fg px-4 py-1.5 text-[13px] font-semibold text-bg">
                  Tanlash
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/** Musiqa tanlash (story va post kompozitori uchun umumiy): qidiruv varag'i + tanlangan trek kartasi */
export function MusicPicker({ value, onChange }: { value: MusicDraft | null; onChange: (m: MusicDraft | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {value ? (
        <div className="flex items-center gap-3 rounded-[16px] bg-fg/5 p-2.5">
          <Cover src={value.cover} size={44} />
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left" aria-label="Musiqani almashtirish">
            <span className="block truncate text-[14px] font-semibold text-fg">{value.title}</span>
            <span className="block truncate text-[12px] text-fg-3">{value.artist || "Musiqa"} · almashtirish</span>
          </button>
          <button type="button" onClick={() => onChange(null)} aria-label="Musiqani olib tashlash" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-fg/8">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="press flex h-12 w-full items-center gap-3 rounded-[16px] bg-fg/5 px-3.5 text-left transition hover:bg-fg/8">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ff7a45] to-[#c25cff] text-white">
            <Music2 size={15} />
          </span>
          <span className="text-[14.5px] font-semibold text-fg">Musiqa qo&apos;shish</span>
          <ChevronRight size={16} className="ml-auto text-fg-3" />
        </button>
      )}
      <MusicSheet
        open={open}
        onClose={() => setOpen(false)}
        onPick={(m) => {
          onChange(m);
          setOpen(false);
        }}
      />
    </>
  );
}

/** Limit ko'rsatkichi: premium/imtiyozli/admin — yashirin; oddiy — bo'lakli chiziq + «Bu hafta 1/3 · yana 2 ta» */
export function QuotaLine({ q, kind }: { q: QuotaInfo | null; kind: "posts" | "stories" }) {
  if (!q) return null;
  const part = q[kind];
  const noun = kind === "posts" ? "post" : "story";
  // Har tarifda chegara bor (Standart · Pro · Max) — limit chizig'i hammaga ko'rsatiladi
  if (part.limit === null) return null;
  const left = Math.max(0, part.limit - part.used);
  const upgrade = q.tier === "max" ? null : q.tier === "pro" ? "Max tarifda ko'proq" : "Pro va Max tariflarda ko'proq";
  return (
    <div className="w-full" role="status">
      {part.limit <= 14 ? (
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {Array.from({ length: part.limit }, (_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 max-w-10 rounded-full transition-colors", i < part.used ? (left === 0 ? "bg-danger" : "bg-accent") : "bg-fg/12")} />
          ))}
        </div>
      ) : (
        <div className="mx-auto h-1.5 max-w-xs overflow-hidden rounded-full bg-fg/12" aria-hidden>
          <span className={cn("block h-full rounded-full transition-[width]", left === 0 ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, (part.used / part.limit) * 100)}%` }} />
        </div>
      )}
      <p className={cn("mt-1.5 text-center text-[12.5px]", left === 0 ? "font-semibold text-danger-text" : "text-fg-3")}>
        {left === 0 ? `Bu hafta ${part.limit} ta ${noun} limiti tugadi` : `Haftalik limit: ${part.limit} ta ${noun} · yana ${left} ta qoldi`}
        {left === 0 && upgrade && <span className="block font-normal text-fg-3">{upgrade} — /narxlar</span>}
      </p>
    </div>
  );
}

/** Kvotani yuklaydi; `trigger` falsy bo'lsa so'ramaydi, qiymati o'zgarsa qayta yuklaydi (post joylangach) */
export function useQuota(trigger: boolean | number) {
  const [q, setQ] = useState<QuotaInfo | null>(null);
  useEffect(() => {
    if (!trigger) return;
    fetch("/api/social/quota")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: QuotaInfo }) => setQ(j.data ?? null))
      .catch(() => undefined);
  }, [trigger]);
  return q;
}

