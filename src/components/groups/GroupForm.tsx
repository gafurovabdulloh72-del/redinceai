"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Lock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Switch } from "@/components/specialists/Filters";
import { SafeImage } from "@/components/specialists/SafeImage";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { UPLOAD_ACCEPT, uploadAttachment } from "@/components/chat/attachments";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { GROUP_COVER_ASPECT, GROUP_DESC_MAX, GROUP_NAME_MAX, GROUP_NAME_MIN } from "@/lib/groups/limits";

export interface GroupFormInitial {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  region: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
}

type ApiResp = { ok: boolean; data?: { slug?: string }; error?: string; fields?: Record<string, string> };

const LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3";

/**
 * Jamoa ochish / sozlash formasi. Muqova ImageCropper orqali 3:1 nisbatda kesiladi (karta va hero bilan bir xil),
 * yuklash oddiy /api/upload oqimi. O'chirish faqat egasiga (ikki bosqichli tasdiq).
 */
export function GroupForm({ mode, initial, isOwner = false }: { mode: "create" | "edit"; initial?: GroupFormInitial; isOwner?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmed = name.trim();
  const nameOk = trimmed.length >= GROUP_NAME_MIN && trimmed.length <= GROUP_NAME_MAX;

  async function onCropped(file: File) {
    setCropFile(null);
    setUploading(true);
    setError(null);
    try {
      const a = await uploadAttachment(file);
      setCoverUrl(a.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rasm yuklanmadi");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameOk || busy || uploading) return;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const payload = { name: trimmed, description: description.trim(), category: category || null, region: region || null, coverUrl, isPrivate };
      const res = await fetch(mode === "create" ? "/api/groups" : `/api/groups/${encodeURIComponent(initial?.slug ?? "")}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) {
        if (j.fields) setErrors(j.fields);
        throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlab bo'lmadi");
      }
      const slug = j.data?.slug ?? initial?.slug ?? "";
      router.push(`/jamoalar/${slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(initial.slug)}`, { method: "DELETE" });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) throw new Error(j.error || "O'chirib bo'lmadi");
      router.push("/jamoalar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirib bo'lmadi");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card grid gap-5 p-5 sm:p-6">
      {/* Muqova */}
      <div className="grid gap-1.5">
        <span className={LABEL}>Muqova (ixtiyoriy)</span>
        <div className="relative overflow-hidden rounded-[16px] border border-line bg-surface-2" style={{ aspectRatio: String(GROUP_COVER_ASPECT) }}>
          {coverUrl ? (
            <>
              <SafeImage src={coverUrl} alt="" width={1200} height={400} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setCoverUrl("")}
                aria-label="Muqovani olib tashlash"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur transition hover:bg-ink"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-fg-3 transition hover:text-fg disabled:opacity-60"
            >
              <ImagePlus size={22} />
              <span className="px-4 text-center text-[13px] font-semibold">{uploading ? "Yuklanmoqda…" : "Rasm tanlang — 3:1 nisbatda kesiladi"}</span>
            </button>
          )}
        </div>
        {coverUrl && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="justify-self-start text-[13px] font-semibold text-fg-2 underline-offset-2 hover:underline">
            {uploading ? "Yuklanmoqda…" : "Boshqa rasm tanlash"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setCropFile(f);
          }}
        />
        {errors.coverUrl && <p className="text-[12.5px] font-semibold text-danger-text">{errors.coverUrl}</p>}
      </div>

      <label className="grid gap-1.5">
        <span className={LABEL}>Nomi</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={GROUP_NAME_MAX}
          placeholder="Masalan: Buxoro montajchilari"
          className="field h-11 w-full text-[14px]"
          autoFocus={mode === "create"}
        />
        <span className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.name}</span>
          <span>
            {trimmed.length}/{GROUP_NAME_MAX}
          </span>
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className={LABEL}>Tavsif</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={GROUP_DESC_MAX}
          rows={4}
          placeholder="Jamoa nima haqida, kimlar uchun, qoidalar…"
          className="field w-full resize-y py-2.5 text-[14px] leading-relaxed"
        />
        <span className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.description}</span>
          <span>
            {description.length}/{GROUP_DESC_MAX}
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={LABEL}>Yo&apos;nalish</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field h-11 w-full text-[14px]">
            <option value="">Umumiy (barcha yo&apos;nalishlar)</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.plural}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Hudud</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="field h-11 w-full text-[14px]">
            <option value="">Butun O&apos;zbekiston</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-[16px] border border-line px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
            <Lock size={14} className="text-fg-3" /> Yopiq jamoa
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">Lenta va chat faqat a&apos;zolarga ko&apos;rinadi; qo&apos;shilish so&apos;rovlarini siz tasdiqlaysiz.</p>
        </div>
        <Switch checked={isPrivate} onChange={setIsPrivate} label="Yopiq jamoa" />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" size="md" disabled={!nameOk || busy || uploading}>
          {busy ? "Saqlanmoqda…" : mode === "create" ? "Jamoa ochish" : "Saqlash"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={() => router.back()} disabled={busy}>
          Bekor
        </Button>
        {error && <span className="text-[13px] font-semibold text-danger-text">{error}</span>}
        {mode === "edit" && isOwner && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-[12.5px] text-fg-2">Jamoa, postlar va chat butunlay o&apos;chadi. Aniqmi?</span>
                <Button type="button" variant="danger" size="sm" onClick={remove} disabled={busy}>
                  Ha, o&apos;chirish
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Bekor
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-danger-text hover:text-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Jamoani o&apos;chirish
              </Button>
            )}
          </div>
        )}
      </div>

      {cropFile && <ImageCropper file={cropFile} aspect={GROUP_COVER_ASPECT} outWidth={1500} title="Muqovani moslang" onDone={onCropped} onCancel={() => setCropFile(null)} />}
    </form>
  );
}
