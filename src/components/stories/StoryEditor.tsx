"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { AlignCenter, AlignLeft, AlignRight, BarChart3, Check, HelpCircle, ImagePlus, Link2, Maximize2, Minimize2, Music2, Palette, Plus, Send, Smile, Star, Timer, Trash2, Type, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { uploadAttachment, type Attachment } from "@/components/chat/attachments";
import type { StorySticker } from "@/lib/db/schema";
import { STORY_BACKGROUNDS, STORY_CAPTION_MAX } from "@/lib/social/limits";
import { STORY_ALIGNS, STORY_FONTS, STORY_FONT_FAMILY, STORY_FONT_LABEL, STORY_TEXT_COLORS, STORY_TEXT_SIZE, STORY_TEXT_STYLES, defaultTextDesign, type StoryDesign, type StoryTextDesign } from "@/lib/stories/design";
import { cn } from "@/lib/utils";
import { MusicSheet, useQuota, type MusicDraft } from "./StoryMusic";
import { StoryText, storyTextStyles } from "./StoryText";

/**
 * STORY MUHARRIRI (2026-11-11) — Instagram/Telegram uslubida to'liq ekranli:
 *  · bir nechta rasm/video birdan (har biri alohida slayd) yoki rangli fondagi matn;
 *  · matn tuval ustida: barmoq/sichqoncha bilan suriladi (markaz chiziqlari), bosilsa tahrir — shrift, uslub, rang, o'lcham, tekislash;
 *  · stikerlar (so'rovnoma · savol · hisoblagich · havola) — tuvalda ko'rinadi, vertikal suriladi;
 *  · musiqa, media sig'ishi (to'liq / to'ldirish), fon almashtirish;
 *  · pastda slaydlar lentasi, «Story'ingiz / Yaqin do'stlar» va yuborish.
 * Dizayn `stories.design`ga yoziladi (lib/stories/design.ts) — ko'ruvchi aynan shu `StoryText` bilan chizadi.
 * Qatlam z-110: varaqlar (`Sheet`, z-120) uning ustida ochiladi. Efir/qo'ng'iroq (135+) undan ham ustida.
 */
type StickerKind = StorySticker["kind"];
interface Slide {
  id: string;
  kind: "media" | "text";
  preview: string | null;
  isVideo: boolean;
  media: Attachment | null;
  uploading: number | null;
  failed: boolean;
  text: string;
  design: StoryTextDesign;
  bg: string;
  fit: "contain" | "cover";
  sticker: StorySticker | null;
  stickerY: number;
  music: MusicDraft | null;
}
const MAX_SLIDES = 6;
const BG_KEYS = Object.keys(STORY_BACKGROUNDS);
const uidLocal = () => Math.random().toString(36).slice(2, 10);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const newSlide = (kind: "media" | "text", extra: Partial<Slide> = {}): Slide => ({
  id: uidLocal(),
  kind,
  preview: null,
  isVideo: false,
  media: null,
  uploading: null,
  failed: false,
  text: "",
  design: defaultTextDesign(kind),
  bg: BG_KEYS[Math.floor(Math.random() * 6)] ?? "coral",
  fit: "contain",
  sticker: null,
  stickerY: 0.48,
  music: null,
  ...extra,
});

const STICKERS: Array<{ kind: StickerKind; label: string; hint: string; Icon: typeof BarChart3; tone: string }> = [
  { kind: "poll", label: "So'rovnoma", hint: "Ikki variantli ovoz", Icon: BarChart3, tone: "from-[#ff7a45] to-[#e0412b]" },
  { kind: "question", label: "Savol", hint: "Javoblar faqat sizga", Icon: HelpCircle, tone: "from-[#a78bfa] to-[#ec4899]" },
  { kind: "countdown", label: "Hisoblagich", hint: "Sanagacha ortga sanash", Icon: Timer, tone: "from-[#2f6fd6] to-[#1aa3a3]" },
  { kind: "link", label: "Havola", hint: "Bosiladigan tugma", Icon: Link2, tone: "from-[#1f8a5b] to-[#0f4c3a]" },
];

