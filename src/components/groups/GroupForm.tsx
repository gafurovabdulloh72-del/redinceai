"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ImagePlus, Lock, Radio, Trash2, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Switch } from "@/components/specialists/Filters";
import { SafeImage } from "@/components/specialists/SafeImage";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { UPLOAD_ACCEPT, uploadAttachment } from "@/components/chat/attachments";
import { CATEGORIES_BY_GROUP, REGIONS } from "@/lib/constants";
import { GROUP_COVER_ASPECT, GROUP_DESC_MAX, GROUP_NAME_MAX, GROUP_NAME_MIN, GROUP_RULES_MAX, GROUP_SLUG_MAX, GROUP_SLUG_MIN, GROUP_WELCOME_MAX } from "@/lib/groups/limits";
import { cn } from "@/lib/utils";

export interface GroupFormInitial {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  region: string | null;
  coverUrl: string | null;
  coverPosition: number | null;
  isPrivate: boolean;
  kind: "group" | "channel";
  isOfficial: boolean;
  rules: string | null;
  welcomeText: string | null;
}

type ApiResp = { ok: boolean; data?: { slug?: string }; error?: string; fields?: Record<string, string> };

const LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3";
const ERR = "text-[12.5px] font-semibold text-danger-text";
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/**
 * Jamoa ochish / sozlash formasi. Muqova ImageCropper orqali 3:1 nisbatda kesiladi (karta va hero bilan bir xil),
 * joylashuvi slayder bilan; qoidalar (markdown-lite) va xush kelibsiz matni; manzil (slug) — faqat egasi, edit rejimida.
 * O'chirish faqat egasiga (ikki bosqichli tasdiq).
 */
