"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Clapperboard, ClipboardList, KeyRound, LifeBuoy, MessageSquareText, Search, ShieldCheck, Smartphone, TimerReset, UserRound, Wand2 } from "lucide-react";
import { PasswordField } from "./PasswordField";
import { Button, Spinner } from "@/components/ui";
import { GENDERS } from "@/lib/constants";
import { passwordStrength } from "@/lib/security/password-strength";
import { cn, formatPrice, safeInternalPath } from "@/lib/utils";

type Mode = "login" | "register";
type Role = "client" | "specialist";
type Gender = "" | "male" | "female";

interface AuthFormProps {
  mode: Mode;
  /** Muvaffaqiyatdan so'ng qaytish manzili (faqat ichki yo'l) */
  next?: string;
  /** Ro'yxatdan o'tishda boshlang'ich rol */
  defaultRole?: Role;
  /** Nega kirish so'ralmoqda: ?reason=review|order|expired (A23) */
  reason?: string;
  /** Mutaxassis obunasi (admin sozlamasi) — ro'yxatdan o'tishda eslatma uchun */
  subscription?: { price: number; trialDays: number; enforced: boolean };
}

interface ApiOk {
  ok: true;
  data: { id: string; name: string; role: "client" | "specialist" | "admin"; recoveryLeft?: number | null } | { twoFactor: true; ticket: string };
}
interface ApiFail {
  ok: false;
  error: string;
  fields?: Record<string, string>;
}

/** Demo hisoblar paneli faqat NEXT_PUBLIC_DEMO_ACCOUNTS=1 bo'lganda ko'rinadi (A11); production bundle'ga hech qachon kirmaydi */
const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "1" && process.env.NODE_ENV !== "production";

const ROLE_OPTIONS: { value: Role; title: string; subtitle: string; icon: typeof Search }[] = [
  { value: "client", title: "Mijozman", subtitle: "Mutaxassis qidiryapman", icon: Search },
  { value: "specialist", title: "Mutaxassisman", subtitle: "Buyurtma olmoqchiman", icon: Clapperboard },
];

const DEMO_ACCOUNTS: { label: string; hint: string; email: string; password: string; icon: typeof UserRound }[] = DEMO_ENABLED
  ? [
      { label: "Mutaxassis", hint: "Profil, portfolio, buyurtmalar", email: "mutaxassis@redince.uz", password: "demo12345", icon: Clapperboard },
      { label: "Mijoz", hint: "Qidiruv va buyurtma berish", email: "mijoz@redince.uz", password: "demo12345", icon: UserRound },
      { label: "Admin", hint: "Boshqaruv paneli", email: "admin@redince.uz", password: "admin12345", icon: ShieldCheck },
    ]
  : [];

/** Matn ichidagi havola uchun 40px bosish maydoni — ko'rinishi o'zgarmaydi (manfiy margin qatorni kengaytirmaydi) */
const INLINE_LINK = "inline-flex min-h-10 items-center -my-2 -mx-1 px-1 font-semibold text-accent-text transition hover:brightness-110";

const FIELD_ORDER = ["name", "email", "password", "phone", "terms"] as const;

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** Kontekstli xabar: foydalanuvchi qayerdan va nega keldi */
function contextFor(mode: Mode, next?: string, reason?: string): { icon: typeof ClipboardList; title: string; text: string } | null {
  const verb = mode === "register" ? "avval hisob oching" : "avval kiring";
  if (reason === "expired") return { icon: TimerReset, title: "Sessiya muddati tugagan", text: "Xavfsizlik uchun qayta kirishingiz kerak. Kirgach, oldingi sahifaga qaytasiz." };
  if (reason === "review" || next?.includes("#sharh")) return { icon: MessageSquareText, title: `Sharh qoldirish uchun ${verb}`, text: "Sharhlar faqat ro'yxatdan o'tgan foydalanuvchilar nomidan yoziladi." };
  if (!next) return null;
  if (next.startsWith("/buyurtma")) return { icon: ClipboardList, title: `Buyurtma berish uchun ${verb}`, text: "Kirganingizdan so'ng buyurtma sahifasiga qaytasiz — yozganlaringiz saqlanadi." };
  if (next.startsWith("/mutaxassislar/")) return { icon: MessageSquareText, title: `Sharh yozish yoki buyurtma berish uchun ${verb}`, text: "Kirganingizdan so'ng mutaxassis sahifasiga qaytasiz." };
  if (next.startsWith("/admin")) return { icon: ShieldCheck, title: "Admin panel uchun kiring", text: "Faqat administrator hisobi bilan ochiladi." };
  if (next.startsWith("/kabinet")) return { icon: UserRound, title: `Kabinetga o'tish uchun ${verb}`, text: "Buyurtmalar, profil va sozlamalar kabinetda." };
  return null;
}

