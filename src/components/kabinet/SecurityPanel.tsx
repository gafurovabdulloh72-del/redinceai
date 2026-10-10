"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Clock3, KeyRound, LogOut, Mail, MonitorSmartphone, Phone, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { PasswordField } from "@/components/auth/PasswordField";
import { Badge, Button, Spinner } from "@/components/ui";
import { passwordStrength } from "@/lib/security/password-strength";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export interface SecurityInitial {
  email: string;
  emailVerified: boolean;
  phone: string | null;
  /** ms */
  lastLoginAt: number | null;
  passwordChangedAt: number | null;
  createdAt: number;
  remember: boolean;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const TIPS = [
  { icon: KeyRound, title: "Parolni boshqa saytlarda takrorlamang", text: "Bitta sayt sizsa, hammasi xavf ostida qoladi. Parol menejeridan foydalaning." },
  { icon: ShieldAlert, title: "Shubhali havolalarga parol kiritmang", text: "Redince parolni faqat redince.uz manzilida so'raydi. Telegram/SMS orqali hech qachon so'ramaymiz." },
  { icon: MonitorSmartphone, title: "Umumiy qurilmada «Meni eslab qolish»ni o'chiring", text: "Shunda brauzer yopilishi bilan sessiya tugaydi." },
  { icon: Smartphone, title: "Begona faollik sezsangiz", text: "Parolni darhol o'zgartiring — barcha boshqa qurilmalar avtomatik chiqib ketadi." },
];

export function SecurityPanel({ initial }: { initial: SecurityInitial }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [confirmAll, setConfirmAll] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 6000);
    return () => window.clearTimeout(t);
  }, [saved]);
  useEffect(() => {
    if (!revoked) return;
    const t = window.setTimeout(() => setRevoked(false), 6000);
    return () => window.clearTimeout(t);
  }, [revoked]);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = "Joriy parolni kiriting";
    const s = passwordStrength(next);
    if (!s.valid) errs.newPassword = next.length < 8 ? "Parol kamida 8 ta belgi" : "Parolda harf ham, raqam ham bo'lsin";
    else if (next === current) errs.newPassword = "Yangi parol eskisidan farq qilsin";
    if (confirm !== next) errs.confirm = "Parollar mos kelmadi";
    if (Object.keys(errs).length) {
      setFields(errs);
      return;
    }
    setFields({});
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ changed: boolean }> | null;
      if (!json || !json.ok) {
        if (res.status === 429) {
          const retry = Number(res.headers.get("Retry-After") || 0);
          setError(retry > 0 ? `Juda ko'p urinish. ${Math.ceil(retry / 60)} daqiqadan keyin qayta urinib ko'ring.` : (json?.error ?? "Juda ko'p urinish"));
        } else setError(json?.error ?? "Serverda kutilmagan xatolik");
        if (json && !json.ok && json.fields) setFields(json.fields);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const logoutAll = async () => {
    if (revoking) return;
    setRevokeError(null);
    setRevoking(true);
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ revoked: boolean }> | null;
      if (!json || !json.ok) {
        setRevokeError(json?.error ?? "Serverda kutilmagan xatolik");
        return;
      }
      setConfirmAll(false);
      setRevoked(true);
      router.refresh();
    } catch {
      setRevokeError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setRevoking(false);
    }
  };

  const pwAge = initial.passwordChangedAt ?? initial.createdAt;
  const pwOld = Date.now() - pwAge > 180 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-5">
      {/* ---------- Holat ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Hisob holati">
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Clock3 size={14} /> Oxirgi kirish
          </div>
          <div className="mt-2 font-display text-[17px] font-semibold leading-tight text-fg">
            {initial.lastLoginAt ? (
              <time dateTime={new Date(initial.lastLoginAt).toISOString()} suppressHydrationWarning>
                {timeAgo(initial.lastLoginAt)}
              </time>
            ) : (
              "Hozir"
            )}
          </div>
          <div className="mt-1 text-[12px] text-fg-4">{initial.lastLoginAt ? formatDateTime(initial.lastLoginAt) : "Birinchi sessiya"}</div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <KeyRound size={14} /> Parol
          </div>
          <div className="mt-2 font-display text-[17px] font-semibold leading-tight text-fg" suppressHydrationWarning>
            {initial.passwordChangedAt ? `${timeAgo(initial.passwordChangedAt)} yangilangan` : "Hech o'zgarmagan"}
          </div>
          <div className="mt-1 text-[12px] text-fg-4">{pwOld ? "6 oydan oshdi — yangilash tavsiya etiladi" : "Yaqinda o'rnatilgan"}</div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Mail size={14} /> Email
          </div>
          <div className="mt-2 truncate text-[14px] font-semibold text-fg">{initial.email}</div>
          <div className="mt-2">
            {initial.emailVerified ? (
              <Badge tone="green">
                <ShieldCheck size={12} /> Tasdiqlangan
              </Badge>
            ) : (
              <Badge tone="orange">
                <AlertCircle size={12} /> Tasdiqlanmagan
              </Badge>
            )}
          </div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Phone size={14} /> Telefon
          </div>
          <div className="mt-2 truncate text-[14px] font-semibold text-fg">{initial.phone || "Kiritilmagan"}</div>
          <div className="mt-2">
            {initial.phone ? (
              <Badge tone="neutral">
                <Clock3 size={12} /> Tasdiq kutilmoqda
              </Badge>
            ) : (
              <Badge tone="neutral">Profilda qo'shing</Badge>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Parolni o'zgartirish ---------- */}
      <form onSubmit={changePassword} className="card p-5 sm:p-7" noValidate>
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">Parolni o'zgartirish</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">Yangi parol saqlangach, boshqa barcha qurilmalardagi sessiyalar yopiladi. Siz shu qurilmada qolasiz.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-sm">
            <PasswordField
              id="sec-current"
              name="current-password"
              label="Joriy parol"
              value={current}
              onChange={(v) => {
                setCurrent(v);
                setFields((f) => ({ ...f, currentPassword: "" }));
              }}
              autoComplete="current-password"
              placeholder="Hozirgi parolingiz"
              error={fields.currentPassword || undefined}
            />
          </div>
          <PasswordField
            id="sec-new"
            name="new-password"
            label="Yangi parol"
            value={next}
            onChange={(v) => {
              setNext(v);
              setFields((f) => ({ ...f, newPassword: "" }));
            }}
            autoComplete="new-password"
            placeholder="Kamida 8 ta belgi, harf va raqam"
            error={fields.newPassword || undefined}
            meter
          />
          <PasswordField
            id="sec-confirm"
            name="confirm-password"
            label="Yangi parolni takrorlang"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setFields((f) => ({ ...f, confirm: "" }));
            }}
            autoComplete="new-password"
            placeholder="Yana bir marta"
            error={fields.confirm || undefined}
          />
        </div>

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
            <AlertCircle size={16} className="mt-px shrink-0" /> {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px]" aria-live="polite">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803d] dark:text-ios-green">
                <CheckCircle2 size={15} /> Parol yangilandi — boshqa qurilmalar chiqib ketdi
              </span>
            ) : (
              <span className="text-fg-4">Parol hech qachon ochiq saqlanmaydi (bcrypt, 12 raund)</span>
            )}
          </div>
          <Button type="submit" variant="accent" disabled={busy} className="sm:min-w-[180px]">
            {busy ? <Spinner /> : "Parolni yangilash"}
          </Button>
        </div>
      </form>

      {/* ---------- Qurilmalar ---------- */}
      <section className="card p-5 sm:p-7" aria-labelledby="sec-devices">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <MonitorSmartphone size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sec-devices" className="font-display text-[20px] font-semibold tracking-tight text-fg">
              Qurilmalar va sessiyalar
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              Joriy sessiya: {initial.remember ? "«Meni eslab qolish» yoqilgan — 30 kun" : "brauzer yopilguncha"}. Telefon yoki begona kompyuterda kirgan bo'lsangiz, hammasini bir bosishda yoping.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px]" aria-live="polite">
            {revoked ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803d] dark:text-ios-green">
                <CheckCircle2 size={15} /> Boshqa qurilmalar chiqarildi. Siz shu yerda qolasiz.
              </span>
            ) : revokeError ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-ios-red">
                <AlertCircle size={15} /> {revokeError}
              </span>
            ) : confirmAll ? (
              <span className="font-medium text-fg">Ishonchingiz komilmi? Boshqa qurilmalarda qayta kirish kerak bo'ladi.</span>
            ) : (
              <span className="text-fg-4">Joriy qurilma ta'sirlanmaydi.</span>
            )}
          </div>
          <div className={cn("flex gap-2", confirmAll ? "flex-col-reverse sm:flex-row" : undefined)}>
            {confirmAll ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setConfirmAll(false)} disabled={revoking}>
                  Bekor qilish
                </Button>
                <Button type="button" variant="danger" onClick={logoutAll} disabled={revoking} className="sm:min-w-[200px]">
                  {revoking ? <Spinner /> : <LogOut size={15} />} Ha, hammasidan chiqish
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmAll(true)} className="sm:min-w-[260px]">
                <LogOut size={15} /> Barcha qurilmalardan chiqish
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Maslahatlar ---------- */}
      <section className="card-outline p-5 sm:p-7" aria-labelledby="sec-tips">
        <h2 id="sec-tips" className="eyebrow">
          Maslahatlar
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {TIPS.map((t) => (
            <li key={t.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                <t.icon size={16} />
              </span>
              <span>
                <span className="block text-[14px] font-semibold text-fg">{t.title}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{t.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