/** Tuvaldagi stiker ko'rinishi (faqat ko'rsatish — haqiqiy ovoz/javob ko'ruvchida) */
function StickerPreview({ s }: { s: StorySticker }) {
  const card = "w-[72cqw] rounded-[5cqw] bg-white px-[4cqw] py-[3.6cqw] text-center text-[#0b0b0c] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]";
  if (s.kind === "poll")
    return (
      <div className={card} data-no-auto>
        <p className="text-[4.4cqw] font-bold leading-tight">{s.question}</p>
        <div className="mt-[2.6cqw] grid grid-cols-2 gap-[2cqw]">
          {s.options.map((o, i) => (
            <span key={i} className="truncate rounded-[3cqw] bg-black/6 px-[2cqw] py-[2.2cqw] text-[3.8cqw] font-semibold">
              {o}
            </span>
          ))}
        </div>
      </div>
    );
  if (s.kind === "question")
    return (
      <div className={card} data-no-auto>
        <p className="text-[4.4cqw] font-bold leading-tight">{s.prompt}</p>
        <span className="mt-[2.6cqw] block rounded-[3cqw] bg-black/6 py-[2.4cqw] text-[3.6cqw] text-black/45">Javob yozing…</span>
      </div>
    );
  if (s.kind === "countdown") {
    const left = Math.max(0, s.at - Date.now());
    const d = Math.floor(left / 86_400_000);
    const h = Math.floor((left % 86_400_000) / 3_600_000);
    const m = Math.floor((left % 3_600_000) / 60_000);
    return (
      <div className={card} data-no-auto>
        <p className="text-[3.8cqw] font-bold uppercase tracking-wide text-black/60">{s.title}</p>
        <p className="mt-[1.6cqw] text-[7.4cqw] font-bold tabular-nums leading-none">
          {d > 0 ? `${d} kun ` : ""}
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
        </p>
      </div>
    );
  }
  return (
    <div className="inline-flex max-w-[78cqw] items-center gap-[1.6cqw] rounded-full bg-white px-[4.4cqw] py-[2.6cqw] text-[4cqw] font-bold text-[#2f6fd6] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]" data-no-auto>
      <Link2 className="h-[4.4cqw] w-[4.4cqw] shrink-0" /> <span className="truncate">{s.label || "Havola"}</span>
    </div>
  );
}

