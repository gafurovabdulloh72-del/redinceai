"use client";
import { TelegramLogin } from "./TelegramLogin";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ClipboardList, LifeBuoy, MessageSquareText, ShieldCheck, Smartphone, TimerReset, UserRound } from "lucide-react";
import { PasswordField } from "./PasswordField";
import { CraftStep, RoleStep, StepBar } from "./RegisterSteps";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Locale } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { passwordStrength } from "@/lib/security/password-strength";
import { cn, formatPrice, safeInternalPath } from "@/lib/utils";
import { inIframe } from "@/lib/telegram-webapp-client";

type Mode = "login" | "register";
type Role = "client" | "specialist";
/** Maqsad: rolga xaritalanadi va ro'yxatdan keyin qayerga olib borishni belgilaydi */
type Intent = "service" | "order" | "job" | "hire";

interface AuthFormProps {
  mode: Mode;
  /** Muvaffaqiyatdan so'ng qaytish manzili (faqat ichki yo'l) */
  next?: string;
  /** Ro'yxatdan o'tishda boshlang'ich rol */
  defaultRole?: Role;
  /** Boshlang'ich maqsad (?intent=) — rolni belgilaydi va ro'yxatdan keyingi manzilni tanlaydi */
  defaultIntent?: Intent;
  /** ?role= yoki ?intent= aniq berilgan — rol tanlash qadami o'tkazib yuboriladi */
  skipRole?: boolean;
  /** Nega kirish so'ralmoqda: ?reason=review|order|expired (A23) */
  reason?: string;
  /** Mutaxassis obunasi (admin sozlamasi) — ro'yxatdan o'tishda eslatma uchun */
  subscription?: { price: number; trialDays: number; enforced: boolean };
  /** «Google bilan kirish» yoqilganmi (server env: GOOGLE_CLIENT_ID/SECRET) */
  googleEnabled?: boolean;
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

/** ?intent= (eski havolalar): ro'yxatdan keyin qayerga olib borish. Rol: service → mutaxassis, qolganlari → mijoz */
const INTENT_DEST: Record<Intent, string | null> = { service: null, order: null, job: "/kabinet/rezyume?welcome=1", hire: "/vakansiyalar/yangi" };

/** Matn ichidagi havola uchun 40px bosish maydoni — ko'rinishi o'zgarmaydi (manfiy margin qatorni kengaytirmaydi) */
const INLINE_LINK = "inline-flex min-h-10 items-center -my-2 -mx-1 px-1 font-semibold text-accent-text transition hover:brightness-110";

const FIELD_ORDER = ["name", "email", "password", "terms"] as const;

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** Kontekstli xabar: foydalanuvchi qayerdan va nega keldi */
function contextFor(til: Locale, mode: Mode, next?: string, reason?: string): { icon: typeof ClipboardList; title: string; text: string } | null {
  const verb = tr(til, mode === "register" ? AUTH.context.verbRegister : AUTH.context.verbLogin);
  if (reason === "expired") return { icon: TimerReset, title: tr(til, AUTH.context.expiredTitle), text: tr(til, AUTH.context.expiredText) };
  if (reason === "review" || next?.includes("#sharh")) return { icon: MessageSquareText, title: AUTH.context.reviewTitle[til](verb), text: tr(til, AUTH.context.reviewText) };
  if (!next) return null;
  if (next.startsWith("/buyurtma")) return { icon: ClipboardList, title: AUTH.context.orderTitle[til](verb), text: tr(til, AUTH.context.orderText) };
  if (next.startsWith("/mutaxassislar/")) return { icon: MessageSquareText, title: AUTH.context.specialistTitle[til](verb), text: tr(til, AUTH.context.specialistText) };
  if (next.startsWith("/admin")) return { icon: ShieldCheck, title: tr(til, AUTH.context.adminTitle), text: tr(til, AUTH.context.adminText) };
  if (next.startsWith("/kabinet")) return { icon: UserRound, title: AUTH.context.cabinetTitle[til](verb), text: tr(til, AUTH.context.cabinetText) };
  return null;
}

export function AuthForm({ mode, next, defaultRole = "client", defaultIntent, skipRole = false, reason, subscription, googleEnabled }: AuthFormProps) {
  const til = useLocale();
  const router = useRouter();
  const isRegister = mode === "register";
  const target = safeInternalPath(next);
  const googleReason =
    reason === "google_off" ? tr(til, AUTH.google.off)
    : reason === "google_cancel" ? tr(til, AUTH.google.cancel)
    : reason === "google_unverified" ? tr(til, AUTH.google.unverified)
    : reason === "google_err" ? tr(til, AUTH.google.error)
    : null;
  const context = contextFor(til, mode, target, reason);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Ro'yxatdan o'tish bosqichlari: rol → (mutaxassis) kasb/tajriba/hudud → hisob ma'lumotlari
  const initialRole: Role = defaultIntent ? (defaultIntent === "service" ? "specialist" : "client") : defaultRole;
  const [role, setRole] = useState<Role>(initialRole);
  /** Rol kartasi faqat foydalanuvchi bosgandan keyin «tanlangan» ko'rinadi (boshida hech biri belgilanmagan) */
  const [rolePicked, setRolePicked] = useState(false);
  const [stage, setStage] = useState<"role" | "craft" | "account">(!isRegister || !skipRole ? "role" : initialRole === "specialist" ? "craft" : "account");
  const [dir, setDir] = useState<1 | -1>(1);
  const [category, setCategory] = useState<string | null>(null);
  const [experience, setExperience] = useState("middle");
  const [region, setRegion] = useState("");
  const [craftError, setCraftError] = useState<string | null>(null);
  /** Muvaffaqiyatli kirish/ro'yxat: qisqa «xush kelibsiz» animatsiyasi, keyin yo'naltirish */
  const [welcome, setWelcome] = useState<string | null>(null);
  const goStage = (next: "role" | "craft" | "account") => {
    setDir(next === "role" || (next === "craft" && stage === "account") ? -1 : 1);
    setStage(next);
  };
  const totalSteps = role === "specialist" ? 3 : 2;
  const stepNo = stage === "role" ? 1 : stage === "craft" ? 2 : totalSteps;
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  /** Oferta va maxfiylik siyosatiga rozilik (ro'yxatdan o'tish — majburiy) */
  const [acceptTerms, setAcceptTerms] = useState(false);
  /** 2FA ikkinchi bosqichi: parol to'g'ri, ilova kodi kutilmoqda */
  const [ticket, setTicket] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  // Google / Telegram orqali kirish: 2FA yoqilgan bo'lsa server chiptani URL fragmentida beradi (#t2=…) —
  // fragment serverga, logga va Referer'ga ketmaydi. O'qiladi va manzildan darhol olib tashlanadi.
  useEffect(() => {
    const pick = () => {
      const m = /(?:^#|&)t2=([A-Za-z0-9._-]{20,2000})/.exec(window.location.hash);
      if (!m) return;
      setTicket(m[1]);
      setError(null);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, []);

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
    if (isRegister && name.trim().length < 2) errs.name = tr(til, AUTH.errors.nameShort);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = tr(til, AUTH.errors.emailInvalid);
    if (isRegister) {
      const s = passwordStrength(password);
      if (!s.valid) errs.password = tr(til, password.length < 8 ? AUTH.errors.passwordShort : AUTH.errors.passwordWeak);
    } else if (!password) errs.password = tr(til, AUTH.errors.passwordRequired);
    if (isRegister && !acceptTerms) errs.terms = tr(til, AUTH.errors.termsRequired);
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
      ? { name: name.trim(), email: email.trim(), password, phone: "", role, gender: null, acceptTerms }
      : { email: email.trim(), password, remember, embedded: inIframe() }; // iframe (Telegram Web) — bo'lakli sessiya cookie'si

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
          setError(retry > 0 ? AUTH.errors.tooManyRetry[til](Math.ceil(retry / 60)) : (json?.error ?? tr(til, AUTH.errors.tooMany)));
        } else setError(json?.error ?? tr(til, AUTH.errors.server));
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
      // Ro'yxatdan keyin: mutaxassis — profil (kasb/tajriba/hudud oldindan to'ldirilgan); ?intent=job/hire — rezyume/vakansiya; mijoz — kelgan joyi yoki kabinet
      const intentDest = isRegister && defaultIntent ? INTENT_DEST[defaultIntent] : null;
      const prefill = new URLSearchParams({ welcome: "1" });
      if (category) prefill.set("category", category);
      if (experience) prefill.set("experience", experience);
      if (region) prefill.set("region", region);
      const dest = isRegister && json.data.role === "specialist" ? `/kabinet/profil?${prefill.toString()}` : intentDest && !target ? intentDest : target || intentDest || "/kabinet";
      // Qisqa «xush kelibsiz» lahzasi (belgi chizilishi) — keyin yo'naltiramiz; loading holati sahifa almashguncha saqlanadi
      setWelcome(json.data.name);
      window.setTimeout(() => {
        router.push(dest);
        router.refresh();
      }, 800);
    } catch {
      setError(tr(til, AUTH.errors.network));
      setLoading(false);
    }
  };

  /** 2FA: ilova kodi yoki zaxira kodi bilan sessiyani olish */
  const verifySecond = async (codeOverride?: string) => {
    if (loading || !ticket) return;
    const value = useRecovery ? recoveryCode.trim() : (codeOverride ?? otp);
    if (useRecovery ? value.replace(/[^a-z0-9]/gi, "").length < 8 : !/^\d{6}$/.test(value)) {
      setFields({ otp: tr(til, useRecovery ? AUTH.twoFactor.errRecovery : AUTH.twoFactor.errOtp) });
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
          setError(json && !json.ok ? json.error : tr(til, AUTH.twoFactor.expired));
        } else if (res.status === 429) {
          const retry = Number(res.headers.get("Retry-After") || 0);
          setError(retry > 0 ? AUTH.errors.tooManyRetry[til](Math.ceil(retry / 60)) : tr(til, AUTH.errors.tooMany));
        } else {
          const msg = json && !json.ok ? (json.fields?.code ?? json.fields?.recoveryCode ?? json.error) : tr(til, AUTH.errors.server);
          setFields({ otp: msg });
          if (!useRecovery) setOtp("");
        }
        setLoading(false);
        return;
      }
      const left = json.data.recoveryLeft;
      // Zaxira kodlari kam qoldi — xavfsizlik sahifasida yangilash taklif qilinadi
      const dest = left != null && left <= 3 ? "/kabinet/xavfsizlik?zaxira=kam#ikki-bosqich" : target || "/kabinet";
      // To'liq sahifa o'tishi: yangi sessiya cookie bilan server qayta chizadi. router.push mehmon holatida oldindan
      // yuklangan (prefetch) «kirishga yo'naltirish» javobini qayta ishlatib, shu sahifada «Tekshirilmoqda…» bilan qotib qolardi
      window.location.assign(dest);
    } catch {
      setError(tr(til, AUTH.errors.network));
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

  if (ticket) {
    return (
      <div className="animate-fade-up">
        <header className="mb-6">
          <span className="eyebrow">
            <ShieldCheck size={13} className="text-accent" /> {tr(til, AUTH.twoFactor.eyebrow)}
          </span>
          <h1 className="display-xl mt-4 text-[30px] text-fg sm:text-[36px]">
            {tr(til, AUTH.twoFactor.titleA)}
            <span className="accent-serif text-accent">{tr(til, AUTH.twoFactor.titleAccent)}</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{tr(til, useRecovery ? AUTH.twoFactor.leadRecovery : AUTH.twoFactor.leadOtp)}</p>
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
                {tr(til, AUTH.twoFactor.recoveryLabel)}
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
                {tr(til, AUTH.twoFactor.otpLabel)}
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
                  {tr(til, AUTH.twoFactor.otpHint)}
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
            <div role="alert" className="expand-in flex items-start gap-2.5 rounded-[14px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
              <AlertCircle size={16} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Spinner /> {tr(til, AUTH.twoFactor.checking)}
              </>
            ) : (
              <>
                {tr(til, AUTH.twoFactor.confirm)} <ArrowRight size={18} />
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
            {tr(til, useRecovery ? AUTH.twoFactor.useOtp : AUTH.twoFactor.useRecovery)}
          </button>
          <button
            type="button"
            onClick={backToPassword}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg"
          >
            <ArrowLeft size={15} /> {tr(til, AUTH.twoFactor.otherAccount)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up relative">
      {/* ---------- Muvaffaqiyat lahzasi: belgi chiziladi, keyin yo'naltiriladi ---------- */}
      {welcome && (
        <div role="status" className="animate-fade-in absolute -inset-3 z-20 flex flex-col items-center justify-center gap-4 rounded-[20px] bg-surface/95 text-center backdrop-blur-sm sm:-inset-5">
          <span className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-[image:var(--brand-grad)] text-white shadow-[0_16px_40px_-12px_var(--accent)]">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" className="animate-check-draw" />
            </svg>
          </span>
          <p className="display-xl animate-fade-up text-[26px] text-fg" style={{ animationDelay: "120ms" }}>
            {welcome.split(" ")[0]}
          </p>
        </div>
      )}
      {/* ---------- Sarlavha ---------- */}
      {isRegister && <StepBar step={stepNo} total={totalSteps} onBack={stage === "role" ? undefined : () => goStage(stage === "account" && role === "specialist" ? "craft" : "role")} />}
      <header className="mb-6 short:mb-4 tiny:mb-3">
        <h1 key={`${mode}-${stage}`} className="animate-swap font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[32px] short:!text-[26px]">
          {isRegister ? (stage === "role" ? tr(til, AUTH.reg.whoTitle) : stage === "craft" ? tr(til, AUTH.reg.craftTitle) : tr(til, AUTH.reg.accountTitle)) : tr(til, AUTH.form.titleLoginA) + tr(til, AUTH.form.titleLoginAccent)}
        </h1>
        <p className="mt-2 text-[14.5px] leading-snug text-fg-3 tiny:hidden">
          {isRegister ? tr(til, stage === "role" ? AUTH.reg.whoLead : stage === "craft" ? AUTH.reg.craftLead : AUTH.reg.accountLead) : tr(til, AUTH.form.leadLogin)}
        </p>
      </header>

      {/* ---------- Kontekst: nega keldingiz (A23) ---------- */}
      {context && (
        <div className="card-outline mb-4 flex items-start gap-3 px-4 py-2.5" role="status">
          <span className="btn-ink flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]">
            <context.icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-fg">{context.title}</span>
            <span className="block text-[12px] leading-snug text-fg-3 short:hidden">{context.text}</span>
          </span>
        </div>
      )}

      {googleReason && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-[14px] border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {googleReason}
        </p>
      )}
      {/* ---------- Ro'yxatdan o'tish: 1-qadam (rol) va 2-qadam (mutaxassis kasbi) ---------- */}
      {isRegister && stage === "role" && (
        <div key="role" className={dir === 1 ? "animate-slide-left" : "animate-slide-right"}>
          <RoleStep
            role={rolePicked ? role : null}
            onPick={(r) => {
              setRole(r);
              setRolePicked(true);
              window.setTimeout(() => goStage(r === "specialist" ? "craft" : "account"), 180);
            }}
          />
        </div>
      )}
      {isRegister && stage === "craft" && (
        <div key="craft" className={dir === 1 ? "animate-slide-left" : "animate-slide-right"}>
          <CraftStep
            category={category}
            onCategory={(c) => {
              setCategory(c);
              setCraftError(null);
            }}
            experience={experience}
            onExperience={setExperience}
            region={region}
            onRegion={setRegion}
            error={craftError}
            onNext={() => {
              if (!category) {
                setCraftError(tr(til, AUTH.reg.pickCraft));
                return;
              }
              goStage("account");
            }}
          />
        </div>
      )}

      {(!isRegister || stage === "account") && (
      <form key={isRegister ? "account" : "login"} onSubmit={onSubmit} noValidate className={cn("stagger space-y-3.5 short:space-y-3 tiny:space-y-2", isRegister && (dir === 1 ? "animate-slide-left" : "animate-slide-right"))}>
        {/* ---------- Ism ---------- */}
        {isRegister && (
          <div>
            <label htmlFor="auth-name" className="field-label">
              {tr(til, AUTH.fields.name)}
            </label>
            <input
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder={tr(til, AUTH.fields.namePlaceholder)}
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!isRegister}
            placeholder={tr(til, AUTH.fields.emailPlaceholder)}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField("email");
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
          label={tr(til, AUTH.fields.password)}
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearField("password");
          }}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={tr(til, isRegister ? AUTH.fields.passwordPlaceholderNew : AUTH.fields.passwordPlaceholderCurrent)}
          error={fields.password}
          meter={isRegister}
          labelAside={
            !isRegister ? (
              <Link href="/auth/parol-tiklash" className={INLINE_LINK}>
                {tr(til, AUTH.fields.forgotPassword)}
              </Link>
            ) : undefined
          }
        />

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
              <p className="py-1.5 text-[13px] leading-snug text-fg-2 sm:py-2.5 sm:text-[14px] short:!py-1 short:!text-[12.5px]">
                <label htmlFor="auth-terms" className="cursor-pointer">
                  {tr(til, AUTH.fields.termsI)}
                </label>{" "}
                <Link href="/oferta" target="_blank" className="font-semibold text-accent-text underline underline-offset-2 hover:brightness-110">
                  {tr(til, AUTH.fields.termsOffer)}
                </Link>{" "}
                <label htmlFor="auth-terms" className="cursor-pointer">
                  {tr(til, AUTH.fields.termsAnd)}
                </label>{" "}
                <Link href="/maxfiylik" target="_blank" className="font-semibold text-accent-text underline underline-offset-2 hover:brightness-110">
                  {tr(til, AUTH.fields.termsPrivacy)}
                </Link>
                {tr(til, AUTH.fields.termsAgree) && (
                  <>
                    {" "}
                    <label htmlFor="auth-terms" className="cursor-pointer">
                      {tr(til, AUTH.fields.termsAgree)}
                    </label>
                  </>
                )}
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
          <label htmlFor="auth-remember" className="flex min-h-11 cursor-pointer short:min-h-9 select-none items-center gap-3 text-[14px] text-fg-2">
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
              {tr(til, AUTH.fields.remember)} <span className="text-fg-4">{tr(til, AUTH.fields.rememberDays)}</span>
            </span>
          </label>
        )}

        {/* ---------- Umumiy xato ---------- */}
        {error && (
          <div role="alert" className="expand-in flex items-start gap-2.5 rounded-[14px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
            <AlertCircle size={16} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ---------- Yuborish (bitta accent CTA) ---------- */}
        <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Spinner /> {tr(til, isRegister ? AUTH.submit.registering : AUTH.submit.loggingIn)}
            </>
          ) : (
            <>
              {tr(til, isRegister ? AUTH.submit.register : AUTH.submit.login)} <ArrowRight size={18} />
            </>
          )}
        </Button>

        {isRegister && role === "specialist" && subscription?.enforced && (
          <p className="text-center text-[12px] leading-snug text-fg-4 short:hidden">{AUTH.submit.subscriptionNote[til](subscription.trialDays, formatPrice(subscription.price))}</p>
        )}
      </form>
      )}

      {googleEnabled && (!isRegister || stage === "role") && (
        <>
          <div className="my-3 flex items-center gap-3 short:my-2" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-fg-4">{tr(til, AUTH.google.divider)}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <a href={withNext("/api/auth/google", target)} className="press hover-lift flex h-11 w-full items-center justify-center gap-2.5 rounded-[14px] border border-line-2 bg-surface text-[14.5px] font-semibold text-fg transition hover:border-fg">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
            {tr(til, AUTH.google.button)}
          </a>
        </>
      )}

      {/* Telegram bilan kirish — bot orqali (kalitlar bo'lmasa komponent hech narsa chizmaydi) */}
      {(!isRegister || stage === "role") && (
        <div className={googleEnabled ? "mt-2.5 short:mt-2" : "mt-3 short:mt-2"}>
          <TelegramLogin next={target} />
        </div>
      )}

      {/* ---------- Sahifalar orasidagi havola ---------- */}
      <p className="mt-4 text-center text-[14px] text-fg-2 short:mt-2">
        {tr(til, isRegister ? AUTH.submit.haveAccount : AUTH.submit.noAccount)}
        <Link href={withNext(isRegister ? "/auth/kirish" : "/auth/royxat", target)} className={INLINE_LINK}>
          {tr(til, isRegister ? AUTH.submit.toLogin : AUTH.submit.toRegister)}
        </Link>
      </p>

    </div>
  );
}
