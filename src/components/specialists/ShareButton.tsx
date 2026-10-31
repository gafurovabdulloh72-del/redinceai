"use client";

import { telegramShareHref } from "@/lib/telegram-share";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, Download, Link2, QrCode, Send, Share2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { tr } from "@/lib/i18n";
import { POST_OYNA, PROFIL, PROFIL_X } from "@/lib/i18n/dict/profile";
import { qrEncode } from "@/lib/profile/qr";
import { cn } from "@/lib/utils";

/** QR matritsasi — React SVG (dangerouslySetInnerHTML'siz), currentColor bilan tema rangida */
function QrSvg({ text, label, className }: { text: string; label: string; className?: string }) {
  const d = useMemo(() => {
    const q = qrEncode(text);
    if (!q) return null;
    let path = "";
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) path += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { path, n: q.size + 4 };
  }, [text]);
  if (!d) return null;
  return (
    <svg viewBox={`0 0 ${d.n} ${d.n}`} className={className} shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect width={d.n} height={d.n} fill="#ffffff" />
      <path d={d.path} fill="#111111" />
    </svg>
  );
}

/**
 * Ulashish varaqi: havolani nusxalash, Telegram, QR kod (sof SVG, kutubxonasiz) va tizim ulashuvi (bo'lsa).
 * Oyna `pop-in`/`pop-out` bilan kiradi/chiqadi (usePresence), fokus ichida qoladi, Esc/fon yopadi.
 * `url` berilmasa — joriy sahifa; `qrDownloadHref` — SVG'ni yuklab olish havolasi (/u/<kod>/qr).
 */
export function ShareButton({
  title,
  url,
  qrDownloadHref,
  className,
  size = "md",
  variant = "outline",
  iconOnly = false,
}: {
  title?: string;
  /** Berilmasa — window.location.href */
  url?: string;
  qrDownloadHref?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "ghost" | "tint-soft" | "outline";
  /** Faqat ikonka (CTA yonidagi kvadrat tugma) */
  iconOnly?: boolean;
}) {
  const til = useLocale();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canSystem, setCanSystem] = useState(false);
  const [href, setHref] = useState(url ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const { mounted, closing } = usePresence(open, 180);

  useEffect(() => {
    setCanSystem(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  useEffect(() => {
    if (open) setHref(url ?? window.location.href);
  }, [open, url]);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const close = useCallback(() => {
    setOpen(false);
    setQr(false);
  }, []);
  useFocusTrap(dialogRef, mounted && !closing);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      /* clipboard yo'q — matn ko'rinib turadi */
    }
  };
  const system = async () => {
    try {
      await navigator.share({ title: title ?? document.title, url: href });
      close();
    } catch (e) {
      // Bekor qilingan (AbortError) — nusxalash qilinmaydi, oyna ochiq qoladi
      if (e instanceof Error && e.name === "AbortError") return;
    }
  };
  const tgHref = telegramShareHref(href, title ?? "");
  const sizeCls = size === "lg" ? "h-13 w-13" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const row = "press flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] px-3 text-left text-[14px] font-medium text-fg transition hover:bg-fg/6";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={iconOnly ? tr(til, PROFIL.share) : undefined}
        title={iconOnly ? tr(til, PROFIL.share) : undefined}
        className={cn(iconOnly ? cn("shrink-0 !p-0", sizeCls) : "min-w-[128px]", className)}
      >
        <Share2 size={16} /> {!iconOnly && tr(til, PROFIL.share)}
      </Button>

      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={cn("fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center", closing ? "overlay-out" : "overlay-in")} role="presentation" onClick={close}>
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={tr(til, PROFIL_X.shareTitle)}
              onClick={(e) => e.stopPropagation()}
              className={cn("card-floating w-full max-w-sm p-3", closing ? "pop-out" : "pop-in")}
            >
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                {qr ? (
                  <button type="button" onClick={() => setQr(false)} className="press inline-flex h-9 items-center gap-1 rounded-full pl-1.5 pr-3 text-[14px] font-semibold text-fg transition hover:bg-fg/6">
                    <ChevronLeft size={16} aria-hidden /> {tr(til, PROFIL_X.back)}
                  </button>
                ) : (
                  <p className="px-1.5 text-[15px] font-semibold text-fg">{tr(til, PROFIL_X.shareTitle)}</p>
                )}
                <button type="button" onClick={close} aria-label={tr(til, POST_OYNA.close)} className="press flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                  <X size={16} />
                </button>
              </div>

              {qr ? (
                <div className="expand-in flex flex-col items-center px-2 pb-2 pt-1 text-center">
                  <div className="overflow-hidden rounded-[var(--r-md)] border border-line bg-white p-2">
                    <QrSvg text={href} label={PROFIL_X.shareQrAlt[til](href)} className="h-[200px] w-[200px]" />
                  </div>
                  <p className="mt-3 break-all font-mono text-[12px] text-fg-2">{href.replace(/^https?:\/\//, "")}</p>
                  <p className="mt-1 text-[12px] text-fg-3">{tr(til, PROFIL_X.shareQrHint)}</p>
                  {qrDownloadHref && (
                    <a href={qrDownloadHref} download className="press mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold text-fg transition hover:border-fg">
                      <Download size={14} aria-hidden /> {tr(til, PROFIL_X.shareQrDownload)}
                    </a>
                  )}
                </div>
              ) : (
                <ul className="pt-1">
                  <li>
                    <button type="button" onClick={copy} className={row} aria-live="polite">
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-surface-3", copied ? "text-success" : "text-fg-2")}>{copied ? <Check size={16} /> : <Link2 size={16} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block">{copied ? tr(til, PROFIL_X.shareCopied) : tr(til, PROFIL_X.shareCopy)}</span>
                        <span className="block truncate text-[12px] font-normal text-fg-3">{href.replace(/^https?:\/\//, "")}</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <a href={tgHref} target="_blank" rel="noopener noreferrer" className={row}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-fg-2">
                        <Send size={16} />
                      </span>
                      {tr(til, PROFIL_X.shareTelegram)}
                    </a>
                  </li>
                  <li>
                    <button type="button" onClick={() => setQr(true)} className={row}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-fg-2">
                        <QrCode size={16} />
                      </span>
                      {tr(til, PROFIL_X.shareQr)}
                    </button>
                  </li>
                  {canSystem && (
                    <li>
                      <button type="button" onClick={system} className={row}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-fg-2">
                          <Share2 size={16} />
                        </span>
                        {tr(til, PROFIL_X.shareSystem)}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