/** Stiker yaratish varag'i: turini tanlash → maydonlar → «Qo'shish» */
function StickerSheet({ open, onClose, value, onDone }: { open: boolean; onClose: () => void; value: StorySticker | null; onDone: (s: StorySticker | null) => void }) {
  const [kind, setKind] = useState<StickerKind | null>(null);
  const [q, setQ] = useState("");
  const [a, setA] = useState("Ha");
  const [b, setB] = useState("Yo'q");
  const [at, setAt] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!open) return;
    setKind(value?.kind ?? null);
    setQ(value ? (value.kind === "poll" ? value.question : value.kind === "question" ? value.prompt : value.kind === "countdown" ? value.title : value.label) : "");
    setA(value?.kind === "poll" ? value.options[0] : "Ha");
    setB(value?.kind === "poll" ? value.options[1] : "Yo'q");
    setAt(value?.kind === "countdown" ? new Date(value.at - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
    setUrl(value?.kind === "link" ? value.url : "");
  }, [open, value]);

  const built: StorySticker | null =
    kind === "poll" && q.trim() && a.trim() && b.trim()
      ? { kind, question: q.trim(), options: [a.trim(), b.trim()] }
      : kind === "question" && q.trim()
        ? { kind, prompt: q.trim() }
        : kind === "countdown" && q.trim() && at && new Date(at).getTime() > Date.now()
          ? { kind, title: q.trim(), at: new Date(at).getTime() }
          : kind === "link" && /^https:\/\/\S+\.\S+/.test(url.trim())
            ? { kind, url: url.trim(), label: q.trim() || "Havola" }
            : null;
  const field = "field h-11 w-full text-[14.5px] max-md:text-[16px]";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={kind ? STICKERS.find((s) => s.kind === kind)!.label : "Stikerlar"}
      size="md"
      footer={
        kind ? (
          <div className="flex gap-2 pb-1">
            <button type="button" onClick={() => setKind(null)} className="press h-12 rounded-full border border-line px-5 text-[14.5px] font-semibold text-fg-2">
              Orqaga
            </button>
            <button type="button" disabled={!built} onClick={() => (onDone(built), onClose())} className="press h-12 flex-1 rounded-full bg-fg text-[14.5px] font-semibold text-bg disabled:opacity-40">
              {value ? "Saqlash" : "Qo'shish"}
            </button>
          </div>
        ) : value ? (
          <button type="button" onClick={() => (onDone(null), onClose())} className="press mb-1 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line text-[14.5px] font-semibold text-danger-text">
            <Trash2 size={16} /> Stikerni olib tashlash
          </button>
        ) : undefined
      }
    >
      {!kind ? (
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {STICKERS.map((s) => (
            <button key={s.kind} type="button" onClick={() => setKind(s.kind)} className="press flex flex-col items-start gap-3 rounded-[18px] border border-line p-3.5 text-left transition hover:border-fg/30">
              <span className={cn("grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white", s.tone)}>
                <s.Icon size={20} />
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold text-fg">{s.label}</span>
                <span className="block text-[12.5px] leading-snug text-fg-3">{s.hint}</span>
              </span>
            </button>
          ))}
          <p className="col-span-2 pt-1 text-center text-[12.5px] text-fg-3">Bitta story'ga bitta stiker qo&apos;yiladi</p>
        </div>
      ) : (
        <div className="space-y-2.5 pb-2">
          {kind === "link" && <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Havola manzili" dir="ltr" inputMode="url" className={field} />}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={kind === "link" ? 24 : kind === "countdown" ? 60 : 100}
            placeholder={kind === "poll" ? "Savolingiz" : kind === "question" ? "Menga savol bering" : kind === "countdown" ? "Nima kutilyapti?" : "Tugma yozuvi (ixtiyoriy)"}
            aria-label="Stiker matni"
            className={field}
          />
          {kind === "poll" && (
            <div className="flex gap-2">
              <input value={a} onChange={(e) => setA(e.target.value)} maxLength={30} aria-label="1-variant" className={cn(field, "min-w-0 flex-1")} />
              <input value={b} onChange={(e) => setB(e.target.value)} maxLength={30} aria-label="2-variant" className={cn(field, "min-w-0 flex-1")} />
            </div>
          )}
          {kind === "countdown" && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Sana va vaqt" className={field} />}
          <p className="text-[12.5px] text-fg-3">{kind === "question" ? "Javoblar faqat sizga ko'rinadi." : kind === "link" ? "Faqat https havola." : kind === "countdown" ? "Kelajakdagi vaqtni tanlang." : "Natijani ovoz berganlar ko'radi."}</p>
        </div>
      )}
    </Sheet>
  );
}

/** Dumaloq asbob tugmasi (tuval ustida) */
function Tool({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cn("press grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition", active ? "bg-white text-black" : "bg-black/45 text-white hover:bg-black/60")}>
      {children}
    </button>
  );
}

