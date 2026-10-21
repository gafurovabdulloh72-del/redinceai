"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Bell, BellOff, FileText, Image as ImageIcon, Mic, Pin, PinOff, Search, Video, X, type LucideIcon } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { SafeImage } from "@/components/specialists/SafeImage";
import type { Locale } from "@/lib/i18n";
import { clock, dateLabel } from "@/lib/chat/time";
import { cn } from "@/lib/utils";
import { attachmentExt, formatBytes, formatDuration, type Attachment } from "./attachments";
import { AudioBubble } from "./MessageParts";

/**
 * DM yordamchi panellari: Layer (desktopda popover/dialog, telefonda pastki varaq — kirish/chiqish animatsiyasi bilan),
 * menyu elementlari, suhbat sozlamalari menyusi, yo'naltirish dialogi, ma'lumot/media dialogi.
 */

/* ------------------------------------------------------------------ */
/* Layer                                                               */
/* ------------------------------------------------------------------ */
export function useDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setD(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return d;
}

/**
 * `menu` — desktopda ota-element (`relative`) ichida popover (`anchorClass` bilan joylashadi), telefonda pastki varaq.
 * `dialog` — desktopda markazdagi oyna, telefonda pastki varaq. Esc / fon bosilsa yopiladi.
 */
export function Layer({ open, onClose, children, label, variant = "menu", anchorClass = "right-0 top-full mt-1", width }: { open: boolean; onClose: () => void; children: ReactNode; label: string; variant?: "menu" | "dialog"; anchorClass?: string; width?: string }) {
  const { mounted, closing } = usePresence(open, 200);
  const desktop = useDesktop();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!mounted) return null;
  const role = variant === "menu" ? "menu" : "dialog";
  if (desktop && variant === "menu") {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
        <div role={role} aria-label={label} className={cn(closing ? "pop-out" : "pop-in", "card-floating absolute z-50 p-1 !rounded-[14px]", width ?? "w-[240px]", anchorClass)}>
          {children}
        </div>
      </>
    );
  }
  if (desktop) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={cn(closing ? "overlay-out" : "overlay-in", "absolute inset-0 bg-black/35")} onClick={onClose} aria-hidden="true" />
        <div role="dialog" aria-modal="true" aria-label={label} className={cn(closing ? "pop-out" : "pop-in", "card-floating relative flex max-h-[80dvh] w-full flex-col overflow-hidden !rounded-[20px]", width ?? "max-w-[440px]")}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className={cn(closing ? "overlay-out" : "overlay-in", "absolute inset-0 bg-black/40")} onClick={onClose} aria-hidden="true" />
      <div role={role} aria-modal={variant === "dialog" || undefined} aria-label={label} className={cn(closing ? "sheet-out" : "sheet-in", "relative flex max-h-[82dvh] flex-col overflow-hidden rounded-t-[20px] bg-surface pb-[max(env(safe-area-inset-bottom),10px)]")}>
        <span className="sheet-handle mx-auto mb-1 mt-2 block shrink-0 rounded-full bg-fg/15" aria-hidden="true" />
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">{children}</div>
      </div>
    </div>
  );
}

