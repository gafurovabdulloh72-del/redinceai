"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, Camera, CheckCircle2, ImageIcon, Link2, Plus, Play, Trash2, X, type LucideIcon } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { cn, hashHue, youtubeId } from "@/lib/utils";

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

/** Rasm yo'q plita: past to'yinganlikdagi, palitraga mos fon (sun'iy rang-barang gradient emas) */
function fallbackBg(seed: string) {
  const hue = hashHue(seed);
  return `linear-gradient(135deg, hsl(${hue} 20% 34%), hsl(${(hue + 40) % 360} 24% 24%))`;
}

/** Bo'sh portfolio illyustratsiyasi: uchta ramka + plyus (inline SVG, tokenlar bilan) */
function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" width={200} height={140} className={className} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="126" rx="76" ry="7" fill="var(--fg)" opacity="0.06" />
      <g transform="rotate(-8 60 70)">
        <rect x="24" y="36" width="72" height="56" rx="10" fill="var(--surface)" stroke="var(--line-2)" strokeWidth="2" />
        <path d="M34 82 L54 60 L68 74 L78 66 L88 82 Z" fill="var(--accent-soft)" />
        <circle cx="76" cy="50" r="5" fill="var(--accent)" opacity="0.7" />
      </g>
      <g transform="rotate(6 140 70)">
        <rect x="104" y="30" width="72" height="56" rx="10" fill="var(--surface)" stroke="var(--line-2)" strokeWidth="2" />
        <path d="M114 76 L134 54 L148 68 L158 60 L168 76 Z" fill="var(--accent-soft)" />
        <circle cx="156" cy="44" r="5" fill="var(--accent)" opacity="0.7" />
      </g>
      <rect x="64" y="56" width="72" height="56" rx="10" fill="var(--surface)" stroke="var(--fg)" strokeWidth="2.5" />
      <path d="M74 102 L94 80 L108 94 L118 86 L128 102 Z" fill="var(--accent)" opacity="0.85" />
      <circle cx="140" cy="60" r="16" fill="var(--accent)" />
      <path d="M140 52v16M132 60h16" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
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
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="font-display text-[16px] font-semibold text-fg">
              {visible.length} / {max} ta ish
            </p>
            <p className="text-[12px] text-fg-3">{full ? "Limit to'ldi — yangi ish qo'shish uchun eskisini o'chiring." : "Rasm, YouTube video yoki tashqi havola."}</p>
            <div className="mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-fg/8" aria-hidden="true">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.min(100, (visible.length / max) * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={publicHref} variant="outline" size="md">
            Ommaviy ko'rinish <ArrowUpRight size={14} />
          </ButtonLink>
          <Button size="md" variant={open ? "outline" : "accent"} onClick={() => setOpen((v) => !v)} disabled={full && !open}>
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

      {(error || success) && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {error && (
            <span role="alert" className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger">
              <AlertCircle size={15} /> {error}
            </span>
          )}
          {success && (
            <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-2 text-[13px] font-semibold text-success">
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

      {/* Mavjud ishlar — bir xil 4:3 nisbatli to'r */}
      {visible.length === 0 ? (
        !open && (
          <div className="card-outline flex flex-col items-center justify-center px-6 py-12 text-center">
            <EmptyIllustration className="mb-4 h-auto w-[180px]" />
            <h3 className="font-display text-[17px] font-semibold text-fg">Portfolio hali bo'sh</h3>
            <p className="mt-1.5 max-w-sm text-sm text-fg-3">Birinchi ishingizni qo'shing — mijozlar portfolioga qarab tanlaydi.</p>
            <Button size="md" className="mt-5" onClick={() => setOpen(true)}>
              <Plus size={15} /> Ish qo'shish
            </Button>
          </div>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {visible.map((item) => {
            const Icon = TYPE_META[item.type].icon;
            const src = thumbFor(item);
            const fallback = (
              <div className="flex h-full w-full items-center justify-center grain" style={{ background: fallbackBg(item.id) }} aria-hidden>
                <Icon size={28} className="text-white/80" />
              </div>
            );
            const confirming = confirmId === item.id;
            return (
              <li key={item.id} className="card group relative flex flex-col overflow-hidden" aria-busy={deletingId === item.id}>
                <div className="relative aspect-[4/3] overflow-hidden bg-surface-3">
                  {src ? <SafeImage src={src} alt={item.title} loading="lazy" fallback={fallback} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /> : fallback}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  <span className="absolute left-2.5 top-2.5 inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-[11px] font-semibold text-fg shadow-[var(--shadow-1)]">
                    <Icon size={11} className="text-fg-3" /> {TYPE_META[item.type].label}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <p className="truncate text-[14px] font-semibold text-fg" title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-fg-3">{item.description || hostOf(item.url)}</p>

                  {/* Amallar: "Ochish" 44px pill + o'chirish (inline tasdiq, window.confirm emas) */}
                  {confirming ? (
                    <div className="mt-3 flex items-center gap-2 animate-fade-up" style={{ animationDuration: "0.2s" }} role="group" aria-label="O'chirishni tasdiqlash">
                      <span className="min-w-0 flex-1 text-[12px] font-medium text-fg-2">O'chirilsinmi?</span>
                      <Button size="sm" variant="danger" className="!h-10" onClick={() => remove(item.id)}>
                        Ha, o'chirish
                      </Button>
                      <Button size="sm" variant="outline" className="!h-10" onClick={() => setConfirmId(null)} autoFocus>
                        Yo'q
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-2 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4 active:scale-[0.97]"
                      >
                        Ochish <ArrowUpRight size={14} />
                        <span className="sr-only">(yangi oynada)</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setConfirmId(item.id)}
                        disabled={Boolean(deletingId)}
                        aria-label={`${item.title} — o'chirish`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition hover:border-danger hover:bg-danger-soft hover:text-danger active:scale-95 disabled:opacity-50"
                      >
                        {deletingId === item.id ? <Spinner /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  )}
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
function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<ApiResponse<{ url: string }>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as ApiResponse<{ url: string }>);
      } catch {
        reject(new Error("bad json"));
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

function AddForm({ onAdded, onClose }: { onAdded: () => void; onClose?: () => void }) {
  const [type, setType] = useState<PortfolioType>("image");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const meta = TYPE_META[type];
  const preview = thumbFor({ type, url: url.trim(), thumbnailUrl: thumbnailUrl.trim() || null });

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const json = await uploadWithProgress(file, setProgress);
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setProgress(100);
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
        if (json.fields) {
          setErrors(json.fields);
          // Server xatosidan keyin birinchi noto'g'ri maydonga fokus
          if (json.fields.title) titleRef.current?.focus();
          else if (json.fields.url) urlRef.current?.focus();
        }
        return;
      }
      setTitle("");
      setUrl("");
      setThumbnailUrl("");
      setDescription("");
      setProgress(0);
      onAdded();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-elevated p-5 animate-fade-up sm:p-6" style={{ animationDuration: "0.35s" }} noValidate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-fg">Yangi ish</h2>
          <p className="text-[12px] text-fg-3">{meta.hint}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg active:scale-95">
            <X size={17} />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          {/* Tur */}
          <div>
            <span className="field-label">Tur</span>
            <div className="segment" role="radiogroup" aria-label="Ish turi">
              {(Object.keys(TYPE_META) as PortfolioType[]).map((t) => {
                const I = TYPE_META[t].icon;
                return (
                  <button key={t} type="button" role="radio" aria-checked={type === t} className="segment-item inline-flex min-h-[38px] items-center gap-1.5" data-active={type === t} onClick={() => setType(t)}>
                    <I size={13} /> {TYPE_META[t].label}
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
            <input ref={titleRef} id="pm-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Masalan: To'y filmi — Samarqand" aria-invalid={Boolean(errors.title)} />
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
                <input ref={urlRef} id="pm-url" className="field pl-10" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder={meta.placeholder} aria-invalid={Boolean(errors.url)} />
              </div>
              {type === "image" && (
                <>
                  <Button type="button" variant="outline" size="md" onClick={() => fileRef.current?.click()} disabled={uploading} className="shrink-0">
                    {uploading ? <Spinner /> : <Camera size={15} />} {uploading ? `${progress}%` : "Yuklash"}
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
            {/* Yuklash jarayoni */}
            {(uploading || (progress > 0 && progress < 100)) && (
              <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Yuklanmoqda">
                <div className="h-1.5 overflow-hidden rounded-full bg-fg/8">
                  <div className={cn("h-full rounded-full bg-accent transition-all duration-300", progress >= 100 && "animate-pulse")} style={{ width: `${Math.max(4, progress)}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-fg-3">{progress < 100 ? `Yuklanmoqda… ${progress}%` : "Qayta ishlanmoqda…"}</p>
              </div>
            )}
            {errors.url ? <p className="field-error">{errors.url}</p> : type === "image" && !uploading && <p className="mt-1 text-[12px] text-fg-4">JPG, PNG, WEBP · 5 MB gacha.</p>}
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
          <div className="card-outline relative aspect-[4/3] overflow-hidden">
            {preview ? (
              <SafeImage
                key={preview}
                src={preview}
                alt="Ko'rinish"
                className="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full w-full items-center justify-center grain" style={{ background: fallbackBg(title || url || "x") }}>
                    <meta.icon size={28} className="text-white/80" />
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
        <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
        <Button type="submit" variant="accent" disabled={busy || uploading} className="min-w-[160px]">
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
