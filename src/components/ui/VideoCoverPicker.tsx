"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

/**
 * Video muqovasi: videoni slayder bilan suring → «Shu kadrni tanlash» (canvas → JPEG) yoki o'z rasmingizni yuklang.
 * `src` — lokal blob URL (yuklashdan oldin) yoki sayt/R2 manzili. Tashqi manzilda brauzer CORS bermasa kadr olib bo'lmaydi —
 * shunda faqat rasm yuklash ishlaydi (xabar ko'rsatiladi). `onPick` fayl qaytaradi — yuklashni chaqiruvchi qiladi.
 */
export function VideoCoverPicker({ open, onClose, src, onPick }: { open: boolean; onClose: () => void; src: string; onPick: (file: File) => Promise<void> | void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState(0);
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cors, setCors] = useState(true);

  useEffect(() => {
    if (open) {
      setReady(false);
      setBlocked(false);
      setT(0);
      setCors(!src.startsWith("blob:"));
    }
  }, [open, src]);

  const seek = (v: number) => {
    setT(v);
    const el = ref.current;
    if (el) el.currentTime = v;
  };

  async function pickFrame() {
    const v = ref.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    try {
      const scale = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => {
        try {
          c.toBlob(r, "image/jpeg", 0.85);
        } catch {
          r(null);
        }
      });
      if (!blob) {
        setBlocked(true);
        return;
      }
      await onPick(new File([blob], "muqova.jpg", { type: "image/jpeg" }));
      onClose();
    } catch {
      setBlocked(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Video muqovasi" size="sm">
      <div className="space-y-3">
        <div className="relative mx-auto flex max-h-[52vh] items-center justify-center overflow-hidden rounded-[14px] bg-black">
          {open && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={ref}
              key={`${src}:${cors}`}
              src={src}
              crossOrigin={cors ? "anonymous" : undefined}
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                setDur(e.currentTarget.duration || 0);
                setReady(true);
              }}
              onError={() => {
                // CORS bermasa: crossOrigin'siz ko'rsatamiz (kadr olib bo'lmaydi, lekin ko'rish mumkin)
                if (cors) setCors(false);
                else setBlocked(true);
              }}
              className="max-h-[52vh] w-full object-contain"
            />
          )}
          {!ready && !blocked && <Loader2 className="absolute animate-spin text-white/70" />}
        </div>
        {ready && !cors && <p className="text-[12px] text-fg-3">Bu videodan kadr olib bo&apos;lmaydi (brauzer ruxsat bermadi) — o&apos;z rasmingizni yuklang.</p>}
        {ready && cors && (
          <input type="range" min={0} max={Math.max(0.1, dur)} step={0.05} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Kadr" className="w-full accent-[var(--accent)]" />
        )}
        {blocked && <p className="text-[12px] text-danger-text">Kadrni olib bo&apos;lmadi — o&apos;z rasmingizni yuklang.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!ready || !cors || blocked || busy} onClick={() => void pickFrame()} className={cn("btn-accent inline-flex h-10 items-center gap-1.5 px-4 text-[13.5px] font-semibold", (!ready || !cors || blocked) && "opacity-50")}>
            {busy && <Loader2 size={14} className="animate-spin" />} Shu kadrni tanlash
          </button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 hover:text-fg">
            <ImagePlus size={15} /> Rasm yuklash
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                try {
                  await onPick(f);
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>
      </div>
    </Sheet>
  );
}
