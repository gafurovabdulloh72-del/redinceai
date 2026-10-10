"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Clapperboard,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Wand2,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
type Role = "client" | "specialist";

interface AuthFormProps {
  mode: Mode;
  /** Muvaffaqiyatdan so'ng qaytish manzili (faqat ichki yo'l) */
  next?: string;
  /** Ro'yxatdan o'tishda boshlang'ich rol */
  defaultRole?: Role;
}

interface ApiOk {
  ok: true;
  data: { id: string; name: string; role: "client" | "specialist" | "admin" };
}
interface ApiFail {
  ok: false;
  error: string;
  fields?: Record<string, string>;
}

const ROLE_OPTIONS: { value: Role; title: string; subtitle: string; icon: typeof Search; accent: string }[] = [
  { value: "client", title: "Mijozman", subtitle: "Mutaxassis qidiryapman", icon: Search, accent: "text-ios-blue" },
  { value: "specialist", title: "Mutaxassisman", subtitle: "Buyurtma olmoqchiman", icon: Clapperboard, accent: "text-ios-purple" },
];

const DEMO_ACCOUNTS: { label: string; hint: string; email: string; password: string; icon: typeof UserRound; tone: string }[] = [
  { label: "Mutaxassis", hint: "Profil, portfolio, buyurtmalar", email: "mutaxassis@redince.uz", password: "demo12345", icon: Clapperboard, tone: "text-ios-purple" },
  { label: "Mijoz", hint: "Qidiruv va buyurtma berish", email: "mijoz@redince.uz", password: "demo12345", icon: UserRound, tone: "text-ios-blue" },
  { label: "Admin", hint: "Boshqaruv paneli", email: "admin@redince.uz", password: "admin12345", icon: ShieldCheck, tone: "text-ios-orange" },
];

