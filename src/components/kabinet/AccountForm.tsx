"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, AtSign, BellRing, Camera, Check, CheckCircle2, Copy, KeyRound, Mail, MailWarning, Mars, MessageCircle, ShieldCheck, Trash2, Undo2, UserRound, Venus, X } from "lucide-react";
import { Avatar, Badge, Button, Spinner } from "@/components/ui";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { useUnsavedGuard } from "@/components/kabinet/useUnsavedGuard";
import { LEVEL_HINT, VisibilityChip } from "@/components/kabinet/VisibilityChip";
import { GENDERS } from "@/lib/constants";
import type { ResolvedVisibility } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export type Gender = "male" | "female" | null;

export interface AccountInitial {
  name: string;
  phone: string;
  avatarUrl: string;
  email: string;
  /** Chat taxallusi (@username) — /yozish/<username> havolasi uchun */
  username?: string | null;
  gender?: Gender;
  /** Muhim hodisalar emailga ham yuborilsinmi (users.notifyEmail) */
  notifyEmail?: boolean;
  /** Email tasdiqlanganmi (berilmasa belgi ko'rsatilmaydi, faqat o'zgartirilgandan keyin "Tasdiqlanmagan") */
  emailVerified?: boolean;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const GENDER_OPTIONS: Array<{ value: Gender; label: string; icon?: typeof Venus }> = [
  ...GENDERS.map((g) => ({ value: g.value as Gender, label: g.label, icon: g.value === "female" ? Venus : Mars })),
  { value: null, label: "Ko'rsatilmagan" },
];

/**
 * Telefon maskasi: O'zbekiston raqami yozilayotganda «+998 90 123 45 67» ko'rinishida formatlanadi.
 * Boshqa davlat kodi (998 bilan boshlanmaydigan 10+ raqam) — kiritilganicha qoladi; bo'sh — bo'sh.
 */
function maskUzPhone(raw: string, prev: string): string {
  if (!raw.trim()) return "";
  let digits = raw.replace(/\D/g, "");
  // O'chirayotganda (backspace) formatlovchi bo'shliqni qayta tiklamasin — raqam kamaysa ham mask qayta quriladi
  if (digits.startsWith("998")) digits = digits.slice(3);
  else if (digits.length > 9 && !raw.trim().startsWith("+998")) return raw; // chet el raqami — tegmaymiz
  digits = digits.slice(0, 9);
  if (!digits && prev.length > raw.length) return "";
  const g = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return `+998${g.length ? " " + g.join(" ") : ""}`;
}

type UsernameCheck = { status: "idle" | "checking" | "ok" | "taken" | "invalid"; reason?: string | null };

export function AccountForm({ initial, visibility = null }: { initial: AccountInitial; visibility?: ResolvedVisibility | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [gender, setGender] = useState<Gender>(initial.gender ?? null);
  const [notifyEmail, setNotifyEmail] = useState(initial.notifyEmail ?? true);
  const [email, setEmail] = useState(initial.email);
  const [username, setUsername] = useState(initial.username ?? "");
  const [uCheck, setUCheck] = useState<UsernameCheck>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  /** Email o'zgardi — qayta tasdiqlash kerak (emailVerified=false) */
  const [emailChanged, setEmailChanged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /* Hidratsiya mosligi uchun: host faqat klientda, useEffect ichida o'qiladi (SSR'da bo'sh) */
  const [host, setHost] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  /** Tanlangan fayl — yuklashdan oldin kesish oynasida moslash uchun */
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    setHost(window.location.host);
  }, []);

  const emailDiff = email.trim().toLowerCase() !== initial.email.toLowerCase();
  const cleanUsername = username.trim().replace(/^@/, "").toLowerCase();
  const usernameDiff = cleanUsername !== (initial.username ?? "");
  const dirty =
    name !== initial.name ||
    phone !== initial.phone ||
    avatarUrl !== initial.avatarUrl ||
    gender !== (initial.gender ?? null) ||
    notifyEmail !== (initial.notifyEmail ?? true) ||
    emailDiff ||
    usernameDiff;
  useUnsavedGuard(dirty && !busy);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(t);
  }, [saved]);

  /* Taxallus bandligi — 400 ms debounce bilan jonli tekshiruv (o'z taxallusi — tekshirilmaydi) */
  useEffect(() => {
    if (!usernameDiff || !cleanUsername) {
      setUCheck({ status: "idle" });
      return;
    }
    setUCheck({ status: "checking" });
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/account/username?u=${encodeURIComponent(cleanUsername)}`, { signal: ctrl.signal, cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ available: boolean; value: string | null; reason: string | null }>;
        if (!json.ok) {
          setUCheck({ status: "idle" });
          return;
        }
        setUCheck(json.data.available ? { status: "ok" } : { status: json.data.value ? "taken" : "invalid", reason: json.data.reason });
      } catch {
        if (!ctrl.signal.aborted) setUCheck({ status: "idle" });
      }
    }, 400);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [cleanUsername, usernameDiff]);

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
    // Emailni o'zgartirish — joriy parol bilan (server ham tekshiradi)
    if (emailDiff && !currentPassword) {
      setErrors({ currentPassword: "Emailni o'zgartirish uchun joriy parolni kiriting" });
      return;
    }
    if (uCheck.status === "taken" || uCheck.status === "invalid") {
      setErrors({ username: uCheck.reason ?? "Taxallusni tekshiring" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          avatarUrl: avatarUrl.trim(),
          gender,
          notifyEmail,
          username: username.trim(),
          ...(emailDiff ? { email: email.trim(), currentPassword } : {}),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ updated: boolean; emailChanged?: boolean }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) setErrors(json.fields);
        return;
      }
      setCurrentPassword("");
      if (json.data.emailChanged) setEmailChanged(true);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const avatarRemoved = Boolean(initial.avatarUrl) && avatarUrl === "";
  const usernameHint =
    uCheck.status === "checking" ? (
      <span className="inline-flex items-center gap-1.5 text-fg-3">
        <Spinner className="!h-3 !w-3" /> Tekshirilmoqda…
      </span>
    ) : uCheck.status === "ok" ? (
      <span className="inline-flex items-center gap-1 font-semibold text-success-text">
        <Check size={13} /> Bo&apos;sh — olishingiz mumkin
      </span>
    ) : uCheck.status === "taken" || uCheck.status === "invalid" ? (
      <span className="inline-flex items-center gap-1 font-medium text-danger-text">
        <X size={13} /> {uCheck.reason}
      </span>
    ) : (
      "3–20 belgi: kichik lotin harflari, raqam va chiziqcha. Bu — chat havolangiz manzili."
    );

  return (
    <form onSubmit={submit} className="card scroll-mt-28 p-5 sm:p-6" id="akkaunt" noValidate aria-busy={busy}>
      <div className="flex items-start gap-3">
        <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
          <UserRound size={18} />
        </span>
        <div>
          <h2 className="font-display text-[19px] font-semibold tracking-tight text-fg">Akkaunt</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">Ism, email, telefon, jins va avatar.</p>
        </div>
      </div>

      {/* Avatar */}
      <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative">
          <Avatar name={name || initial.name || "?"} src={avatarUrl || null} size={84} className="text-[28px]" />
          {uploading && (
            <span className="card-elevated absolute inset-0 flex items-center justify-center !rounded-full">
              <Spinner />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Camera size={14} /> {avatarUrl ? "Rasmni almashtirish" : "Rasm yuklash"}
            </Button>
            {avatarUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl("")} disabled={uploading} className="text-danger-text hover:bg-danger-soft hover:text-danger-text">
                <Trash2 size={14} /> O&apos;chirish
              </Button>
            )}
            {avatarRemoved && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(initial.avatarUrl)} disabled={uploading}>
                <Undo2 size={14} /> Qaytarish
              </Button>
            )}
          </div>
          <p className="mt-2 text-[12px] text-fg-4" aria-live="polite">
            {avatarRemoved ? "Rasm «Saqlash» bosilgach o'chiriladi." : "JPG, PNG, WEBP yoki GIF · 5 MB gacha. Yuklashdan oldin surish va kattalashtirish mumkin."}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Avatar rasmini yuklash"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCropFile(f);
            }}
          />
        </div>
      </div>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          aspect={1}
          outWidth={512}
          title="Avatarni moslang"
          onCancel={() => setCropFile(null)}
          onDone={(f) => {
            setCropFile(null);
            void upload(f);
          }}
        />
      )}

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
            aria-describedby={errors.name ? "acc-name-error" : undefined}
          />
          {errors.name && (
            <p id="acc-name-error" className="field-error">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="acc-phone" className="field-label !mb-0">
              Telefon <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </label>
            {visibility && <VisibilityChip level={visibility.phone} />}
          </div>
          <input
            id="acc-phone"
            className="field tabular-nums"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(maskUzPhone(e.target.value, phone))}
            maxLength={20}
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "acc-phone-error" : "acc-phone-hint"}
          />
          {errors.phone ? (
            <p id="acc-phone-error" className="field-error">
              {errors.phone}
            </p>
          ) : (
            <p id="acc-phone-hint" className="mt-1 text-[12px] text-fg-4">
              {visibility ? LEVEL_HINT[visibility.phone] : "Standart: faqat ro'yxatdan o'tganlarga ko'rinadi."}
            </p>
          )}
        </div>

        {/* Chat taxallusi va shaxsiy chat havolasi */}
        <div>
          <label htmlFor="acc-username" className="field-label">
            Chat taxallusi
          </label>
          <div className="relative">
            <AtSign size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
            <input
              id="acc-username"
              className={cn("field pl-9 lowercase", uCheck.status === "ok" && "!border-success", (uCheck.status === "taken" || uCheck.status === "invalid") && "!border-danger")}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={21}
              autoComplete="off"
              spellCheck={false}
              placeholder="masalan: jasur-karimov"
              aria-invalid={Boolean(errors.username) || uCheck.status === "taken" || uCheck.status === "invalid"}
              aria-describedby="acc-username-hint"
            />
          </div>
          {errors.username ? (
            <p id="acc-username-hint" className="field-error">
              {errors.username}
            </p>
          ) : (
            <p id="acc-username-hint" className="mt-1 text-[12px] text-fg-4" aria-live="polite">
              {usernameHint}
            </p>
          )}
          {(initial.username || username.trim()) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 font-mono text-[12.5px] text-fg-2">
                <MessageCircle size={13} className="text-fg-3" aria-hidden="true" />
                {host}/yozish/{(cleanUsername || initial.username) ?? ""}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/yozish/${(cleanUsername || initial.username) ?? ""}`);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch {
                    /* clipboard yopiq — havola baribir ko'rinib turibdi */
                  }
                }}
                className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
              >
                <Copy size={13} /> {copied ? "Nusxalandi ✓" : "Nusxalash"}
              </button>
            </div>
          )}
        </div>

        {/* Jins */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="field-label !mb-0" id="acc-gender-label">
              Jins <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </span>
            {visibility && <VisibilityChip level={visibility.gender} />}
          </div>
          <div className="segment flex w-full sm:inline-flex sm:w-auto" role="radiogroup" aria-labelledby="acc-gender-label">
            {GENDER_OPTIONS.map((g) => {
              const active = gender === g.value;
              const Icon = g.icon;
              return (
                <button
                  key={String(g.value)}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-active={active}
                  onClick={() => setGender(g.value)}
                  className="segment-item inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 sm:flex-none"
                >
                  {Icon && <Icon size={13} />}
                  {g.label}
                </button>
              );
            })}
          </div>
          {errors.gender ? <p className="field-error">{errors.gender}</p> : <p className="mt-1.5 text-[12px] text-fg-4">Mijozlar ro&apos;yxatda jins bo&apos;yicha saralashi mumkin.</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="acc-email" className="field-label !mb-0">
              Email
            </label>
            {emailChanged || initial.emailVerified === false ? (
              <Link href="/kabinet/xavfsizlik" className="inline-flex min-h-8 items-center" title="Xavfsizlik bo'limida tasdiqlang">
                <Badge tone="warning">
                  <AlertCircle size={12} /> Tasdiqlanmagan
                </Badge>
              </Link>
            ) : initial.emailVerified ? (
              <Badge tone="success">
                <ShieldCheck size={12} /> Tasdiqlangan
              </Badge>
            ) : null}
          </div>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-fg-4" aria-hidden="true" />
            <input
              id="acc-email"
              className="field pl-10"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailChanged(false);
              }}
              maxLength={120}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "acc-email-error" : "acc-email-hint"}
            />
          </div>
          {errors.email ? (
            <p id="acc-email-error" className="field-error">
              {errors.email}
            </p>
          ) : (
            <p id="acc-email-hint" className="mt-1 text-[12px] text-fg-4">
              {emailDiff ? "Yangi email qayta tasdiqlanadi, eski manzilga ogohlantirish yuboriladi." : "Email kirish uchun ishlatiladi."}
            </p>
          )}
        </div>

        {emailDiff && (
          <div className="expand-in sm:col-start-2">
            <label htmlFor="acc-current-password" className="field-label">
              Joriy parol
            </label>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-fg-4" aria-hidden="true" />
              <input
                id="acc-current-password"
                className="field pl-10"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                maxLength={100}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.currentPassword)}
                aria-describedby={errors.currentPassword ? "acc-current-password-error" : undefined}
              />
            </div>
            {errors.currentPassword ? (
              <p id="acc-current-password-error" className="field-error">
                {errors.currentPassword}
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-fg-4">Emailni o&apos;zgartirish uchun parolingizni kiriting.</p>
            )}
          </div>
        )}
      </div>

      {emailChanged && (
        <div role="status" className="card-outline mt-6 flex items-start gap-3 !rounded-[14px] px-4 py-3">
          <MailWarning size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden="true" />
          <p className="min-w-0 text-[13px] leading-relaxed text-fg-2">
            Email yangilandi. Yangi manzilni tasdiqlang —{" "}
            <Link href="/kabinet/xavfsizlik" className="font-semibold text-fg underline underline-offset-2">
              Xavfsizlik bo&apos;limida kod oling
            </Link>
            .
          </p>
        </div>
      )}

      {/* Email bildirishnomalar */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <BellRing size={18} className="mt-0.5 shrink-0 text-fg-3" aria-hidden="true" />
          <div className="min-w-0">
            <p id="acc-notify-label" className="text-[14px] font-semibold text-fg">
              Email bildirishnomalar
            </p>
            <p id="acc-notify-hint" className="text-[12px] text-fg-3">
              {notifyEmail ? "Muhim hodisalar emailga ham keladi." : "Faqat saytdagi qo'ng'iroqda. Xavfsizlik xatlari baribir yuboriladi."}{" "}
              <Link href="/kabinet/bildirishnomalar" className="font-semibold text-fg-2 underline underline-offset-2 hover:text-fg">
                Turlar bo&apos;yicha sozlash
              </Link>
            </p>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={notifyEmail} aria-labelledby="acc-notify-label" aria-describedby="acc-notify-hint" onClick={() => setNotifyEmail((v) => !v)} className="switch" />
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
              <CheckCircle2 size={15} /> Saqlandi
            </span>
          ) : dirty ? (
            <span className="text-fg-3">O&apos;zgarishlar hali saqlanmagan</span>
          ) : (
            <span className="text-fg-4">Hammasi saqlangan</span>
          )}
        </div>
        <Button type="submit" disabled={busy || uploading || !dirty || uCheck.status === "checking"} className="sm:min-w-[160px]">
          {busy ? <Spinner /> : "Saqlash"}
        </Button>
      </div>
    </form>
  );
}
