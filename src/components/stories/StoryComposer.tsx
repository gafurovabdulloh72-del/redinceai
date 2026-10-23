"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronRight, HelpCircle, ImagePlus, Link2, Music2, Pause, Play, Search, Timer, Type, Upload, Users, UsersRound, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { uploadAttachment, uploadMusic, type Attachment } from "@/components/chat/attachments";
import { STORY_BACKGROUNDS, STORY_CAPTION_MAX, type QuotaInfo } from "@/lib/social/limits";
import { cn } from "@/lib/utils";
import { AudiencePicker } from "@/components/social/PostExtras";

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
function Cover({ src, size = 48, className }: { src?: string | null; size?: number; className?: string }) {
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
function MusicSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: MusicDraft) => void }) {
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
  // Premium / imtiyozli / admin — limit yo'q, hech narsa ko'rsatilmaydi (faqat oddiy foydalanuvchiga limit chizig'i)
  if (q.premium || part.limit === null) return null;
  const left = Math.max(0, part.limit - part.used);
  return (
    <div className="w-full" role="status">
      <div className="flex items-center justify-center gap-1.5" aria-hidden>
        {Array.from({ length: part.limit }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 max-w-10 rounded-full transition-colors", i < part.used ? (left === 0 ? "bg-danger" : "bg-accent") : "bg-fg/12")} />
        ))}
      </div>
      <p className={cn("mt-1.5 text-center text-[12.5px]", left === 0 ? "font-semibold text-danger-text" : "text-fg-3")}>
        {left === 0 ? `Bu hafta ${part.limit} ta ${noun} limiti tugadi` : `Haftalik limit: ${part.limit} ta ${noun} · yana ${left} ta qoldi`}
        {left === 0 && <span className="block font-normal text-fg-3">Premium obunada cheklov yo&apos;q</span>}
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

/**
 * Story yaratish: rasm/video yoki rangli fondagi matn, ixtiyoriy izoh va musiqa. Pastda kvota (oddiy: haftasiga 4 ta).
 */
export function StoryComposer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"media" | "text">("media");
  const [media, setMedia] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [bg, setBg] = useState("coral");
  // Stiker (bittadan) va auditoriya
  const [audience, setAudience] = useState<"public" | "close">("public");
  const [stickerKind, setStickerKind] = useState<"" | "poll" | "question" | "countdown" | "link">("");
  const [sQ, setSQ] = useState("");
  const [sA, setSA] = useState("Ha");
  const [sB, setSB] = useState("Yo'q");
  const [sAt, setSAt] = useState("");
  const [sUrl, setSUrl] = useState("");
  const [music, setMusic] = useState<MusicDraft | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const q = useQuota(open);
  const blocked = Boolean(q && !q.premium && q.stories.limit !== null && q.stories.used >= q.stories.limit);

  useEffect(() => {
    if (!open) {
      setMedia(null);
      setPreview(null);
      setCaption("");
      setMusic(null);
      setMode("media");
    }
  }, [open]);

  async function pick(f: File | undefined) {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setPreviewVideo(f.type.startsWith("video/"));
    setUploading(0);
    try {
      const a = await uploadAttachment(f, { docs: true, onProgress: (p) => setUploading(Math.round(p * 100)) });
      if (!/^(image|video)\//.test(a.type)) throw new Error("Faqat rasm yoki video");
      setMedia(a);
    } catch (e) {
      setPreview(null);
      showToast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function publish() {
    if (posting) return;
    if (mode === "media" && !media) return showToast("Rasm yoki video tanlang", "error");
    if (stickerKind && !stickerValid()) return showToast("Stiker maydonlarini to'ldiring", "error");
    if (mode === "text" && !caption.trim()) return showToast("Matn yozing", "error");
    setPosting(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media: mode === "media" ? media : null,
          caption: caption.trim(),
          bg: mode === "text" ? bg : null,
          music: music ? { url: music.url, title: music.title || "Musiqa", ...(music.artist ? { artist: music.artist } : {}) } : null,
          audience,
          sticker: buildSticker(),
        }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string> };
      if (!j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Joylanmadi");
      showToast("Story joylandi — 24 soat ko'rinadi", "success");
      onCreated();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Joylanmadi", "error");
    } finally {
      setPosting(false);
    }
  }

  /** Stiker to'g'ri to'ldirilganmi */
  function stickerValid(): boolean {
    if (stickerKind === "poll") return Boolean(sQ.trim() && sA.trim() && sB.trim());
    if (stickerKind === "question") return Boolean(sQ.trim());
    if (stickerKind === "countdown") return Boolean(sQ.trim() && sAt && new Date(sAt).getTime() > Date.now());
    if (stickerKind === "link") return /^https:\/\/\S+$/.test(sUrl.trim());
    return true;
  }

  /** Serverga yuboriladigan stiker obyekti */
  function buildSticker() {
    if (!stickerKind || !stickerValid()) return null;
    if (stickerKind === "poll") return { kind: "poll", question: sQ.trim(), options: [sA.trim(), sB.trim()] };
    if (stickerKind === "question") return { kind: "question", prompt: sQ.trim() };
    if (stickerKind === "countdown") return { kind: "countdown", title: sQ.trim(), at: new Date(sAt).getTime() };
    return { kind: "link", url: sUrl.trim(), label: sQ.trim() || "Havola" };
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Yangi story"
      size="md"
      footer={
        <div className="space-y-3 pb-1">
          <QuotaLine q={q} kind="stories" />
          <Button type="button" variant="accent" size="lg" className="w-full !rounded-full" onClick={() => void publish()} disabled={posting || uploading !== null || blocked}>
            {posting ? <Spinner /> : "Story'da ulashish"}
          </Button>
        </div>
      }
    >
      {/* Ko'rinish (9:16): rasm/video asl nisbatida (kesilmaydi), ustida Instagram uslubidagi asboblar */}
      <div className="relative mx-auto aspect-[9/16] w-[46%] min-w-[150px] max-w-[210px] overflow-hidden rounded-[22px] bg-[#0b0b0c] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)]">
        {mode === "media" ? (
          preview ? (
            <>
              {previewVideo ? <video src={preview} muted autoPlay loop playsInline className="h-full w-full object-contain" /> : <img src={preview} alt="" className="h-full w-full object-contain" />}
              {uploading !== null && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 text-[13px] font-semibold text-white">
                  <span className="flex flex-col items-center gap-2">
                    <Spinner /> {uploading}%
                  </span>
                </div>
              )}
              <button type="button" onClick={() => (setMedia(null), setPreview(null))} aria-label="Olib tashlash" className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                <X size={15} />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/80 transition hover:text-white">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/12 ring-1 ring-white/20">
                <ImagePlus size={24} />
              </span>
              <span className="px-4 text-center text-[13px] font-semibold">Rasm yoki video tanlang</span>
            </button>
          )
        ) : (
          <div className="grid h-full place-items-center p-5" style={{ background: STORY_BACKGROUNDS[bg] }}>
            <p className="text-balance break-words text-center font-display text-[19px] font-extrabold leading-tight text-white">{caption || "Matningiz"}</p>
          </div>
        )}
        {music && (
          <span className="absolute inset-x-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur">
            <Music2 size={12} className="shrink-0" /> <span className="truncate">{music.title}</span>
          </span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />

      <div className="mx-auto mt-4 flex w-fit rounded-full bg-fg/6 p-1" role="tablist" aria-label="Story turi">
        <button type="button" role="tab" aria-selected={mode === "media"} onClick={() => setMode("media")} className={cn("flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold transition", mode === "media" ? "bg-surface text-fg shadow-sm" : "text-fg-3")}>
          <ImagePlus size={15} /> Rasm / video
        </button>
        <button type="button" role="tab" aria-selected={mode === "text"} onClick={() => setMode("text")} className={cn("flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold transition", mode === "text" ? "bg-surface text-fg shadow-sm" : "text-fg-3")}>
          <Type size={15} /> Matn
        </button>
      </div>

      {mode === "text" && (
        <div className="mt-3 flex justify-center gap-2.5" role="radiogroup" aria-label="Fon">
          {Object.entries(STORY_BACKGROUNDS).map(([k, v]) => (
            <button key={k} type="button" role="radio" aria-checked={bg === k} aria-label={k} onClick={() => setBg(k)} className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition", bg === k && "ring-2 ring-fg")} style={{ background: v }} />
          ))}
        </div>
      )}

      <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, STORY_CAPTION_MAX))} rows={2} placeholder={mode === "text" ? "Nima demoqchisiz?" : "Izoh qo'shing…"} aria-label="Matn" className="mt-4 w-full resize-none rounded-[16px] bg-fg/5 px-4 py-3 text-[14.5px] text-fg outline-none placeholder:text-fg-3 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-fg/15" />
      <div className="mb-3 mt-3">
        <MusicPicker value={music} onChange={setMusic} />
      </div>

      {/* Kim ko'radi */}
      <div className="mb-3">
        <AudiencePicker value={audience} onChange={setAudience} />
      </div>

      {/* Stiker: bittadan — so'rovnoma / savol / hisoblagich / havola */}
      <div className="mb-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["poll", "So'rovnoma", BarChart3],
              ["question", "Savol", HelpCircle],
              ["countdown", "Hisoblagich", Timer],
              ["link", "Havola", Link2],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStickerKind((v) => (v === k ? "" : k))}
              aria-pressed={stickerKind === k}
              className={cn("press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition", stickerKind === k ? "border-fg bg-fg text-bg" : "border-line text-fg-2 hover:text-fg")}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        {stickerKind === "poll" && (
          <div className="expand-in space-y-2">
            <input value={sQ} onChange={(e) => setSQ(e.target.value)} maxLength={100} placeholder="Savol" aria-label="So'rovnoma savoli" className="field h-10 w-full text-[13.5px]" />
            <div className="flex gap-2">
              <input value={sA} onChange={(e) => setSA(e.target.value)} maxLength={30} aria-label="1-variant" className="field h-10 min-w-0 flex-1 text-[13.5px]" />
              <input value={sB} onChange={(e) => setSB(e.target.value)} maxLength={30} aria-label="2-variant" className="field h-10 min-w-0 flex-1 text-[13.5px]" />
            </div>
          </div>
        )}
        {stickerKind === "question" && <input value={sQ} onChange={(e) => setSQ(e.target.value)} maxLength={100} placeholder="Savolingiz (javoblar faqat sizga ko'rinadi)" aria-label="Savol" className="expand-in field h-10 w-full text-[13.5px]" />}
        {stickerKind === "countdown" && (
          <div className="expand-in flex gap-2">
            <input value={sQ} onChange={(e) => setSQ(e.target.value)} maxLength={60} placeholder="Nomi" aria-label="Hisoblagich nomi" className="field h-10 min-w-0 flex-1 text-[13.5px]" />
            <input type="datetime-local" value={sAt} onChange={(e) => setSAt(e.target.value)} aria-label="Sana" className="field h-10 min-w-0 flex-1 text-[13.5px]" />
          </div>
        )}
        {stickerKind === "link" && (
          <div className="expand-in flex gap-2">
            <input value={sUrl} onChange={(e) => setSUrl(e.target.value)} placeholder="https://…" aria-label="Havola" className="field h-10 min-w-0 flex-[2] text-[13.5px]" />
            <input value={sQ} onChange={(e) => setSQ(e.target.value)} maxLength={24} placeholder="Yorliq" aria-label="Havola yorlig'i" className="field h-10 min-w-0 flex-1 text-[13.5px]" />
          </div>
        )}
      </div>
    </Sheet>
  );
}