/** Faqat ichki yo'llarga ruxsat (ochiq redirectdan himoya) */
function safeNext(next?: string) {
  if (!next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function AuthForm({ mode, next, defaultRole = "client" }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const target = safeNext(next);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>(defaultRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [demoOpen, setDemoOpen] = useState(false);
  const [filledDemo, setFilledDemo] = useState<string | null>(null);

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
    if (isRegister ? password.length < 6 : password.length < 1) errs.password = isRegister ? "Parol kamida 6 ta belgi" : "Parolni kiriting";
    if (isRegister && phone.trim() && !/^\+?[\d\s()-]{9,16}$/.test(phone.trim())) errs.phone = "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)";
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
      ? { name: name.trim(), email: email.trim(), password, phone: phone.trim(), role }
      : { email: email.trim(), password };

    try {
      const res = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ApiOk | ApiFail | null;

      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        if (json && !json.ok && json.fields) setFields(json.fields);
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

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setFields({});
    setError(null);
    setFilledDemo(acc.email);
  };

  return (
    <div className="animate-fade-up">
      {/* ---------- Sarlavha ---------- */}
      <div className="mb-6">
        <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
          {isRegister ? <UserPlus size={12} /> : <LogIn size={12} />}
          {isRegister ? "Yangi hisob" : "Kirish"}
        </span>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-tight text-fg sm:text-[32px]">
          {isRegister ? "Hisob yarating" : "Xush kelibsiz!"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
          {isRegister ? "Bir daqiqa — va siz Redince'dasiz. Keyin profilni xohlagan payt to'ldirasiz." : "Hisobingizga kiring — kabinet va buyurtmalaringiz sizni kutmoqda."}
        </p>
      </div>

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
                      "relative !rounded-[22px] p-4 text-left transition-all duration-300",
                      active ? "glass-strong ring-2 ring-tint/45" : "glass glass-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-[14px] transition-colors duration-300",
                        active ? "glass-tint" : cn("bg-fg/6", opt.accent),
                      )}
                    >
                      <Icon size={20} />
                    </span>
                    <span className="mt-3 block text-[15px] font-semibold leading-tight text-fg">{opt.title}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-fg-3">{opt.subtitle}</span>
                    <span
                      className={cn(
                        "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300",
                        active ? "glass-tint scale-100 opacity-100" : "scale-75 opacity-0",
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
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-fg-3">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-tint" />
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
              className={cn("field", fields.name && "!border-ios-red/50")}
              aria-invalid={!!fields.name}
              maxLength={60}
            />
            {fields.name && <p className="field-error">{fields.name}</p>}
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
            className={cn("field", fields.email && "!border-ios-red/50")}
            aria-invalid={!!fields.email}
          />
          {fields.email && <p className="field-error">{fields.email}</p>}
        </div>

        {/* ---------- Parol ---------- */}
        <div>
          <label htmlFor="auth-password" className="field-label">
            Parol
          </label>
          <div className="relative">
            <input
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder={isRegister ? "Kamida 6 ta belgi" : "Parolingiz"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearField("password");
              }}
              className={cn("field !pr-12", fields.password && "!border-ios-red/50")}
              aria-invalid={!!fields.password}
              maxLength={100}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
              aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fields.password && <p className="field-error">{fields.password}</p>}
        </div>

        {/* ---------- Telefon (ixtiyoriy) ---------- */}
        {isRegister && (
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
              className={cn("field", fields.phone && "!border-ios-red/50")}
              aria-invalid={!!fields.phone}
              maxLength={20}
            />
            {fields.phone && <p className="field-error">{fields.phone}</p>}
          </div>
        )}

        {/* ---------- Umumiy xato ---------- */}
        {error && (
          <div
            role="alert"
            className="glass-weak flex items-start gap-2.5 !rounded-[18px] px-4 py-3 text-[13px] font-medium text-ios-red animate-fade-up"
            style={{ animationDuration: "0.3s" }}
          >
            <AlertCircle size={16} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ---------- Yuborish ---------- */}
        <Button type="submit" size="lg" disabled={loading} className="w-full !h-12">
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

        {isRegister && (
          <p className="text-center text-[12px] leading-snug text-fg-4">Davom etish orqali siz platformadan foydalanish shartlariga rozilik bildirasiz.</p>
        )}
      </form>

      {/* ---------- Sahifalar orasidagi havola ---------- */}
      <p className="mt-6 text-center text-[14px] text-fg-2">
        {isRegister ? "Hisobingiz bormi? " : "Hisob yo'qmi? "}
        <Link href={withNext(isRegister ? "/auth/kirish" : "/auth/royxat", target)} className="font-semibold text-tint transition hover:brightness-110">
          {isRegister ? "Kirish" : "Ro'yxatdan o'tish"}
        </Link>
      </p>

      {/* ---------- Demo hisoblar ---------- */}
      {isRegister ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-fg-3">
          <Wand2 size={13} className="text-tint" />
          Sinab ko'rmoqchimisiz?{" "}
          <Link href="/auth/kirish" className="font-semibold text-tint">
            Demo hisob bilan kiring
          </Link>
        </p>
      ) : (
        <div className="glass-weak mt-5 overflow-hidden !rounded-[18px]">
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            aria-expanded={demoOpen}
            aria-controls="demo-accounts"
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-fg/4"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tint-soft text-tint">
              <KeyRound size={14} />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-fg">Demo hisoblar</span>
              <span className="block text-[11px] text-fg-3">Bu demo loyiha — bir bosishda to'ldiring</span>
            </span>
            <ChevronDown size={16} className={cn("text-fg-3 transition-transform duration-300", demoOpen && "rotate-180")} />
          </button>

          {demoOpen && (
            <ul id="demo-accounts" className="divide-y divide-hairline border-t border-hairline animate-fade-up" style={{ animationDuration: "0.3s" }}>
              {DEMO_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const filled = filledDemo === acc.email;
                return (
                  <li key={acc.email} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-fg/6", acc.tone)}>
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
                    <Button type="button" size="sm" variant={filled ? "tint-soft" : "glass"} onClick={() => fillDemo(acc)} className="shrink-0 !h-8 !px-3 !text-[12px]">
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
      )}
    </div>
  );
}
