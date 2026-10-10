"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, Camera, CheckCircle2, ImageIcon, Images, Link2, Plus, Play, Trash2, X, type LucideIcon } from "lucide-react";
import { Button, ButtonLink, EmptyState, Spinner } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { hashHue, youtubeId } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Turlar                                                              */
/* ------------------------------------------------------------------ */
export type PortfolioType = "image" | "video" | "link";

export interface PortfolioItemDTO {
  id: string;
  title: string;
  type: PortfolioType;
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  /** ms timestamp */
  createdAt: number;
}

const TYPE_META: Record<PortfolioType, { label: string; icon: LucideIcon; hint: string; placeholder: string }> = {
  image: { label: "Rasm", icon: ImageIcon, hint: "Rasmni yuklang yoki tayyor havolani qo'ying.", placeholder: "https://…/rasm.jpg" },
  video: { label: "Video", icon: Play, hint: "YouTube havolasi — muqova avtomatik olinadi.", placeholder: "https://youtube.com/watch?v=…" },
  link: { label: "Havola", icon: Link2, hint: "Behance, Dribbble, Instagram yoki sayt havolasi.", placeholder: "https://behance.net/…" },
};

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

function thumbFor(item: { type: PortfolioType; url: string; thumbnailUrl: string | null }) {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.type === "image") return item.url;
  if (item.type === "video") {
    const id = youtubeId(item.url);
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toAbsolute(url: string) {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Boshqaruvchi                                                        */
/* ------------------------------------------------------------------ */
export function PortfolioManager({ items, max = 30, publicHref }: { items: PortfolioItemDTO[]; max?: number; publicHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(items.length === 0);
  const [removed, setRemoved] = useState<string[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const visible = items.filter((i) => !removed.includes(i.id));
  const full = visible.length >= max;

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  const remove = async (id: string) => {
    if (deletingId) return;
    setConfirmId(null);
    setError(null);
    setDeletingId(id);
    setRemoved((r) => [...r, id]);
    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (!json.ok) {
        setRemoved((r) => r.filter((x) => x !== id));
        setError(json.error);
        return;
      }
      setSuccess("Ish o'chirildi");
      router.refresh();
    } catch {
      setRemoved((r) => r.filter((x) => x !== id));
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Yuqori panel */}
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="glass-tint flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
            <Images size={18} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-fg">
              {visible.length} / {max} ta ish
            </p>
            <p className="text-[12px] text-fg-3">{full ? "Limit to'ldi — yangi ish qo'shish uchun eskisini o'chiring." : "Rasm, YouTube video yoki tashqi havola."}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={publicHref} variant="glass" size="sm">
            Ommaviy ko'rinish <ArrowUpRight size={14} />
          </ButtonLink>
          <Button size="sm" onClick={() => setOpen((v) => !v)} disabled={full && !open}>
            {open ? (
              <>
                <X size={14} /> Yopish
              </>
            ) : (
              <>
                <Plus size={14} /> Ish qo'shish
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Limit shkalasi */}
      <div className="px-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-fg/8">
          <div className="h-full rounded-full bg-gradient-to-r from-tint to-tint-2 transition-all duration-700" style={{ width: `${Math.min(100, (visible.length / max) * 100)}%` }} />
        </div>
      </div>

      {(error || success) && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {error && (
            <span role="alert" className="inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
              <AlertCircle size={15} /> {error}
            </span>
          )}
          {success && (
            <span className="inline-flex items-center gap-2 rounded-full bg-ios-green/14 px-3.5 py-2 text-[13px] font-semibold text-[#1f9d46] dark:text-ios-green">
              <CheckCircle2 size={15} /> {success}
            </span>
          )}
        </div>
      )}

      {/* Qo'shish formasi */}
      {open && !full && (
        <AddForm
          onAdded={() => {
            setSuccess("Ish qo'shildi");
            setError(null);
            router.refresh();
          }}
          onClose={visible.length > 0 ? () => setOpen(false) : undefined}
        />
      )}

      {/* Mavjud ishlar */}
      {visible.length === 0 ? (
        !open && (
          <EmptyState
            icon={Images}
            title="Portfolio hali bo'sh"
            description="Birinchi ishingizni qo'shing — mijozlar portfolioga qarab tanlaydi."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus size={14} /> Ish qo'shish
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {visible.map((item) => {
            const Icon = TYPE_META[item.type].icon;
            const src = thumbFor(item);
            const hue = hashHue(item.id);
            const fallback = (
              <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 72%), hsl(${(hue + 50) % 360} 70% 56%))` }} aria-hidden>
                <Icon size={28} className="text-white/85 drop-shadow" />
              </div>
            );
            const confirming = confirmId === item.id;
            return (
              <li key={item.id} className="glass group relative overflow-hidden !rounded-[20px]" aria-busy={deletingId === item.id}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-[inherit]">
                  {src ? <SafeImage src={src} alt={item.title} loading="lazy" fallback={fallback} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : fallback}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                  <span className="glass-strong glass-pill absolute left-2.5 top-2.5 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-fg">
                    <Icon size={11} className="text-tint" /> {TYPE_META[item.type].label}
                  </span>

                  <button
                    type="button"
                    onClick={() => setConfirmId(item.id)}
                    aria-label={`${item.title} — o'chirish`}
                    className="glass-strong glass-pill absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center text-ios-red transition hover:scale-105 active:scale-95"
                  >
                    <Trash2 size={14} />
                  </button>

                  {confirming && (
                    <div className="glass-strong absolute inset-0 flex flex-col items-center justify-center gap-2 !rounded-none p-3 text-center animate-fade-up" style={{ animationDuration: "0.2s" }}>
                      <p className="text-[13px] font-semibold text-fg">O'chirilsinmi?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" onClick={() => remove(item.id)}>
                          Ha, o'chirish
                        </Button>
                        <Button size="sm" variant="glass" onClick={() => setConfirmId(null)}>
                          Yo'q
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-[13px] font-semibold text-fg" title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-fg-3">{item.description || hostOf(item.url)}</p>
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-tint transition hover:opacity-80">
                    Ochish <ArrowUpRight size={11} />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ish qo'shish formasi                                                */
/* ------------------------------------------------------------------ */
function AddForm({ onAdded, onClose }: { onAdded: () => void; onClose?: () => void }) {
  const [type, setType] = useState<PortfolioType>("image");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = TYPE_META[type];
  const preview = thumbFor({ type, url: url.trim(), thumbnailUrl: thumbnailUrl.trim() || null });
  const hue = hashHue(title || url || "x");

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as ApiResponse<{ url: string }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setUrl(toAbsolute(json.data.url));
      if (!title.trim()) setTitle(file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 100));
    } catch {
      setError("Rasmni yuklab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          url: url.trim(),
          thumbnailUrl: type === "image" ? "" : thumbnailUrl.trim(),
          description: description.trim(),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) setErrors(json.fields);
        return;
      }
      setTitle("");
      setUrl("");
      setThumbnailUrl("");
      setDescription("");
      onAdded();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-strong p-5 animate-fade-up sm:p-6" style={{ animationDuration: "0.35s" }} noValidate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-fg">Yangi ish</h2>
          <p className="text-[12px] text-fg-3">{meta.hint}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Yopish" className="glass glass-pill flex h-9 w-9 shrink-0 items-center justify-center text-fg-2 transition hover:text-fg active:scale-95">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          {/* Tur */}
          <div>
            <span className="field-label">Tur</span>
            <div className="segment" role="radiogroup" aria-label="Ish turi">
              {(Object.keys(TYPE_META) as PortfolioType[]).map((t) => {
                const I = TYPE_META[t].icon;
                return (
                  <button key={t} type="button" role="radio" aria-checked={type === t} className="segment-item inline-flex items-center gap-1.5" data-active={type === t} onClick={() => setType(t)}>
                    <I size={13} className={type === t ? "text-tint" : "text-fg-3"} /> {TYPE_META[t].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sarlavha */}
          <div>
            <label htmlFor="pm-title" className="field-label">
              Sarlavha
            </label>
            <input id="pm-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Masalan: To'y filmi — Samarqand" aria-invalid={Boolean(errors.title)} />
            {errors.title && <p className="field-error">{errors.title}</p>}
          </div>

          {/* Havola */}
          <div>
            <label htmlFor="pm-url" className="field-label">
              {type === "image" ? "Rasm" : type === "video" ? "Video havolasi" : "Havola"}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Link2 size={15} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-fg-4" />
                <input id="pm-url" className="field pl-10" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder={meta.placeholder} aria-invalid={Boolean(errors.url)} />
              </div>
              {type === "image" && (
                <>
                  <Button type="button" variant="glass" size="md" onClick={() => fileRef.current?.click()} disabled={uploading} className="shrink-0">
                    {uploading ? <Spinner /> : <Camera size={15} />} Yuklash
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                    }}
                  />
                </>
              )}
            </div>
            {errors.url ? <p className="field-error">{errors.url}</p> : type === "image" && <p className="mt-1 text-[12px] text-fg-4">JPG, PNG, WEBP · 5 MB gacha.</p>}
          </div>

          {/* Muqova (video/havola uchun) */}
          {type !== "image" && (
            <div>
              <label htmlFor="pm-thumb" className="field-label">
                Muqova rasmi <span className="font-normal text-fg-4">(ixtiyoriy)</span>
              </label>
              <input id="pm-thumb" className="field" type="url" inputMode="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} maxLength={300} placeholder="https://…/muqova.jpg" aria-invalid={Boolean(errors.thumbnailUrl)} />
              {errors.thumbnailUrl ? <p className="field-error">{errors.thumbnailUrl}</p> : type === "video" && <p className="mt-1 text-[12px] text-fg-4">YouTube uchun bo'sh qoldiring — avtomatik olinadi.</p>}
            </div>
          )}

          {/* Tavsif */}
          <div>
            <label htmlFor="pm-desc" className="field-label">
              Tavsif <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </label>
            <textarea id="pm-desc" className="field min-h-[88px] resize-y" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} maxLength={500} placeholder="Loyiha haqida qisqacha: mijoz, vazifa, natija" aria-invalid={Boolean(errors.description)} />
            <div className="mt-1 flex items-start justify-between gap-3">
              {errors.description ? <p className="field-error !mt-0">{errors.description}</p> : <span />}
              <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{description.length}/500</span>
            </div>
          </div>
        </div>

        {/* Ko'rinish */}
        <div>
          <span className="field-label">Ko'rinish</span>
          <div className="glass-weak relative aspect-[4/3] overflow-hidden !rounded-[18px]">
            {preview ? (
              <SafeImage
                key={preview}
                src={preview}
                alt="Ko'rinish"
                className="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 72%), hsl(${(hue + 50) % 360} 70% 56%))` }}>
                    <meta.icon size={28} className="text-white/85" />
                  </div>
                }
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[12px] text-fg-3">
                <meta.icon size={22} className="text-fg-4" />
                {type === "link" ? "Havola kartasi" : "Rasm ko'rinadi"}
              </div>
            )}
            {title && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-2.5">
                <p className="line-clamp-2 text-[12px] font-semibold text-white drop-shadow">{title}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-hairline pt-4">
        <Button type="submit" disabled={busy || uploading} className="min-w-[160px]">
          {busy ? (
            <Spinner />
          ) : (
            <>
              <Plus size={15} /> Qo'shish
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
