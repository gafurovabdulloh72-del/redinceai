"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, ImagePlus, Music2, Type, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { uploadAttachment, uploadMusic, type Attachment } from "@/components/chat/attachments";
import { STORY_BACKGROUNDS, STORY_CAPTION_MAX, type QuotaInfo } from "@/lib/social/limits";
import { cn } from "@/lib/utils";

export interface MusicDraft {
  url: string;
  title: string;
  artist: string;
}

/** Musiqa tanlash bloki (story va post kompozitori uchun umumiy): audio yuklash + nomi/ijrochisi */
export function MusicPicker({ value, onChange }: { value: MusicDraft | null; onChange: (m: MusicDraft | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadMusic(f);
      onChange({ url, title: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80), artist: "" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div>
      <input ref={ref} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {value ? (
        <div className="rounded-[14px] border border-line bg-surface-2/60 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white">
              <Music2 size={16} />
            </span>
            <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value.slice(0, 80) })} placeholder="Qo'shiq nomi" aria-label="Qo'shiq nomi" className="field h-10 min-w-0 flex-1 text-[14px]" />
            <button type="button" onClick={() => onChange(null)} aria-label="Musiqani olib tashlash" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-fg/6">
              <X size={16} />
            </button>
          </div>
          <input value={value.artist} onChange={(e) => onChange({ ...value, artist: e.target.value.slice(0, 80) })} placeholder="Ijrochi (ixtiyoriy)" aria-label="Ijrochi" className="field mt-2 h-10 w-full text-[14px]" />
          <audio src={value.url} controls className="mt-2 h-9 w-full" />
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="press flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-2 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
          {busy ? <Spinner /> : <Music2 size={16} />} Musiqa qo&apos;shish <span className="font-normal text-fg-4">(MP3, 5 MB gacha)</span>
        </button>
      )}
    </div>
  );
}

/** Kvota satri: «Bugun 1 / 4» yoki «Premium — cheksiz» */
export function QuotaLine({ q, kind }: { q: QuotaInfo | null; kind: "posts" | "stories" }) {
  if (!q) return null;
  const part = q[kind];
  if (q.premium || part.limit === null)
    return (
      <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-text">
        <Crown size={13} /> Premium — cheksiz
      </p>
    );
  const left = Math.max(0, part.limit - part.used);
  return (
    <p className={cn("text-[12.5px]", left === 0 ? "font-semibold text-danger-text" : "text-fg-3")}>
      {kind === "posts" ? "Bu hafta" : "Bugun"}: {part.used} / {part.limit} {left === 0 ? "— limit tugadi" : `· yana ${left} ta`}
      {left === 0 && <span className="text-fg-3"> · Premium obunada cheklov yo&apos;q</span>}
    </p>
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
 * Story yaratish: rasm/video yoki rangli fondagi matn, ixtiyoriy izoh va musiqa. Pastda kvota (oddiy: sutkada 4 ta).
 */
export function StoryComposer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"media" | "text">("media");
  const [media, setMedia] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [bg, setBg] = useState("coral");
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
    if (mode === "text" && !caption.trim()) return showToast("Matn yozing", "error");
    setPosting(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media: mode === "media" ? media : null, caption: caption.trim(), bg: mode === "text" ? bg : null, music: music ? { url: music.url, title: music.title || "Musiqa", ...(music.artist ? { artist: music.artist } : {}) } : null }),
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Yangi story"
      size="md"
      footer={
        <div className="space-y-2">
          <QuotaLine q={q} kind="stories" />
          <Button type="button" variant="accent" size="lg" className="w-full" onClick={() => void publish()} disabled={posting || uploading !== null || blocked}>
            {posting ? <Spinner /> : "Joylash"}
          </Button>
        </div>
      }
    >
      <div className="segment mb-4 w-full" role="tablist" aria-label="Story turi">
        <button type="button" role="tab" aria-selected={mode === "media"} data-active={mode === "media"} onClick={() => setMode("media")} className="segment-item min-h-10 flex-1">
          <ImagePlus size={15} className="mr-1.5 inline" /> Rasm / video
        </button>
        <button type="button" role="tab" aria-selected={mode === "text"} data-active={mode === "text"} onClick={() => setMode("text")} className="segment-item min-h-10 flex-1">
          <Type size={15} className="mr-1.5 inline" /> Matn
        </button>
      </div>

      {/* Ko'rinish (9:16) */}
      <div className="mx-auto mb-4 aspect-[9/16] w-[46%] min-w-[150px] max-w-[220px] overflow-hidden rounded-[18px] border border-line bg-[#0b0b0c]">
        {mode === "media" ? (
          preview ? (
            <div className="relative h-full w-full">
              {previewVideo ? <video src={preview} muted autoPlay loop playsInline className="h-full w-full object-cover" /> : <img src={preview} alt="" className="h-full w-full object-cover" />}
              {uploading !== null && (
                <div className="absolute inset-0 grid place-items-center bg-black/50 text-[13px] font-semibold text-white">
                  <span className="flex flex-col items-center gap-2">
                    <Spinner /> {uploading}%
                  </span>
                </div>
              )}
              <button type="button" onClick={() => (setMedia(null), setPreview(null))} aria-label="Olib tashlash" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white">
                <X size={15} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/70 hover:text-white">
              <ImagePlus size={30} />
              <span className="px-3 text-center text-[12.5px]">Rasm yoki video tanlang</span>
            </button>
          )
        ) : (
          <div className="grid h-full place-items-center p-4" style={{ background: STORY_BACKGROUNDS[bg] }}>
            <p className="text-balance break-words text-center font-display text-[17px] font-extrabold leading-tight text-white">{caption || "Matningiz"}</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />

      {mode === "text" && (
        <div className="mb-3 flex justify-center gap-2" role="radiogroup" aria-label="Fon">
          {Object.entries(STORY_BACKGROUNDS).map(([k, v]) => (
            <button key={k} type="button" role="radio" aria-checked={bg === k} aria-label={k} onClick={() => setBg(k)} className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition", bg === k && "ring-2 ring-fg")} style={{ background: v }} />
          ))}
        </div>
      )}

      <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, STORY_CAPTION_MAX))} rows={2} placeholder={mode === "text" ? "Nima demoqchisiz?" : "Izoh (ixtiyoriy)"} aria-label="Matn" className="field mb-3 w-full resize-none text-[14px]" />
      <MusicPicker value={music} onChange={setMusic} />
    </Sheet>
  );
}