export function StoryEditor({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [cur, setCur] = useState(0);
  const [editing, setEditing] = useState(false);
  const [audience, setAudience] = useState<"public" | "close">("public");
  const [stickerOpen, setStickerOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [guide, setGuide] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const confirm = useConfirm();
  const q = useQuota(open);
  useScrollLock(open);
  useEffect(() => setMounted(true), []);

  const left = q && q.stories.limit !== null ? Math.max(0, q.stories.limit - q.stories.used) : MAX_SLIDES;
  const room = Math.min(MAX_SLIDES, left) - slides.length;
  const slide = slides[cur] ?? null;
  const patch = useCallback((id: string, p: Partial<Slide> | ((s: Slide) => Partial<Slide>)) => setSlides((l) => l.map((s) => (s.id === id ? { ...s, ...(typeof p === "function" ? p(s) : p) } : s))), []);
  const patchDesign = (p: Partial<StoryTextDesign>) => slide && patch(slide.id, (s) => ({ design: { ...s.design, ...p } }));

  // Yopilganda tozalash (ko'rik manzillari bo'shatiladi)
  useEffect(() => {
    if (open) return;
    setSlides((l) => {
      l.forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
      return [];
    });
    setCur(0);
    setEditing(false);
    setAudience("public");
    setPosting(null);
  }, [open]);

  const dirty = slides.some((s) => s.media || s.preview || s.text.trim() || s.sticker || s.music);
  const close = useCallback(async () => {
    if (posting) return;
    if (dirty && !(await confirm({ title: "Story bekor qilinsinmi?", text: "Tayyorlaganingiz saqlanmaydi.", confirmLabel: "Ha, bekor qilish", cancelLabel: "Davom etish", danger: true }))) return;
    onClose();
  }, [confirm, dirty, onClose, posting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stickerOpen || musicOpen) return;
      if (editing) setEditing(false);
      else void close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing, close, stickerOpen, musicOpen]);

  useEffect(() => {
    if (editing) areaRef.current?.focus();
  }, [editing, cur]);

  /** Fayllarni qo'shish: har biri alohida slayd, yuklash fon rejimida */
  function addFiles(list: FileList | File[] | null | undefined) {
    const files = [...(list ?? [])].filter((f) => /^(image|video)\//.test(f.type));
    if (!files.length) return;
    if (room <= 0) return showToast(left <= 0 ? "Bu hafta story limiti tugadi" : `Birdan ko'pi bilan ${MAX_SLIDES} ta`, "error");
    const take = files.slice(0, room);
    if (take.length < files.length) showToast(`Faqat ${take.length} tasi qo'shildi`, "info");
    const fresh = take.map((f) => newSlide("media", { preview: URL.createObjectURL(f), isVideo: f.type.startsWith("video/"), uploading: 0 }));
    setSlides((l) => {
      setCur(l.length);
      return [...l, ...fresh];
    });
    take.forEach((f, i) => {
      const id = fresh[i].id;
      uploadAttachment(f, { docs: true, onProgress: (p) => patch(id, { uploading: Math.round(p * 100) }) })
        .then((a) => {
          if (!/^(image|video)\//.test(a.type)) throw new Error("Faqat rasm yoki video");
          patch(id, { media: a, uploading: null });
        })
        .catch((e) => {
          patch(id, { uploading: null, failed: true });
          showToast(e instanceof Error ? e.message : "Yuklanmadi", "error");
        });
    });
    if (fileRef.current) fileRef.current.value = "";
  }
  function addText() {
    if (room <= 0) return showToast(left <= 0 ? "Bu hafta story limiti tugadi" : `Birdan ko'pi bilan ${MAX_SLIDES} ta`, "error");
    setSlides((l) => {
      setCur(l.length);
      return [...l, newSlide("text")];
    });
    setEditing(true);
  }
  function removeSlide(id: string) {
    setSlides((l) => {
      const s = l.find((x) => x.id === id);
      if (s?.preview) URL.revokeObjectURL(s.preview);
      const next = l.filter((x) => x.id !== id);
      setCur((c) => clamp(c, 0, Math.max(0, next.length - 1)));
      return next;
    });
    setEditing(false);
  }

  /** Tuvalda surish: matn (x, y) yoki stiker (y). Qimirlamasa — bosish (matnda tahrirni ochadi). */
  function drag(e: ReactPointerEvent, what: "text" | "sticker") {
    if (!slide || editing) return;
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = slide.design.x;
    const oy = what === "text" ? slide.design.y : slide.stickerY;
    const id = slide.id;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / box.width;
      const dy = (ev.clientY - sy) / box.height;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      moved = true;
      let nx = clamp(ox + dx, 0.08, 0.92);
      let ny = clamp(oy + dy, 0.1, 0.9);
      const snapV = Math.abs(nx - 0.5) < 0.025;
      const snapH = Math.abs(ny - 0.5) < 0.02;
      if (snapV) nx = 0.5;
      if (snapH) ny = 0.5;
      if (what === "text") {
        setGuide({ v: snapV, h: snapH });
        patch(id, (s) => ({ design: { ...s.design, x: nx, y: ny } }));
      } else {
        setGuide({ v: false, h: snapH });
        patch(id, { stickerY: ny });
      }
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setGuide({ v: false, h: false });
      if (!moved) {
        if (what === "text") setEditing(true);
        else setStickerOpen(true);
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  async function publish() {
    if (posting || !slides.length) return;
    const bad = slides.findIndex((s) => (s.kind === "media" ? !s.media : !s.text.trim()));
    if (bad >= 0) {
      setCur(bad);
      const s = slides[bad];
      return showToast(s.kind === "text" ? "Matn yozing" : s.uploading !== null ? "Yuklanishi tugashini kuting" : "Fayl yuklanmadi — olib tashlang yoki qayta tanlang", "error");
    }
    let done = 0;
    try {
      for (const s of slides) {
        setPosting(slides.length > 1 ? `${done + 1}/${slides.length}` : "");
        const text = s.text.trim();
        const design: StoryDesign = { ...(text ? { text: s.design } : {}), ...(s.sticker ? { stickerY: s.stickerY } : {}), ...(s.kind === "media" ? { fit: s.fit } : {}) };
        const res = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media: s.kind === "media" ? s.media : null,
            caption: text,
            bg: s.kind === "text" ? s.bg : null,
            music: s.music ? { url: s.music.url, title: s.music.title || "Musiqa", ...(s.music.artist ? { artist: s.music.artist } : {}) } : null,
            audience,
            sticker: s.sticker,
            design,
          }),
        });
        const j = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string> };
        if (!j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Joylanmadi");
        done++;
      }
      showToast(done > 1 ? `${done} ta story joylandi — 24 soat ko'rinadi` : "Story joylandi — 24 soat ko'rinadi", "success");
      onCreated();
      onClose();
    } catch (e) {
      // Joylanganlari ro'yxatdan chiqariladi — qayta bosilganda takror ketmasin
      if (done > 0) {
        setSlides((l) => l.slice(done));
        setCur(0);
        onCreated();
      }
      showToast(e instanceof Error ? e.message : "Joylanmadi", "error");
    } finally {
      setPosting(null);
    }
  }

  if (!open || !mounted) return null;
  const blocked = left <= 0 && slides.length === 0;
  const ts = slide ? storyTextStyles(slide.design) : null;

  return createPortal(
    <div className="overlay-in fixed inset-0 z-[110] flex flex-col items-center bg-black text-white sm:justify-center sm:bg-black/92 sm:p-4" role="dialog" aria-modal="true" aria-label="Yangi story" data-story-editor>
      <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => addFiles(e.target.files)} />

      {/* TUVAL (9:16). Telefonda — pastki panelgacha butun ekran; keng ekranda — markazda */}
      <div
        ref={canvasRef}
        className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#0b0b0c] sm:aspect-[9/16] sm:w-auto sm:flex-none sm:rounded-[24px] sm:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] sm:[height:min(calc(100dvh-11.5rem),780px)]"
        style={{ containerType: "inline-size" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        {!slide ? (
          /* BOSHLANG'ICH EKRAN */
          <div className="flex h-full flex-col items-center justify-center gap-7 px-8 text-center">
            <div>
              <p className="text-[22px] font-bold leading-tight">Yangi story</p>
              <p className="mt-1.5 text-[14px] leading-snug text-white/60">{blocked ? "Bu hafta story limiti tugadi" : "24 soat ko'rinadi. Bir nechta rasm yoki videoni birdan tanlash mumkin."}</p>
            </div>
            <div className="grid w-full max-w-[300px] grid-cols-2 gap-3">
              <button type="button" disabled={blocked} onClick={() => fileRef.current?.click()} className="press flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-[22px] bg-white/8 ring-1 ring-white/12 transition hover:bg-white/14 disabled:opacity-40">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#ff7a45] to-[#e0412b]">
                  <ImagePlus size={24} />
                </span>
                <span className="text-[14.5px] font-semibold">Galereya</span>
              </button>
              <button type="button" disabled={blocked} onClick={addText} className="press flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-[22px] bg-white/8 ring-1 ring-white/12 transition hover:bg-white/14 disabled:opacity-40">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#ec4899]">
                  <Type size={24} />
                </span>
                <span className="text-[14.5px] font-semibold">Matn</span>
              </button>
            </div>
            {blocked ? (
              <a href="/narxlar" className="text-[13.5px] font-semibold text-white underline underline-offset-4">
                Pro va Max tariflarda ko&apos;proq
              </a>
            ) : (
              <p className="text-[12.5px] text-white/45 max-sm:hidden">Faylni shu yerga sudrab tashlasangiz ham bo&apos;ladi</p>
            )}
          </div>
        ) : (
          <>
            {/* FON: media yoki gradient */}
            {slide.kind === "media" ? (
              slide.preview &&
              (slide.isVideo ? (
                <video key={slide.id} src={slide.preview} muted autoPlay loop playsInline className={cn("h-full w-full", slide.fit === "cover" ? "object-cover" : "object-contain")} />
              ) : (
                <>
                  {slide.fit === "contain" && <img src={slide.preview} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />}
                  <img key={slide.id} src={slide.preview} alt="" className={cn("relative h-full w-full", slide.fit === "cover" ? "object-cover" : "object-contain")} />
                </>
              ))
            ) : (
              <div className="absolute inset-0" style={{ background: STORY_BACKGROUNDS[slide.bg] }} />
            )}

            {/* Markaz chiziqlari (surish paytida) */}
            {guide.v && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#ffd166]" />}
            {guide.h && <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#ffd166]" />}

            {/* STIKER */}
            {slide.sticker && !editing && (
              <div onPointerDown={(e) => drag(e, "sticker")} className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none justify-center active:cursor-grabbing" style={{ top: `${slide.stickerY * 100}%` }}>
                <StickerPreview s={slide.sticker} />
              </div>
            )}

            {/* MATN (surish / bosib tahrirlash) */}
            {!editing &&
              (slide.text.trim() ? (
                <div onPointerDown={(e) => drag(e, "text")} className="absolute inset-0 touch-none [&>div]:pointer-events-auto [&>div]:cursor-grab [&>div]:active:cursor-grabbing pointer-events-none">
                  <StoryText text={slide.text} design={slide.design} />
                </div>
              ) : (
                slide.kind === "text" && (
                  <button type="button" onClick={() => setEditing(true)} className="absolute inset-0 grid place-items-center text-[7cqw] font-bold text-white/55">
                    Yozish uchun bosing
                  </button>
                )
              ))}

            {/* Musiqa belgisi */}
            {slide.music && !editing && (
              <span className="absolute left-3 top-[calc(env(safe-area-inset-top)+4.25rem)] flex max-w-[62%] items-center rounded-full bg-black/50 text-[12px] font-semibold backdrop-blur-md" data-no-auto>
                <button type="button" onClick={() => setMusicOpen(true)} className="flex min-w-0 items-center gap-1.5 py-1.5 pl-3 pr-1" aria-label="Musiqani almashtirish">
                  <Music2 size={13} className="shrink-0" /> <span className="truncate">{slide.music.title}</span>
                </button>
                <button type="button" onClick={() => patch(slide.id, { music: null })} aria-label="Musiqani olib tashlash" className="grid h-8 w-8 shrink-0 place-items-center rounded-full">
                  <X size={13} />
                </button>
              </span>
            )}

            {/* Yuklanish / xato */}
            {slide.uploading !== null && (
              <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-semibold backdrop-blur-md">
                <Spinner /> Yuklanmoqda {slide.uploading}%
              </span>
            )}
            {slide.failed && <span className="absolute bottom-3 left-3 rounded-full bg-[#e0412b] px-3 py-1.5 text-[12px] font-semibold">Yuklanmadi — olib tashlang</span>}

            {/* ASBOBLAR */}
            {!editing && (
              <>
                <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/45 to-transparent p-3 pb-10 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                  <Tool label="Yopish" onClick={() => void close()}>
                    <X size={20} />
                  </Tool>
                  <div className="flex flex-col gap-2.5">
                    <Tool label="Matn" active={Boolean(slide.text.trim())} onClick={() => setEditing(true)}>
                      <Type size={19} />
                    </Tool>
                    <Tool label="Stiker" active={Boolean(slide.sticker)} onClick={() => setStickerOpen(true)}>
                      <Smile size={20} />
                    </Tool>
                    <Tool label="Musiqa" active={Boolean(slide.music)} onClick={() => setMusicOpen(true)}>
                      <Music2 size={19} />
                    </Tool>
                    {slide.kind === "media" ? (
                      <Tool label={slide.fit === "cover" ? "To'liq ko'rsatish" : "Ekranni to'ldirish"} onClick={() => patch(slide.id, { fit: slide.fit === "cover" ? "contain" : "cover" })}>
                        {slide.fit === "cover" ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </Tool>
                    ) : (
                      <Tool label="Fonni almashtirish" onClick={() => patch(slide.id, { bg: BG_KEYS[(BG_KEYS.indexOf(slide.bg) + 1) % BG_KEYS.length] })}>
                        <Palette size={19} />
                      </Tool>
                    )}
                    <Tool label="Slaydni o'chirish" onClick={() => removeSlide(slide.id)}>
                      <Trash2 size={18} />
                    </Tool>
                  </div>
                </div>
                {slide.kind === "text" && (
                  <div className="no-scrollbar absolute inset-x-0 bottom-3 flex justify-center gap-2 overflow-x-auto px-3" role="radiogroup" aria-label="Fon">
                    {BG_KEYS.map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={slide.bg === k} aria-label={`Fon: ${k}`} onClick={() => patch(slide.id, { bg: k })} className={cn("h-7 w-7 shrink-0 rounded-full ring-2 transition", slide.bg === k ? "ring-white" : "ring-white/25")} style={{ background: STORY_BACKGROUNDS[k] }} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* MATN TAHRIRI */}
            {editing && ts && (
              <div className="absolute inset-0 flex flex-col bg-black/55 backdrop-blur-[2px]">
                <div className="flex items-center justify-between gap-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                  <div className="flex gap-1.5">
                    <button type="button" aria-label="Tekislash" title="Tekislash" onClick={() => patchDesign({ align: STORY_ALIGNS[(STORY_ALIGNS.indexOf(slide.design.align) + 1) % STORY_ALIGNS.length] })} className="press grid h-10 w-10 place-items-center rounded-full bg-white/14">
                      {slide.design.align === "left" ? <AlignLeft size={18} /> : slide.design.align === "right" ? <AlignRight size={18} /> : <AlignCenter size={18} />}
                    </button>
                    <button type="button" aria-label="Matn uslubi" title="Matn uslubi" onClick={() => patchDesign({ style: STORY_TEXT_STYLES[(STORY_TEXT_STYLES.indexOf(slide.design.style) + 1) % STORY_TEXT_STYLES.length] })} className={cn("press grid h-10 w-10 place-items-center rounded-full text-[15px] font-bold", slide.design.style === "plain" ? "bg-white/14" : slide.design.style === "box" ? "bg-white text-black" : "bg-black/60 ring-1 ring-white/40")}>
                      A
                    </button>
                  </div>
                  <button type="button" onClick={() => setEditing(false)} className="press flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-bold text-black">
                    <Check size={16} /> Tayyor
                  </button>
                </div>
                <div className="relative flex min-h-0 flex-1 items-center justify-center px-[7cqw]">
                  {/* O'lcham — chapda vertikal surgich */}
                  <input
                    type="range"
                    aria-label="Matn o'lchami"
                    min={STORY_TEXT_SIZE.min}
                    max={STORY_TEXT_SIZE.max}
                    step={STORY_TEXT_SIZE.step}
                    value={slide.design.size}
                    onChange={(e) => patchDesign({ size: Number(e.target.value) })}
                    className="absolute left-1 top-1/2 h-6 w-[38cqw] -translate-x-[calc(50%-14px)] -translate-y-1/2 -rotate-90 accent-white"
                  />
                  <textarea
                    ref={areaRef}
                    value={slide.text}
                    onChange={(e) => patch(slide.id, { text: e.target.value.slice(0, STORY_CAPTION_MAX) })}
                    rows={Math.min(8, Math.max(1, slide.text.split("\n").length))}
                    placeholder="Yozing…"
                    aria-label="Story matni"
                    data-no-auto
                    className="w-full resize-none bg-transparent outline-none placeholder:text-white/45 focus:outline-none focus-visible:outline-none"
                    style={{ ...ts.wrap, ...(slide.design.style === "box" ? { color: "#fff" } : {}), background: "transparent", backdropFilter: undefined, WebkitBackdropFilter: undefined, padding: 0, maxHeight: "60%", caretColor: "#fff" }}
                  />
                  <span className="absolute bottom-1 right-3 text-[11.5px] tabular-nums text-white/55">
                    {slide.text.length}/{STORY_CAPTION_MAX}
                  </span>
                </div>
                <div className="space-y-2.5 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                  <div className="no-scrollbar flex justify-center gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Shrift">
                    {STORY_FONTS.map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={slide.design.font === f} onClick={() => patchDesign({ font: f })} className={cn("press h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition", slide.design.font === f ? "bg-white text-black" : "bg-white/14 text-white")} style={{ fontFamily: STORY_FONT_FAMILY[f] }}>
                        {STORY_FONT_LABEL[f]}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center gap-2.5" role="radiogroup" aria-label="Rang">
                    {STORY_TEXT_COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={slide.design.color === c} aria-label={`Rang ${c}`} onClick={() => patchDesign({ color: c })} className={cn("h-7 w-7 rounded-full ring-2 transition", slide.design.color === c ? "scale-110 ring-white" : "ring-white/30")} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {!slide && (
          <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)]">
            <Tool label="Yopish" onClick={() => void close()}>
              <X size={20} />
            </Tool>
          </div>
        )}
      </div>

      {/* PASTKI PANEL: slaydlar, kim ko'radi, yuborish */}
      {slide && (
        <div className="w-full shrink-0 space-y-2.5 bg-black px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2.5 sm:mt-3 sm:w-auto sm:min-w-[380px] sm:rounded-[20px] sm:bg-white/8 sm:pb-3">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => (setCur(i), setEditing(false))} aria-label={`${i + 1}-slayd`} aria-current={i === cur} className={cn("relative h-14 w-9 shrink-0 overflow-hidden rounded-[9px] ring-2 transition", i === cur ? "ring-white" : "ring-transparent opacity-70")}>
                {s.kind === "media" ? (
                  s.preview && (s.isVideo ? <video src={s.preview} muted className="h-full w-full object-cover" /> : <img src={s.preview} alt="" className="h-full w-full object-cover" />)
                ) : (
                  <span className="grid h-full w-full place-items-center text-[11px] font-bold" style={{ background: STORY_BACKGROUNDS[s.bg] }}>
                    Aa
                  </span>
                )}
                {s.uploading !== null && <span className="absolute inset-0 grid place-items-center bg-black/55 text-[9.5px] font-bold">{s.uploading}%</span>}
                {s.failed && <span className="absolute inset-0 grid place-items-center bg-[#e0412b]/80 text-[11px] font-bold">!</span>}
              </button>
            ))}
            {room > 0 && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()} aria-label="Rasm yoki video qo'shish" className="press grid h-14 w-9 shrink-0 place-items-center rounded-[9px] border border-dashed border-white/35 text-white/75">
                  <Plus size={16} />
                </button>
                <button type="button" onClick={addText} aria-label="Matnli slayd qo'shish" className="press grid h-14 w-9 shrink-0 place-items-center rounded-[9px] border border-dashed border-white/35 text-[12px] font-bold text-white/75">
                  Aa
                </button>
              </>
            )}
            {q && q.stories.limit !== null && <span className="ml-auto shrink-0 pl-2 text-[11.5px] text-white/50">Haftada qoldi: {Math.max(0, left - slides.length)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAudience("public")} aria-pressed={audience === "public"} className={cn("press flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-[13.5px] font-semibold transition", audience === "public" ? "bg-white text-black" : "bg-white/12 text-white")}>
              <span className="truncate">Story&apos;ingiz</span>
            </button>
            <button type="button" onClick={() => setAudience("close")} aria-pressed={audience === "close"} className={cn("press flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold transition", audience === "close" ? "bg-[#1f8a5b] text-white" : "bg-white/12 text-white")}>
              <Star size={14} className="shrink-0" fill={audience === "close" ? "currentColor" : "none"} /> <span className="truncate">Yaqin do&apos;stlar</span>
            </button>
            <button type="button" onClick={() => void publish()} disabled={posting !== null || slides.some((s) => s.uploading !== null)} aria-label="Story'ni joylash" className="press flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#ff5a36] px-4 text-[14px] font-bold text-white transition disabled:opacity-50">
              {posting !== null ? (
                <>
                  <Spinner /> {posting}
                </>
              ) : (
                <>
                  <span className="max-[420px]:hidden">Joylash</span> <Send size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <StickerSheet open={stickerOpen} onClose={() => setStickerOpen(false)} value={slide?.sticker ?? null} onDone={(s) => slide && patch(slide.id, { sticker: s })} />
      <MusicSheet
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        onPick={(m) => {
          if (slide) patch(slide.id, { music: m });
          setMusicOpen(false);
        }}
      />
    </div>,
    document.body,
  );
}