export function GroupForm({
  mode,
  initial,
  isOwner = false,
  isSiteAdmin = false,
}: {
  mode: "create" | "edit";
  initial?: GroupFormInitial;
  isOwner?: boolean;
  /** Sayt admini — "Rasmiy kanal" belgisini qo'ya oladi */
  isSiteAdmin?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [welcome, setWelcome] = useState(initial?.welcomeText ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [coverPos, setCoverPos] = useState<number>(initial?.coverPosition ?? 50);
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [kind, setKind] = useState<"group" | "channel">(initial?.kind ?? "group");
  const [isOfficial, setIsOfficial] = useState(initial?.isOfficial ?? false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmed = name.trim();
  const nameOk = trimmed.length >= GROUP_NAME_MIN && trimmed.length <= GROUP_NAME_MAX;
  const slugChanged = mode === "edit" && isOwner && slug.trim() !== (initial?.slug ?? "");
  const slugOk = !slugChanged || SLUG_RE.test(slug.trim());

  async function onCropped(file: File) {
    setCropFile(null);
    setUploading(true);
    setError(null);
    try {
      const a = await uploadAttachment(file);
      setCoverUrl(a.url);
      setCoverPos(50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rasm yuklanmadi");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameOk || !slugOk || busy || uploading) return;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const payload = {
        name: trimmed,
        description: description.trim(),
        rules: rules.trim(),
        welcomeText: welcome.trim(),
        category: category || null,
        region: region || null,
        coverUrl,
        coverPosition: coverUrl ? coverPos : null,
        isPrivate: isOfficial ? false : isPrivate,
        kind,
        ...(slugChanged ? { slug: slug.trim() } : {}),
        ...(isSiteAdmin ? { isOfficial: kind === "channel" && isOfficial } : {}),
      };
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
      const next = j.data?.slug ?? initial?.slug ?? "";
      router.push(`/jamoalar/${next}`);
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

  function cancel() {
    // To'g'ridan-to'g'ri kelganda (tarix bo'sh) back() saytdan chiqarib yuborardi
    if (window.history.length > 1) router.back();
    else router.push(mode === "edit" && initial ? `/jamoalar/${initial.slug}` : "/jamoalar");
  }

  return (
    <form onSubmit={submit} noValidate className="card grid gap-5 p-5 sm:p-6">
      {/* Muqova */}
      <div className="grid gap-1.5">
        <span className={LABEL}>Muqova</span>
        <div className="relative overflow-hidden rounded-[14px] border border-line bg-surface-2" style={{ aspectRatio: String(GROUP_COVER_ASPECT) }}>
          {coverUrl ? (
            <>
              <SafeImage src={coverUrl} alt="" width={1200} height={400} className="h-full w-full object-cover" style={{ objectPosition: `center ${coverPos}%` }} />
              <button type="button" onClick={() => setCoverUrl("")} aria-label="Muqovani olib tashlash" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white transition hover:bg-ink">
                <X size={14} />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-fg-3 transition hover:text-fg disabled:opacity-60">
              <ImagePlus size={22} />
              <span className="px-4 text-center text-[13px] font-semibold">{uploading ? "Yuklanmoqda…" : "Muqova rasmi (3:1)"}</span>
            </button>
          )}
        </div>
        {coverUrl && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-[13px] font-semibold text-fg-2 underline-offset-2 hover:underline">
              {uploading ? "Yuklanmoqda…" : "Boshqa rasm"}
            </button>
            <label className="flex min-w-[200px] flex-1 items-center gap-2 text-[12.5px] text-fg-3">
              Joylashuv
              <input type="range" min={0} max={100} value={coverPos} onChange={(e) => setCoverPos(Number(e.target.value))} aria-label="Muqova vertikal joylashuvi" className="h-1.5 flex-1 accent-[var(--fg)]" />
            </label>
          </div>
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
        {errors.coverUrl && (
          <p className={ERR} role="alert">
            {errors.coverUrl}
          </p>
        )}
      </div>

      {/* Turi: guruh yoki kanal */}
      <div className="grid gap-1.5">
        <span className={LABEL}>Turi</span>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Turi">
          {(
            [
              { key: "group", icon: UsersRound, title: "Guruh", text: "Hamma a'zo yozadi, chat ochiq" },
              { key: "channel", icon: Radio, title: "Kanal", text: "Faqat siz va adminlar yozasiz; a'zolar o'qiydi, izoh qoldiradi" },
            ] as const
          ).map((o) => {
            const active = kind === o.key;
            return (
              <button key={o.key} type="button" role="radio" aria-checked={active} onClick={() => setKind(o.key)} className={cn("flex items-start gap-3 rounded-[14px] border px-4 py-3 text-left transition", active ? "border-fg bg-surface-2" : "border-line hover:border-fg/40")}>
                <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2")}>
                  <o.icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-fg">{o.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-3">{o.text}</span>
                </span>
              </button>
            );
          })}
        </div>
        {mode === "edit" && initial && initial.kind !== kind && <p className="text-[12px] text-fg-3">Mavjud postlar o&apos;zgarmaydi — faqat kim yoza olishi.</p>}
        {errors.kind && (
          <p className={ERR} role="alert">
            {errors.kind}
          </p>
        )}
      </div>

      <label className="grid gap-1.5">
        <span className={LABEL}>Nomi</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={GROUP_NAME_MAX}
          required
          aria-required
          aria-invalid={Boolean(errors.name) || undefined}
          aria-describedby="group-name-hint"
          placeholder={kind === "channel" ? "Masalan: Kasb Egalari — rasmiy kanal" : "Masalan: Buxoro montajchilari"}
          className="field h-11 w-full text-[14px]"
          autoFocus={mode === "create"}
        />
        <span id="group-name-hint" className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.name}</span>
          <span>
            {trimmed.length}/{GROUP_NAME_MAX}
          </span>
        </span>
      </label>

      {mode === "edit" && isOwner && (
        <label className="grid gap-1.5">
          <span className={LABEL}>Manzil</span>
          <span className="field flex h-11 w-full items-center gap-0 text-[14px]">
            <span className="shrink-0 text-fg-4">/jamoalar/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} minLength={GROUP_SLUG_MIN} maxLength={GROUP_SLUG_MAX} aria-invalid={Boolean(errors.slug) || !slugOk || undefined} aria-describedby="group-slug-hint" spellCheck={false} className="min-w-0 flex-1 bg-transparent outline-none" />
          </span>
          <span id="group-slug-hint" className="text-[11.5px] text-fg-4">
            {errors.slug ? <span className="text-danger-text">{errors.slug}</span> : !slugOk ? <span className="text-danger-text">3–40 belgi: kichik lotin harf, raqam, defis</span> : slugChanged ? "Eski manzil yangisiga yo'naltiriladi." : "Kichik lotin harf, raqam va defis."}
          </span>
        </label>
      )}

      <label className="grid gap-1.5">
        <span className={LABEL}>Tavsif</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={GROUP_DESC_MAX} rows={4} aria-invalid={Boolean(errors.description) || undefined} aria-describedby="group-desc-hint" placeholder="Jamoa nima haqida, kimlar uchun…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
        <span id="group-desc-hint" className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.description}</span>
          <span>
            {description.length}/{GROUP_DESC_MAX}
          </span>
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className={LABEL}>Qoidalar</span>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} maxLength={GROUP_RULES_MAX} rows={4} aria-invalid={Boolean(errors.rules) || undefined} aria-describedby="group-rules-hint" placeholder={"- Hurmat — tanqid ishga, odamga emas\n- Spam va takroriy reklama yo'q\n- **Mijoz kontaktlari** tarqatilmaydi"} className="field w-full resize-y py-2.5 font-mono text-[13px] leading-relaxed" />
        <span id="group-rules-hint" className="flex justify-between text-[11.5px] text-fg-4">
          <span>{errors.rules ? <span className="text-danger-text">{errors.rules}</span> : "«- » bilan ro'yxat, **qalin**. Bo'sh qolsa — umumiy qoidalar."}</span>
          <span>
            {rules.length}/{GROUP_RULES_MAX}
          </span>
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className={LABEL}>Xush kelibsiz matni</span>
        <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={GROUP_WELCOME_MAX} rows={2} aria-invalid={Boolean(errors.welcomeText) || undefined} aria-describedby="group-welcome-hint" placeholder="Yangi a'zo qo'shilganda bildirishnoma sifatida boradi" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
        <span id="group-welcome-hint" className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.welcomeText}</span>
          <span>
            {welcome.length}/{GROUP_WELCOME_MAX}
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={LABEL}>Yo&apos;nalish</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field h-11 w-full text-[14px]">
            <option value="">Umumiy</option>
            {CATEGORIES_BY_GROUP.map(({ group, items }) => (
              <optgroup key={group.slug} label={group.name}>
                {items.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.plural}
                  </option>
                ))}
              </optgroup>
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

      <div className="divide-y divide-line border-y border-line">
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
              <Lock size={14} className="text-fg-3" /> Yopiq jamoa
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">Lenta va chat faqat a&apos;zolarga; so&apos;rovlarni siz tasdiqlaysiz.</p>
          </div>
          <Switch checked={isPrivate && !isOfficial} onChange={(v) => !isOfficial && setIsPrivate(v)} label="Yopiq jamoa" />
        </div>
        {isSiteAdmin && (
          <div className={cn("flex items-center justify-between gap-4 py-3", kind !== "channel" && "opacity-60")}>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
                <BadgeCheck size={14} className="text-accent" /> Rasmiy kanal
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">
                Hamma avtomatik a&apos;zo, tepada qadalgan, chiqib bo&apos;lmaydi.
                {kind !== "channel" && " Faqat «Kanal» uchun."}
              </p>
              {errors.isOfficial && (
                <p className={cn(ERR, "mt-1")} role="alert">
                  {errors.isOfficial}
                </p>
              )}
            </div>
            <Switch checked={kind === "channel" && isOfficial} onChange={(v) => kind === "channel" && setIsOfficial(v)} label="Rasmiy kanal" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={!nameOk || !slugOk || busy || uploading}>
          {busy ? "Saqlanmoqda…" : mode === "create" ? (kind === "channel" ? "Kanal ochish" : "Guruh ochish") : "Saqlash"}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={cancel} disabled={busy}>
          Bekor
        </Button>
        {error && (
          <span className="text-[13px] font-semibold text-danger-text" role="alert">
            {error}
          </span>
        )}
        {mode === "edit" && isOwner && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {confirmDelete ? (
              <span className="expand-in flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-fg-2">Postlar va chat ham o&apos;chadi. Aniqmi?</span>
                <Button type="button" variant="danger" size="sm" onClick={remove} disabled={busy}>
                  Ha, o&apos;chirish
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Bekor
                </Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-danger-text hover:text-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> O&apos;chirish
              </Button>
            )}
          </div>
        )}
      </div>

      {cropFile && <ImageCropper file={cropFile} aspect={GROUP_COVER_ASPECT} outWidth={1500} title="Muqovani moslang" onDone={onCropped} onCancel={() => setCropFile(null)} />}
    </form>
  );
}