/** Menyu elementi */
export function MenuItem({ icon: Icon, label, onClick, danger, hint, active, disabled }: { icon?: LucideIcon; label: string; onClick: () => void; danger?: boolean; hint?: string; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13.5px] font-medium transition hover:bg-fg/6 focus-visible:bg-fg/6 focus-visible:outline-none disabled:opacity-40 lg:min-h-10",
        danger ? "text-danger-text" : "text-fg",
      )}
    >
      {Icon && <Icon size={15} className={cn("shrink-0", danger ? "text-danger-text" : "text-fg-3")} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[11px] text-fg-4">{hint}</span>}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}

/** Dialog sarlavhasi (yopish tugmasi bilan) */
export function DialogHead({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
      <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-fg">{title}</h2>
      {children}
      <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg">
        <X size={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Suhbat sozlamalari menyusi (ro'yxat qatori va sarlavha)             */
/* ------------------------------------------------------------------ */
export interface ConvPrefsView {
  archived: boolean;
  muted: boolean;
  pinned: boolean;
}
const PREF_T = {
  archive: { uz: "Arxivlash", ru: "В архив" },
  unarchive: { uz: "Arxivdan chiqarish", ru: "Из архива" },
  mute: { uz: "Ovozsiz", ru: "Без звука" },
  unmute: { uz: "Bildirishnomalarni yoqish", ru: "Включить уведомления" },
  pin: { uz: "Ro'yxatda qadash", ru: "Закрепить в списке" },
  unpin: { uz: "Ro'yxatdan yechish", ru: "Открепить" },
} as const;

/** Arxiv / ovozsiz / qadash — menyu elementlari (ro'yxat va sarlavha menyusida umumiy) */
export function PrefItems({ prefs, locale, onChange }: { prefs: ConvPrefsView; locale: Locale; onChange: (patch: Partial<ConvPrefsView>) => void }) {
  return (
    <>
      <MenuItem icon={prefs.pinned ? PinOff : Pin} label={PREF_T[prefs.pinned ? "unpin" : "pin"][locale]} onClick={() => onChange({ pinned: !prefs.pinned })} />
      <MenuItem icon={prefs.muted ? Bell : BellOff} label={PREF_T[prefs.muted ? "unmute" : "mute"][locale]} onClick={() => onChange({ muted: !prefs.muted })} />
      <MenuItem icon={prefs.archived ? ArchiveRestore : Archive} label={PREF_T[prefs.archived ? "unarchive" : "archive"][locale]} onClick={() => onChange({ archived: !prefs.archived })} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Yo'naltirish dialogi                                                 */
/* ------------------------------------------------------------------ */
export interface ConvPick {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

const FWD_T = {
  title: { uz: "Yo'naltirish", ru: "Переслать" },
  search: { uz: "Suhbatni qidirish", ru: "Поиск чата" },
  empty: { uz: "Boshqa suhbat yo'q", ru: "Других чатов нет" },
} as const;

export function ForwardDialog({ open, onClose, items, locale, onPick, busy }: { open: boolean; onClose: () => void; items: ConvPick[]; locale: Locale; onPick: (id: string) => void; busy?: boolean }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQ("");
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);
  const list = items.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || (c.username ?? "").includes(q.trim().toLowerCase()));
  return (
    <Layer open={open} onClose={onClose} label={FWD_T.title[locale]} variant="dialog">
      <DialogHead title={FWD_T.title[locale]} onClose={onClose} />
      <div className="p-2">
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={FWD_T.search[locale]} aria-label={FWD_T.search[locale]} className="field h-9 w-full rounded-full pl-8 text-[13px]" />
        </label>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-1" aria-busy={busy}>
        {list.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-fg-3">{FWD_T.empty[locale]}</li>}
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" disabled={busy} onClick={() => onPick(c.id)} className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-fg/6 focus-visible:bg-fg/6 focus-visible:outline-none disabled:opacity-50">
              <PeerAvatar name={c.name} avatarUrl={c.avatarUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-fg">{c.name}</span>
                {c.username && <span className="block truncate text-[12px] text-fg-4">@{c.username}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Layer>
  );
}

export function PeerAvatar({ name, avatarUrl, size = 44 }: { name: string; avatarUrl: string | null; size?: number }) {
  return avatarUrl ? (
    <SafeImage src={avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-ink font-display font-semibold text-ink-fg" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Ma'lumot + media dialogi                                             */
/* ------------------------------------------------------------------ */
type MediaKind = "image" | "video" | "file" | "voice";
interface MediaItem extends Attachment {
  messageId: string;
  at: number;
  mine: boolean;
}
const KIND_T: Record<MediaKind, { uz: string; ru: string; icon: LucideIcon }> = {
  image: { uz: "Rasmlar", ru: "Фото", icon: ImageIcon },
  video: { uz: "Videolar", ru: "Видео", icon: Video },
  file: { uz: "Fayllar", ru: "Файлы", icon: FileText },
  voice: { uz: "Ovozlar", ru: "Голосовые", icon: Mic },
};
const INFO_T = {
  title: { uz: "Ma'lumot", ru: "Информация" },
  profile: { uz: "Profilni ochish", ru: "Открыть профиль" },
  media: { uz: "Media", ru: "Медиа" },
  empty: { uz: "Hali yo'q", ru: "Пока нет" },
  more: { uz: "Yana", ru: "Ещё" },
  loading: { uz: "Yuklanmoqda…", ru: "Загрузка…" },
} as const;

export function InfoDialog({
  open,
  onClose,
  convId,
  peer,
  presence,
  prefs,
  locale,
  onPrefs,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  convId: string;
  peer: { name: string; username: string | null; avatarUrl: string | null; slug?: string | null };
  presence: string;
  prefs: ConvPrefsView;
  locale: Locale;
  onPrefs: (patch: Partial<ConvPrefsView>) => void;
  onJump: (messageId: string) => void;
}) {
  const [counts, setCounts] = useState<Record<MediaKind, number> | null>(null);
  const [kind, setKind] = useState<MediaKind>("image");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCounts(null);
    setItems(null);
    fetch(`/api/chat/${convId}/media`)
      .then((r) => r.json())
      .then((j) => j?.ok && setCounts(j.data.counts))
      .catch(() => undefined);
  }, [open, convId]);

  useEffect(() => {
    if (!open) return;
    let on = true;
    setItems(null);
    setCursor(null);
    fetch(`/api/chat/${convId}/media?kind=${kind}`)
      .then((r) => r.json())
      .then((j) => {
        if (!on || !j?.ok) return;
        setItems(j.data.items);
        setCursor(j.data.nextCursor);
      })
      .catch(() => on && setItems([]));
    return () => {
      on = false;
    };
  }, [open, convId, kind]);

  const more = async () => {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const j = await fetch(`/api/chat/${convId}/media?kind=${kind}&cursor=${cursor}`).then((r) => r.json());
      if (j?.ok) {
        setItems((cur) => [...(cur ?? []), ...j.data.items]);
        setCursor(j.data.nextCursor);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layer open={open} onClose={onClose} label={INFO_T.title[locale]} variant="dialog" width="max-w-[480px]">
      <DialogHead title={INFO_T.title[locale]} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-3">
          <PeerAvatar name={peer.name} avatarUrl={peer.avatarUrl} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-semibold text-fg">{peer.name}</p>
            <p className="truncate text-[12.5px] text-fg-3">{peer.username ? `@${peer.username}` : ""}{peer.username && presence ? " · " : ""}{presence}</p>
          </div>
          {peer.slug && (
            <Link href={`/mutaxassislar/${peer.slug}`} className="h-9 shrink-0 rounded-full border border-line px-3.5 text-[12.5px] font-semibold leading-9 text-fg transition hover:border-fg">
              {INFO_T.profile[locale]}
            </Link>
          )}
        </div>
        <div className="px-2">
          <PrefItems prefs={prefs} locale={locale} onChange={onPrefs} />
        </div>
        <div className="mt-2 border-t border-line px-3 pt-3">
          <p className="eyebrow mb-2 text-fg-4">{INFO_T.media[locale]}</p>
          <div className="segment mb-3 grid grid-cols-4" role="tablist" aria-label={INFO_T.media[locale]}>
            {(Object.keys(KIND_T) as MediaKind[]).map((k) => {
              const Icon = KIND_T[k].icon;
              return (
                <button key={k} type="button" role="tab" aria-selected={kind === k} data-active={kind === k} onClick={() => setKind(k)} className="segment-item flex h-9 items-center justify-center gap-1.5 text-[12px]">
                  <Icon size={13} aria-hidden="true" />
                  <span className="tabular-nums">{counts ? counts[k] : "·"}</span>
                </button>
              );
            })}
          </div>
          <div className="min-h-[120px] pb-3" aria-live="polite" aria-busy={items === null}>
            {items === null ? (
              <p className="py-8 text-center text-[13px] text-fg-3">{INFO_T.loading[locale]}</p>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-fg-3">{INFO_T.empty[locale]}</p>
            ) : kind === "image" ? (
              <div className="grid grid-cols-3 gap-1">
                {items.map((a) => (
                  <button key={`${a.messageId}-${a.url}`} type="button" onClick={() => onJump(a.messageId)} className="img-zoom aspect-square overflow-hidden rounded-[8px] bg-surface-2 focus-visible:outline-2 focus-visible:outline-fg" title={`${dateLabel(a.at, locale)}, ${clock(a.at)}`}>
                    <SafeImage src={a.url} alt={a.name} width={160} height={160} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {items.map((a) => (
                  <li key={`${a.messageId}-${a.url}`}>
                    {kind === "voice" ? (
                      <div className="flex items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-2.5 py-1.5">
                        <AudioBubble a={a} mine={false} />
                        <button type="button" onClick={() => onJump(a.messageId)} className="shrink-0 text-[11px] font-medium text-fg-4 hover:text-fg">
                          {dateLabel(a.at, locale)}
                        </button>
                      </div>
                    ) : kind === "video" ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={a.url} controls preload="metadata" playsInline className="max-h-56 w-full rounded-[10px] bg-black/20" title={a.name} />
                    ) : (
                      <a href={a.url} target="_blank" rel="noopener" download={a.name} className="flex items-center gap-2.5 rounded-[10px] border border-line px-2.5 py-2 text-[12.5px] font-semibold text-fg transition hover:border-fg">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-2 text-[9.5px] font-bold">{attachmentExt(a)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{a.name}</span>
                          <span className="block text-[11px] font-normal text-fg-4">{[formatBytes(a.size), a.duration ? formatDuration(a.duration) : "", dateLabel(a.at, locale)].filter(Boolean).join(" · ")}</span>
                        </span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {cursor && (
              <button type="button" onClick={() => void more()} disabled={busy} className="mt-2 h-9 w-full rounded-full border border-line text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
                {INFO_T.more[locale]}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layer>
  );
}
