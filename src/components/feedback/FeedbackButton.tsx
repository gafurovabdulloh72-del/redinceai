"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, ChevronRight, ImagePlus, Lightbulb, MessageSquareHeart, MessageSquareText, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * FIKR BILDIRISH (2026-11-04): yon menyu «Yana» va kabinet menyusidagi tugma → Sheet forma (tur chiplari, matn,
 * kirgan foydalanuvchiga ixtiyoriy skrinshot `/api/upload`) → `POST /api/fikr`. Mehmon ham yubora oladi.
 * `variant`: "menu" — Sidebar MoreItem uslubi; "row" — telefon kabinet menyusi `m-row` qatori.
 */
const FIKR = {
  title: { uz: "Fikr bildirish", ru: "Оставить отзыв" } satisfies Tr,
  lead: { uz: "Xato topdingizmi yoki g'oyangiz bormi? Bir necha so'z yetarli — har bir fikrni o'qiymiz.", ru: "Нашли ошибку или есть идея? Пары слов достаточно — мы читаем каждый отзыв." } satisfies Tr,
  bug: { uz: "Xato", ru: "Ошибка" } satisfies Tr,
  idea: { uz: "G'oya", ru: "Идея" } satisfies Tr,
  other: { uz: "Boshqa", ru: "Другое" } satisfies Tr,
  placeholder: { uz: "Nima bo'ldi yoki nimani yaxshilash kerak?", ru: "Что произошло или что стоит улучшить?" } satisfies Tr,
  screenshot: { uz: "Skrinshot qo'shish", ru: "Добавить скриншот" } satisfies Tr,
  remove: { uz: "Olib tashlash", ru: "Убрать" } satisfies Tr,
  send: { uz: "Yuborish", ru: "Отправить" } satisfies Tr,
  sent: { uz: "Rahmat! Fikringiz yuborildi", ru: "Спасибо! Отзыв отправлен" } satisfies Tr,
  failed: { uz: "Yuborilmadi — qayta urinib ko'ring", ru: "Не отправлено — попробуйте ещё раз" } satisfies Tr,
  uploadFailed: { uz: "Rasm yuklanmadi", ru: "Изображение не загрузилось" } satisfies Tr,
  page: { uz: "Sahifa", ru: "Страница" } satisfies Tr,
  cancel: { uz: "Bekor", ru: "Отмена" } satisfies Tr,
};

type Kind = "bug" | "idea" | "other";
const KINDS: Array<{ key: Kind; icon: typeof Bug; label: Tr }> = [
  { key: "bug", icon: Bug, label: FIKR.bug },
  { key: "idea", icon: Lightbulb, label: FIKR.idea },
  { key: "other", icon: MessageSquareText, label: FIKR.other },
];

/** Tugma → `open-feedback` hodisasi; varaqni `FeedbackHost` (Sidebar ildizida, bitta) chizadi — «Yana» popover'i yopilsa ham varaq qolsin */
export const FEEDBACK_EVENT = "open-feedback";

export function FeedbackButton({ variant = "menu", className }: { variant?: "menu" | "row"; className?: string }) {
  const til = useLocale();
  const fire = () => window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT));
  return variant === "row" ? (
    <button type="button" onClick={fire} className={cn("press m-row w-full text-left transition active:bg-fg/6", className)}>
      <MessageSquareHeart size={21} strokeWidth={1.7} className="shrink-0 text-fg-3" />
      <span className="min-w-0 flex-1 truncate text-[16px] text-fg">{tr(til, FIKR.title)}</span>
      <ChevronRight size={18} className="shrink-0 text-fg-4" aria-hidden="true" />
    </button>
  ) : (
    <button type="button" role="menuitem" onClick={fire} className={cn("flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] text-fg transition hover:bg-fg/6", className)}>
      <MessageSquareHeart size={16} className="text-fg-3" /> {tr(til, FIKR.title)}
    </button>
  );
}

/** Varaq egasi — sahifada BITTA (Sidebar ildizi). `loggedIn` — skrinshot yuklash imkoni (upload sessiya talab qiladi) */
export function FeedbackHost({ loggedIn = false }: { loggedIn?: boolean }) {
  const til = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(FEEDBACK_EVENT, on);
    return () => window.removeEventListener(FEEDBACK_EVENT, on);
  }, []);
  const [kind, setKind] = useState<Kind>("idea");
  const [text, setText] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setShot(null);
    setError(null);
    setKind("idea");
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok: boolean; data?: { url: string }; error?: string };
      if (!json.ok || !json.data) {
        setError(json.error ?? tr(til, FIKR.uploadFailed));
        return;
      }
      setShot(json.data.url);
    } catch {
      setError(tr(til, FIKR.uploadFailed));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (busy || text.trim().length < 5) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fikr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text: text.trim(), page: pathname ?? "", screenshotUrl: shot }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? tr(til, FIKR.failed));
        return;
      }
      showToast(tr(til, FIKR.sent), "success");
      setOpen(false);
      reset();
    } catch {
      setError(tr(til, FIKR.failed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={tr(til, FIKR.title)}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tr(til, FIKR.cancel)}
            </Button>
            <Button type="button" variant="accent" onClick={() => void submit()} disabled={busy || uploading || text.trim().length < 5}>
              {busy ? <Spinner /> : null} {tr(til, FIKR.send)}
            </Button>
          </div>
        }
      >
        <div className="space-y-3" data-no-auto>
          <p className="text-[13px] leading-snug text-fg-2">{tr(til, FIKR.lead)}</p>
          {/* Tur chiplari */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr(til, FIKR.title)}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              return (
                <button key={k.key} type="button" role="radio" aria-checked={on} onClick={() => setKind(k.key)} data-active={on ? "true" : undefined} className="chip inline-flex items-center gap-1.5 text-[13px]">
                  <k.icon size={14} aria-hidden="true" /> {tr(til, k.label)}
                </button>
              );
            })}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={5} maxLength={2000} placeholder={tr(til, FIKR.placeholder)} aria-label={tr(til, FIKR.placeholder)} className="field w-full resize-y text-[14px]" />
          <div className="flex items-center justify-between gap-2 text-[12px] text-fg-4">
            <span className="truncate">
              {tr(til, FIKR.page)}: <code className="text-fg-3">{pathname}</code>
            </span>
            <span className="tabular-nums">{text.length}/2000</span>
          </div>
          {loggedIn &&
            (shot ? (
              <div className="flex items-center gap-3 rounded-tile border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot} alt="" className="h-14 w-20 rounded-md object-cover" />
                <button type="button" onClick={() => setShot(null)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
                  <X size={14} /> {tr(til, FIKR.remove)}
                </button>
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-2 transition hover:text-fg disabled:opacity-60">
                  {uploading ? <Spinner /> : <ImagePlus size={15} />} {tr(til, FIKR.screenshot)}
                </button>
              </>
            ))}
          {error && (
            <p role="alert" className="text-[12.5px] text-danger-text">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
