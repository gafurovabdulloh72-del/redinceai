"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X, ZoomIn } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
/** Yopilish animatsiyasi davomiyligi (ms) — `animate-modal-out` bilan mos */
const EXIT_MS = 160;

/**
 * Rasm kesish oynasi (avatar/muqova yuklashdan oldin): rasmni barmoq/sichqoncha bilan surish,
 * slayder, sichqoncha g'ildiragi yoki ikki barmoq (pinch) bilan kattalashtirish. Natija canvas orqali JPEG (sifat 0.9)
 * qilib kesiladi va onDone'ga File bo'lib qaytadi — yuklash oqimi o'zgarmaydi. Tashqi kutubxona ishlatilmaydi.
 * Fokus: ochilganda oynaga kiradi, yopilganda oldingi elementga qaytadi; yopilish animatsiya bilan.
 */
export function ImageCropper({
  file,
  aspect,
  outWidth,
  title,
  onDone,
  onCancel,
}: {
  file: File;
  /** Kesish oynasi nisbati (eni / bo'yi): avatar 1, muqova 8/3 */
  aspect: number;
  /** Natija kengligi (px); balandlik aspectdan hisoblanadi */
  outWidth: number;
  title: string;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  /** Faol pointerlar (pinch uchun ikkitasi) */
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  // Faylni o'qish va asl o'lchamini aniqlash
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Oyna kengligini kuzatish (responsiv)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  // Fokus: ochilganda oynaga, yopilganda — oldin fokusda bo'lgan elementga
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      prev?.focus?.();
    };
  }, []);

  /** Yopish: animatsiya bilan (reduced-motion'da darhol); saqlash jarayonida yopilmaydi */
  const requestClose = useCallback(() => {
    if (busy || closing) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onCancel();
      return;
    }
    setClosing(true);
    window.setTimeout(onCancel, EXIT_MS);
  }, [busy, closing, onCancel]);

  // Esc — bekor qilish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // Geometriya: s0 — oynani to'liq qoplaydigan minimal masshtab (object-cover), s — zoom bilan
  const boxH = boxW / aspect;
  const s0 = nat && boxW ? Math.max(boxW / nat.w, boxH / nat.h) : 0;
  const s = s0 * zoom;
  const dw = nat ? nat.w * s : 0;
  const dh = nat ? nat.h * s : 0;
  const clamp = (v: number, m: number) => Math.min(m, Math.max(-m, v));
  const ox = clamp(off.x, Math.max(0, (dw - boxW) / 2));
  const oy = clamp(off.y, Math.max(0, (dh - boxH) / 2));
  const left = (boxW - dw) / 2 + ox;
  const top = (boxH - dh) / 2 + oy;

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!nat) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Pinch boshlandi — surishni to'xtatamiz
      drag.current = null;
      pinch.current = { dist: dist(), zoom };
    } else {
      drag.current = { x: e.clientX, y: e.clientY, ox, oy };
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const d = dist();
      if (pinch.current.dist > 0) setZoom(clampZoom((pinch.current.zoom * d) / pinch.current.dist));
      return;
    }
    if (!drag.current) return;
    setOff({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
    setOff({ x: ox, y: oy });
  };
  // Sichqoncha g'ildiragi / trackpad: kattalashtirish (sahifa skrolli bloklanadi)
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!nat) return;
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.0025));
  };

  const save = () => {
    const img = imgRef.current;
    if (!img || !nat || !boxW || busy) return;
    setBusy(true);
    const outH = Math.round(outWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    // JPEG shaffoflikni qo'llamaydi — PNG fonlari qora bo'lib qolmasin
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -left / s, -top / s, boxW / s, boxH / s, 0, 0, outWidth, outH);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onDone(new File([blob], "rasm.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div className={cn("fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4", closing ? "animate-fade-out" : "animate-fade-in")} style={{ animationDuration: closing ? `${EXIT_MS}ms` : undefined }} onClick={requestClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn("card-elevated w-full max-w-xl p-4 outline-none sm:p-5", closing ? "animate-modal-out" : "animate-modal-in")}
        style={{ animationDuration: closing ? `${EXIT_MS}ms` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-[16px] font-semibold text-fg">{title}</p>
          <button type="button" onClick={requestClose} aria-label="Yopish" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <div
          ref={boxRef}
          className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-[14px] bg-ink active:cursor-grabbing"
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
        >
          {src && nat ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: dw, height: dh, left, top }} />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ZoomIn size={15} className="shrink-0 text-fg-3" aria-hidden="true" />
          <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Kattalashtirish" aria-valuetext={`${Math.round(zoom * 100)}%`} className="h-10 w-full accent-[var(--accent)]" />
          <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-fg-3" aria-hidden="true">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <p className="text-[12px] text-fg-4">Surib joylashtiring; slayder, g&apos;ildirak yoki ikki barmoq bilan kattalashtiring.</p>

        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" size="md" onClick={requestClose} disabled={busy}>
            Bekor
          </Button>
          <Button type="button" variant="accent" size="md" onClick={save} disabled={busy || !nat}>
            {busy ? <Spinner /> : <Check size={15} />} Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
