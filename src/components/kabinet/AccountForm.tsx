"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Camera, CheckCircle2, Mail, Trash2, UserRound } from "lucide-react";
import { Avatar, Button, Spinner } from "@/components/ui";

export interface AccountInitial {
  name: string;
  phone: string;
  avatarUrl: string;
  email: string;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

export function AccountForm({ initial }: { initial: AccountInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = name !== initial.name || phone !== initial.phone || avatarUrl !== initial.avatarUrl;

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(t);
  }, [saved]);

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
      setAvatarUrl(json.data.url);
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
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), avatarUrl: avatarUrl.trim() }),
      });
      const json = (await res.json()) as ApiResponse<{ updated: boolean }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) setErrors(json.fields);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass p-5 sm:p-7" noValidate>
      <div className="flex items-start gap-3">
        <span className="glass-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
          <UserRound size={20} />
        </span>
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-fg">Akkaunt</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">Ism, telefon va avatar — bular mijozlar va mutaxassislarga ko'rinadi.</p>
        </div>
      </div>

      {/* Avatar */}
      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative">
          <Avatar name={name || initial.name || "?"} src={avatarUrl || null} size={84} className="text-[28px]" />
          {uploading && (
            <span className="glass-strong absolute inset-0 flex items-center justify-center rounded-full">
              <Spinner />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="glass" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Camera size={14} /> {avatarUrl ? "Rasmni almashtirish" : "Rasm yuklash"}
            </Button>
            {avatarUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl("")} disabled={uploading} className="text-ios-red hover:bg-ios-red/10 hover:text-ios-red">
                <Trash2 size={14} /> O'chirish
              </Button>
            )}
          </div>
          <p className="mt-2 text-[12px] text-fg-4">JPG, PNG, WEBP yoki GIF · 5 MB gacha. Kvadrat rasm yaxshi ko'rinadi.</p>
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
        </div>
      </div>

      {/* Maydonlar */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="acc-name" className="field-label">
            Ism-familiya
          </label>
          <input
            id="acc-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            placeholder="Masalan: Jasur Karimov"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="acc-phone" className="field-label">
            Telefon <span className="font-normal text-fg-4">(ixtiyoriy)</span>
          </label>
          <input
            id="acc-phone"
            className="field"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone ? <p className="field-error">{errors.phone}</p> : <p className="mt-1 text-[12px] text-fg-4">Mutaxassis profilida «Aloqa» bo'limida ko'rinadi.</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="acc-email" className="field-label">
            Email
          </label>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-fg-4" />
            <input id="acc-email" className="field pl-10 opacity-70" value={initial.email} readOnly disabled />
          </div>
          <p className="mt-1 text-[12px] text-fg-4">Email kirish uchun ishlatiladi va o'zgartirilmaydi.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#1f9d46] dark:text-ios-green">
              <CheckCircle2 size={15} /> Saqlandi
            </span>
          ) : dirty ? (
            <span className="text-fg-3">O'zgarishlar hali saqlanmagan</span>
          ) : (
            <span className="text-fg-4">Hammasi saqlangan</span>
          )}
        </div>
        <Button type="submit" disabled={busy || uploading || !dirty} className="sm:min-w-[160px]">
          {busy ? <Spinner /> : "Saqlash"}
        </Button>
      </div>
    </form>
  );
}