export function AuthForm({ mode, next, defaultRole = "client", reason, subscription }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const target = safeInternalPath(next);
  const context = contextFor(mode, target, reason);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [role, setRole] = useState<Role>(defaultRole);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [demoOpen, setDemoOpen] = useState(false);
  const [filledDemo, setFilledDemo] = useState<string | null>(null);
  /** Oferta va maxfiylik siyosatiga rozilik (ro'yxatdan o'tish — majburiy) */
  const [acceptTerms, setAcceptTerms] = useState(false);
  /** 2FA ikkinchi bosqichi: parol to'g'ri, ilova kodi kutilmoqda */
  const [ticket, setTicket] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  // Xato chiqqanda birinchi xato maydonga fokus (A89)
  useEffect(() => {
    const first = FIELD_ORDER.find((k) => fields[k]);
    if (!first) return;
    document.getElementById(`auth-${first}`)?.focus();
  }, [fields]);

  const clearField = (key: string) => {
    if (!fields[key]) return;
    setFields((f) => {
      const copy = { ...f };
      delete copy[key];
      return copy;
    });
  };

  /** Serverga yubormasdan oldin yengil tekshiruv (zod sxemasi bilan bir xil qoidalar) */
  const validate = () => {
    const errs: Record<string, string> = {};
    if (isRegister && name.trim().length < 2) errs.name = "Ism kamida 2 ta belgi";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Email noto'g'ri";
    if (isRegister) {
      const s = passwordStrength(password);
      if (!s.valid) errs.password = password.length < 8 ? "Parol kamida 8 ta belgi" : "Parolda harf ham, raqam ham bo'lsin";
    } else if (!password) errs.password = "Parolni kiriting";
    if (isRegister && phone.trim() && !/^\+?[\d\s()-]{9,16}$/.test(phone.trim())) errs.phone = "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)";
    if (isRegister && !acceptTerms) errs.terms = "Davom etish uchun oferta va maxfiylik siyosatiga rozilik bering";
    return errs;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const errs = validate();
    if (Object.keys(errs).length) {
      setFields(errs);
      return;
    }
    setFields({});
    setLoading(true);

    const payload = isRegister
      ? { name: name.trim(), email: email.trim(), password, phone: phone.trim(), role, gender: gender || null, acceptTerms }
      : { email: email.trim(), password, remember };

    try {
      const res = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ApiOk | ApiFail | null;

      if (!json || !json.ok) {
        if (res.status === 429) {
          const retry = Number(res.headers.get("Retry-After") || 0);
          setError(retry > 0 ? `Juda ko'p urinish. ${Math.ceil(retry / 60)} daqiqadan keyin qayta urinib ko'ring.` : (json?.error ?? "Juda ko'p urinish"));
        } else setError(json?.error ?? "Serverda kutilmagan xatolik");
        if (json && !json.ok && json.fields) {
          const { acceptTerms, ...rest } = json.fields;
          setFields(acceptTerms ? { ...rest, terms: acceptTerms } : rest);
        }
        setLoading(false);
        return;
      }

      if ("twoFactor" in json.data) {
        // Parol to'g'ri — endi autentifikator kodi (POST /api/auth/2fa/verify)
        setTicket(json.data.ticket);
        setOtp("");
        setRecoveryCode("");
        setUseRecovery(false);
        setLoading(false);
        return;
      }
      const dest = isRegister && json.data.role === "specialist" ? "/kabinet/profil?welcome=1" : target || "/kabinet";
      router.push(dest);
      router.refresh();
      // loading holatini sahifa almashguncha saqlaymiz
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
      setLoading(false);
    }
  };

  /** 2FA: ilova kodi yoki zaxira kodi bilan sessiyani olish */
  const verifySecond = async (codeOverride?: string) => {
    if (loading || !ticket) return;
    const value = useRecovery ? recoveryCode.trim() : (codeOverride ?? otp);
    if (useRecovery ? value.replace(/[^a-z0-9]/gi, "").length < 8 : !/^\d{6}$/.test(value)) {
      setFields({ otp: useRecovery ? "Zaxira kodini to'liq kiriting (masalan: abcd-efgh)" : "6 xonali kodni kiriting" });
      return;
    }
    setFields({});
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useRecovery ? { ticket, recoveryCode: value } : { ticket, code: value }),
      });
      const json = (await res.json().catch(() => null)) as ApiOk | ApiFail | null;
      if (!json || !json.ok || "twoFactor" in json.data) {
        if (res.status === 401) {
          // Chipta eskirgan — parol bosqichiga qaytamiz
          setTicket(null);
          setPassword("");
          setError(json && !json.ok ? json.error : "Kirish muddati tugadi. Qaytadan kiring");
        } else if (res.status === 429) {
          const retry = Number(res.headers.get("Retry-After") || 0);
          setError(retry > 0 ? `Juda ko'p urinish. ${Math.ceil(retry / 60)} daqiqadan keyin qayta urinib ko'ring.` : "Juda ko'p urinish");
        } else {
          const msg = json && !json.ok ? (json.fields?.code ?? json.fields?.recoveryCode ?? json.error) : "Serverda kutilmagan xatolik";
          setFields({ otp: msg });
          if (!useRecovery) setOtp("");
        }
        setLoading(false);
        return;
      }
      const left = json.data.recoveryLeft;
      // Zaxira kodlari kam qoldi — xavfsizlik sahifasida yangilash taklif qilinadi
      const dest = left != null && left <= 3 ? "/kabinet/xavfsizlik?zaxira=kam#ikki-bosqich" : target || "/kabinet";
      router.push(dest);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
      setLoading(false);
    }
  };

  const backToPassword = () => {
    setTicket(null);
    setOtp("");
    setRecoveryCode("");
    setFields({});
    setError(null);
  };

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setFields({});
    setError(null);
    setFilledDemo(acc.email);
  };

  if (ticket) {
    return (
      <div className="animate-fade-up">
        <header className="mb-6">
          <span className="eyebrow">
            <ShieldCheck size={13} className="text-accent" /> Ikki bosqichli himoya
          </span>
          <h1 className="display-xl mt-4 text-[30px] text-fg sm:text-[36px]">
            Kodni <span className="accent-serif text-accent">kiriting</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
            {useRecovery
              ? "Telefoningiz yonida bo'lmasa, 2FA yoqilganda saqlab olgan zaxira kodlaringizdan birini kiriting. Har bir kod bir marta ishlaydi."
              : "Autentifikator ilovasini (Google Authenticator, Microsoft Authenticator, 1Password…) oching va Redince uchun ko'rsatilgan 6 xonali kodni kiriting."}
          </p>
        </header>

        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verifySecond();
          }}
        >
          {useRecovery ? (
            <div>
              <label htmlFor="auth-otp" className="field-label">
                Zaxira kodi
              </label>
              <input
                id="auth-otp"
                name="recovery-code"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="abcd-efgh"
                value={recoveryCode}
                maxLength={20}
                onChange={(e) => {
                  setRecoveryCode(e.target.value);
                  clearField("otp");
                }}
                className={cn("field font-mono text-[18px] tracking-[0.12em]", fields.otp && "!border-ios-red/60")}
                aria-invalid={!!fields.otp}
                aria-describedby={fields.otp ? "auth-otp-error" : undefined}
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label htmlFor="auth-otp" className="field-label">
                Ilovadagi kod
              </label>
              <input
                id="auth-otp"
                name="one-time-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(v);
                  clearField("otp");
                  if (v.length === 6) void verifySecond(v);
                }}
                className={cn("field h-14 text-center font-mono text-[24px] tracking-[0.4em]", fields.otp && "!border-ios-red/60")}
                aria-invalid={!!fields.otp}
                aria-describedby={fields.otp ? "auth-otp-error" : "auth-otp-hint"}
                autoFocus
              />
              {!fields.otp && (
                <p id="auth-otp-hint" className="mt-1.5 text-[12px] text-fg-4">
                  Kod har 30 soniyada yangilanadi. 6 raqam terilishi bilan tekshiriladi.
                </p>
              )}
            </div>
          )}
          {fields.otp && (
            <p id="auth-otp-error" role="alert" className="field-error">
              {fields.otp}
            </p>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-[16px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
              <AlertCircle size={16} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Spinner /> Tekshirilmoqda…
              </>
            ) : (
              <>
                Tasdiqlash va kirish <ArrowRight size={18} />
              </>
            )}
          </Button>
        </form>

        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              setUseRecovery((v) => !v);
              setFields({});
              setError(null);
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-semibold text-accent-text transition hover:bg-accent-soft"
          >
            {useRecovery ? <Smartphone size={15} /> : <LifeBuoy size={15} />}
            {useRecovery ? "Ilova kodi bilan kirish" : "Tiklash kodi bilan kirish"}
          </button>
          <button
            type="button"
            onClick={backToPassword}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg"
          >
            <ArrowLeft size={15} /> Boshqa hisob bilan kirish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      {/* ---------- Sarlavha ---------- */}
      <header className="mb-6">
        <span className="eyebrow">{isRegister ? "Yangi hisob" : "Kirish"}</span>
        <h1 className="display-xl mt-4 text-[30px] text-fg sm:text-[36px]">
          {isRegister ? (
            <>
              Hisob <span className="accent-serif text-accent">yarating</span>
            </>
          ) : (
            <>
              Xush <span className="accent-serif text-accent">kelibsiz</span>
            </>
          )}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
          {isRegister ? "Bir daqiqa — va siz Redince'dasiz. Profilni keyin xohlagan payt to'ldirasiz." : "Hisobingizga kiring — kabinet va buyurtmalaringiz sizni kutmoqda."}
        </p>
      </header>

      {/* ---------- Kontekst: nega keldingiz (A23) ---------- */}
      {context && (
        <div className="card-outline mb-5 flex items-start gap-3 px-4 py-3" role="status">
          <span className="btn-ink flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]">
            <context.icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-fg">{context.title}</span>
            <span className="block text-[12px] leading-snug text-fg-3">{context.text}</span>
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* ---------- Rol tanlash (faqat ro'yxatdan o'tish) ---------- */}
        {isRegister && (
          <fieldset>
            <legend className="field-label">Kim sifatida qo'shilasiz?</legend>
            <div role="radiogroup" aria-label="Rol" className="grid grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setRole(opt.value);
                      clearField("role");
                    }}
                    className={cn(
                      "relative min-h-[112px] rounded-[20px] border p-4 text-left transition-all duration-300",
                      active ? "border-fg bg-surface shadow-[var(--shadow-1)]" : "border-line bg-surface-2 hover:border-line-2 dark:bg-surface",
                    )}
                  >
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-300", active ? "btn-ink" : "bg-fg/6 text-fg-2")}>
                      <Icon size={18} />
                    </span>
                    <span className="mt-3 block text-[15px] font-semibold leading-tight text-fg">{opt.title}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-fg-3">{opt.subtitle}</span>
                    <span
                      className={cn(
                        "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-ink-fg transition-all duration-300",
                        active ? "scale-100 opacity-100" : "scale-75 opacity-0",
                      )}
                      aria-hidden="true"
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
            {fields.role && <p className="field-error">{fields.role}</p>}
            <p className="mt-2 text-[12px] leading-snug text-fg-3">
              {role === "specialist"
                ? "Ro'yxatdan so'ng yo'nalish, hudud va narxlaringizni kiritasiz — profil xaritada ko'rinadi."
                : "Mutaxassislarni xaritadan toping, portfoliosini ko'ring va buyurtma bering."}
            </p>
          </fieldset>
        )}

        {/* ---------- Ism ---------- */}
        {isRegister && (
          <div>
            <label htmlFor="auth-name" className="field-label">
              Ism va familiya
            </label>
            <input
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Masalan: Aziz Karimov"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearField("name");
              }}
              className={cn("field", fields.name && "!border-ios-red/60")}
              aria-invalid={!!fields.name}
              aria-describedby={fields.name ? "auth-name-error" : undefined}
              maxLength={60}
            />
            {fields.name && (
              <p id="auth-name-error" className="field-error">
                {fields.name}
              </p>
            )}
          </div>
        )}

        {/* ---------- Email ---------- */}
        <div>
          <label htmlFor="auth-email" className="field-label">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="siz@misol.uz"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField("email");
              setFilledDemo(null);
            }}
            className={cn("field", fields.email && "!border-ios-red/60")}
            aria-invalid={!!fields.email}
            aria-describedby={fields.email ? "auth-email-error" : undefined}
          />
          {fields.email && (
            <p id="auth-email-error" className="field-error">
              {fields.email}
            </p>
          )}
        </div>

        {/* ---------- Parol ---------- */}
        <PasswordField
          id="auth-password"
          label="Parol"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearField("password");
          }}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={isRegister ? "Kamida 8 ta belgi, harf va raqam" : "Parolingiz"}
          error={fields.password}
          meter={isRegister}
          labelAside={
            !isRegister ? (
              <Link href="/auth/parol-tiklash" className={INLINE_LINK}>
                Parolni unutdingizmi?
              </Link>
            ) : undefined
          }
        />

        {/* ---------- Telefon + jins (ro'yxatdan o'tish) ---------- */}
        {isRegister && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="auth-phone" className="field-label">
                Telefon <span className="font-normal text-fg-4">(ixtiyoriy)</span>
              </label>
              <input
                id="auth-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearField("phone");
                }}
                className={cn("field", fields.phone && "!border-ios-red/60")}
                aria-invalid={!!fields.phone}
                aria-describedby={fields.phone ? "auth-phone-error" : undefined}
                maxLength={20}
              />
              {fields.phone && (
                <p id="auth-phone-error" className="field-error">
                  {fields.phone}
                </p>
              )}
            </div>
            <div>
              <span id="auth-gender-label" className="field-label">
                Jins <span className="font-normal text-fg-4">(ixtiyoriy)</span>
              </span>
              <div role="radiogroup" aria-labelledby="auth-gender-label" className="segment w-full">
                {([{ value: "", label: "Aytmayman" }, ...GENDERS] as { value: Gender; label: string }[]).map((g) => (
                  <button
                    key={g.value || "none"}
                    type="button"
                    role="radio"
                    aria-checked={gender === g.value}
                    data-active={gender === g.value}
                    onClick={() => setGender(g.value)}
                    className="segment-item min-h-[38px] flex-1 !px-2"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-fg-4">Ko'rinishini keyin maxfiylikdan boshqarasiz.</p>
            </div>
          </div>
        )}

        {/* ---------- Oferta va maxfiylik (ro'yxatdan o'tish — majburiy) ---------- */}
        {isRegister && (
          <div>
            <div className="flex items-start gap-3">
              <label htmlFor="auth-terms" className="flex min-h-11 shrink-0 cursor-pointer items-center">
                <input
                  id="auth-terms"
                  type="checkbox"
                  className="peer sr-only"
                  checked={acceptTerms}
                  onChange={(e) => {
                    setAcceptTerms(e.target.checked);
                    clearField("terms");
                  }}
                  aria-invalid={!!fields.terms}
                  aria-describedby={fields.terms ? "auth-terms-error" : undefined}
                  required
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                    acceptTerms ? "border-ink bg-ink text-ink-fg" : fields.terms ? "border-ios-red/70 bg-surface-2" : "border-line-2 bg-surface-2",
                  )}
                >
                  {acceptTerms && <Check size={13} strokeWidth={3} />}
                </span>
              </label>
              <p className="py-2.5 text-[14px] leading-snug text-fg-2">
                <label htmlFor="auth-terms" className="cursor-pointer">
                  Men
                </label>{" "}
                <Link href="/oferta" target="_blank" className="font-semibold text-accent-text underline underline-offset-2 hover:brightness-110">
                  Oferta
                </Link>{" "}
                <label htmlFor="auth-terms" className="cursor-pointer">
                  va
                </label>{" "}
                <Link href="/maxfiylik" target="_blank" className="font-semibold text-accent-text underline underline-offset-2 hover:brightness-110">
                  Maxfiylik siyosatiga
                </Link>{" "}
                <label htmlFor="auth-terms" className="cursor-pointer">
                  roziman
                </label>
              </p>
            </div>
            {fields.terms && (
              <p id="auth-terms-error" className="field-error">
                {fields.terms}
              </p>
            )}
          </div>
        )}

        {/* ---------- Meni eslab qolish (kirish) ---------- */}
        {!isRegister && (
          <label htmlFor="auth-remember" className="flex min-h-11 cursor-pointer select-none items-center gap-3 text-[14px] text-fg-2">
            <input id="auth-remember" type="checkbox" className="peer sr-only" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                remember ? "border-ink bg-ink text-ink-fg" : "border-line-2 bg-surface-2",
              )}
            >
              {remember && <Check size={13} strokeWidth={3} />}
            </span>
            <span>
              Meni eslab qolish <span className="text-fg-4">· 30 kun</span>
            </span>
          </label>
        )}

        {/* ---------- Umumiy xato ---------- */}
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[16px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red animate-fade-up" style={{ animationDuration: "0.3s" }}>
            <AlertCircle size={16} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ---------- Yuborish (bitta accent CTA) ---------- */}
        <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Spinner /> {isRegister ? "Hisob yaratilmoqda…" : "Kirilmoqda…"}
            </>
          ) : (
            <>
              {isRegister ? "Ro'yxatdan o'tish" : "Kirish"} <ArrowRight size={18} />
            </>
          )}
        </Button>

        {isRegister && role === "specialist" && subscription?.enforced && (
          <p className="text-center text-[12px] leading-snug text-fg-4">
            Mutaxassislar uchun {subscription.trialDays > 0 ? `dastlabki ${subscription.trialDays} kun bepul, keyin ` : ""}obuna — oyiga {formatPrice(subscription.price)}. Mijozlar uchun platforma bepul.
          </p>
        )}
      </form>

      {/* ---------- Sahifalar orasidagi havola ---------- */}
      <p className="mt-6 text-center text-[14px] text-fg-2">
        {isRegister ? "Hisobingiz bormi? " : "Hisob yo'qmi? "}
        <Link href={withNext(isRegister ? "/auth/kirish" : "/auth/royxat", target)} className={INLINE_LINK}>
          {isRegister ? "Kirish" : "Ro'yxatdan o'tish"}
        </Link>
      </p>

      {/* ---------- Demo hisoblar (faqat NEXT_PUBLIC_DEMO_ACCOUNTS=1) ---------- */}
      {DEMO_ENABLED &&
        (isRegister ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-fg-3">
            <Wand2 size={13} className="text-accent" />
            Sinab ko'rmoqchimisiz?{" "}
            <Link href="/auth/kirish" className={INLINE_LINK}>
              Demo hisob bilan kiring
            </Link>
          </p>
        ) : (
          <div className="card-outline mt-5 overflow-hidden">
            <button
              type="button"
              onClick={() => setDemoOpen((v) => !v)}
              aria-expanded={demoOpen}
              aria-controls="demo-accounts"
              className="flex min-h-12 w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-fg/4"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
                <KeyRound size={14} />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-fg">Demo hisoblar</span>
                <span className="block text-[11px] text-fg-3">Bu demo loyiha — bir bosishda to'ldiring</span>
              </span>
              <ChevronDown size={16} className={cn("text-fg-3 transition-transform duration-300", demoOpen && "rotate-180")} />
            </button>

            {demoOpen && (
              <ul id="demo-accounts" className="divide-y divide-line border-t border-line animate-fade-up" style={{ animationDuration: "0.3s" }}>
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  const filled = filledDemo === acc.email;
                  return (
                    <li key={acc.email} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="btn-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-fg">
                          {acc.label} <span className="font-normal text-fg-4">· {acc.hint}</span>
                        </span>
                        <span className="block truncate font-mono text-[11px] text-fg-3">
                          {acc.email} / {acc.password}
                        </span>
                      </span>
                      <Button type="button" size="sm" variant={filled ? "tint-soft" : "outline"} onClick={() => fillDemo(acc)} className="shrink-0 !h-9 !px-3 !text-[12px]">
                        {filled ? (
                          <>
                            <Check size={13} /> Tayyor
                          </>
                        ) : (
                          "To'ldirish"
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
}
