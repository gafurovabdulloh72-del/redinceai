"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Clock3, Download, KeyRound, LogOut, Mail, MailCheck, MonitorSmartphone, Phone, ShieldAlert, ShieldCheck, Smartphone, Trash2, TriangleAlert } from "lucide-react";
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

  // Email tasdiqlash
  const [verified, setVerified] = useState(initial.emailVerified);
  const [codeSent, setCodeSent] = useState<{ sent: boolean; expiresAt: number } | null>(null);
  const [code, setCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState<"send" | "confirm" | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState(false);

  // Xavfli zona
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

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

  useEffect(() => {
    if (!exported) return;
    const t = window.setTimeout(() => setExported(false), 6000);
    return () => window.clearTimeout(t);
  }, [exported]);

  const errorText = (res: Response, json: ApiResponse<unknown> | null, fallback = "Serverda kutilmagan xatolik") => {
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") || 0);
      return retry > 0 ? `Juda ko'p urinish. ${Math.ceil(retry / 60)} daqiqadan keyin qayta urinib ko'ring.` : (json && !json.ok && json.error) || "Juda ko'p urinish";
    }
    return (json && !json.ok && json.error) || fallback;
  };

  const sendCode = async () => {
    if (verifyBusy) return;
    setVerifyError(null);
    setVerifyBusy("send");
    try {
      const res = await fetch("/api/auth/verify/request", { method: "POST" });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ sent: boolean; expiresAt: number }> | null;
      if (!json || !json.ok) {
        if (res.status === 409) {
          setVerified(true);
          return;
        }
        setVerifyError(errorText(res, json));
        return;
      }
      setCode("");
      setCodeSent({ sent: json.data.sent, expiresAt: json.data.expiresAt });
    } catch {
      setVerifyError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setVerifyBusy(null);
    }
  };

  const confirmCode = async (e: FormEvent) => {
    e.preventDefault();
    if (verifyBusy) return;
    if (!/^\d{6}$/.test(code)) {
      setVerifyError("6 xonali kodni kiriting");
      return;
    }
    setVerifyError(null);
    setVerifyBusy("confirm");
    try {
      const res = await fetch("/api/auth/verify/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ verified: boolean }> | null;
      if (!json || !json.ok) {
        setVerifyError(errorText(res, json));
        return;
      }
      setVerified(true);
      setJustVerified(true);
      setCodeSent(null);
      router.refresh();
    } catch {
      setVerifyError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setVerifyBusy(null);
    }
  };

  const exportData = async () => {
    if (exporting) return;
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        setExportError(errorText(res, json, "Eksport qilib bo'lmadi"));
        return;
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "redince-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExported(true);
    } catch {
      setExportError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (deleting) return;
    if (!deletePassword) {
      setDeleteError("Tasdiqlash uchun parolni kiriting");
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ deleted: boolean }> | null;
      if (!json || !json.ok) {
        setDeleteError(errorText(res, json, "O'chirib bo'lmadi"));
        return;
      }
      setDeleted(true);
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1800);
    } catch {
      setDeleteError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setDeleting(false);
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
          <div className="mt-2 font-display text-[17px] font-semibold leading-tight text-fg">
            {initial.passwordChangedAt ? (
              <>
                <time dateTime={new Date(initial.passwordChangedAt).toISOString()} suppressHydrationWarning>
                  {timeAgo(initial.passwordChangedAt)}
                </time>{" "}
                yangilangan
              </>
            ) : (
              "Hech o'zgarmagan"
            )}
          </div>
          <div className="mt-1 text-[12px] text-fg-4">{pwOld ? "6 oydan oshdi — yangilash tavsiya etiladi" : "Yaqinda o'rnatilgan"}</div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Mail size={14} /> Email
          </div>
          <div className="mt-2 truncate text-[14px] font-semibold text-fg">{initial.email}</div>
          <div className="mt-2">
            {verified ? (
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

      {/* ---------- Emailni tasdiqlash ---------- */}
      {(!verified || justVerified) && (
        <section className="card p-5 sm:p-7" aria-labelledby="sec-verify">
          <div className="flex items-start gap-3">
            <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
              <MailCheck size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="sec-verify" className="font-display text-[20px] font-semibold tracking-tight text-fg">
                Emailni tasdiqlash
              </h2>
              <p className="mt-0.5 text-[13px] text-fg-3">
                Tasdiqlangan email — parolni tiklash va muhim bildirishnomalar uchun. 6 xonali kod <span className="font-semibold text-fg-2">{initial.email}</span> manziliga yuboriladi.
              </p>
            </div>
          </div>

          {justVerified ? (
            <div role="status" className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={16} className="mt-px shrink-0" /> Email tasdiqlandi. Rahmat!
            </div>
          ) : codeSent ? (
            <form onSubmit={confirmCode} noValidate className="mt-5 border-t border-line pt-5">
              <p className="text-[13px] text-fg-2">
                {codeSent.sent ? "Kod yuborildi — pochtangizni tekshiring (spam papkasini ham)." : "Pochta xizmati sozlanmagan: kod server konsolida (dev rejimi)."}{" "}
                <span className="text-fg-4">
                  Kod{" "}
                  <time dateTime={new Date(codeSent.expiresAt).toISOString()} suppressHydrationWarning>
                    {formatDateTime(codeSent.expiresAt)}
                  </time>{" "}
                  gacha amal qiladi.
                </span>
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-56">
                  <label htmlFor="sec-code" className="field-label">
                    Tasdiqlash kodi
                  </label>
                  <input
                    id="sec-code"
                    name="one-time-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setVerifyError(null);
                    }}
                    className={cn("field font-mono text-[18px] tracking-[0.3em]", verifyError && "!border-ios-red/60")}
                    aria-invalid={!!verifyError}
                    aria-describedby={verifyError ? "sec-code-error" : undefined}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" variant="accent" disabled={verifyBusy !== null} className="sm:min-w-[150px]">
                    {verifyBusy === "confirm" ? <Spinner /> : "Tasdiqlash"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={sendCode} disabled={verifyBusy !== null}>
                    {verifyBusy === "send" ? <Spinner /> : "Qayta yuborish"}
                  </Button>
                </div>
              </div>
              {verifyError && (
                <p id="sec-code-error" role="alert" className="field-error">
                  {verifyError}
                </p>
              )}
            </form>
          ) : (
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[13px]" aria-live="polite">
                {verifyError ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-ios-red">
                    <AlertCircle size={15} /> {verifyError}
                  </span>
                ) : (
                  <span className="text-fg-4">Kod 15 daqiqa amal qiladi, bir marta ishlatiladi.</span>
                )}
              </div>
              <Button type="button" variant="primary" onClick={sendCode} disabled={verifyBusy !== null} className="sm:min-w-[180px]">
                {verifyBusy === "send" ? <Spinner /> : <Mail size={15} />} Kod yuborish
              </Button>
            </div>
          )}
        </section>
      )}

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

      {/* ---------- Xavfli zona ---------- */}
      <section className="card p-5 sm:p-7" aria-labelledby="sec-danger">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-danger-soft text-danger-text">
            <TriangleAlert size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sec-danger" className="font-display text-[20px] font-semibold tracking-tight text-fg">
              Xavfli zona
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">Ma'lumotlaringiz sizniki: istalgan payt nusxasini yuklab oling yoki hisobni butunlay o'chiring.</p>
          </div>
        </div>

        {/* Eksport */}
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg">Ma'lumotlarimni yuklab olish</div>
            <div className="mt-0.5 text-[13px] text-fg-3" aria-live="polite">
              {exported ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 size={15} /> JSON fayl yuklab olindi
                </span>
              ) : exportError ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-ios-red">
                  <AlertCircle size={15} /> {exportError}
                </span>
              ) : (
                "Hisob, profil, buyurtmalar, to'lovlar, sharhlar va bildirishnomalar — bitta JSON fayl."
              )}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={exportData} disabled={exporting} className="sm:min-w-[200px]">
            {exporting ? <Spinner /> : <Download size={15} />} JSON yuklab olish
          </Button>
        </div>

        {/* O'chirish */}
        <div className="mt-5 border-t border-line pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-fg">Akkauntni o'chirish</div>
              <div className="mt-0.5 text-[13px] text-fg-3">
                Ism, email, telefon va profil o'chiriladi (qaytarib bo'lmaydi). Buyurtma va to'lov tarixi anonim holda saqlanadi. Eskroudagi to'lov yoki kutilayotgan pul chiqarish bo'lsa — avval yakunlang.
              </div>
            </div>
            {!confirmDelete && !deleted && (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} className="sm:min-w-[200px]">
                <Trash2 size={15} /> Akkauntni o'chirish
              </Button>
            )}
          </div>

          {deleted ? (
            <div role="status" className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={16} className="mt-px shrink-0" /> Akkaunt o'chirildi. Bosh sahifaga qaytmoqdamiz…
            </div>
          ) : (
            confirmDelete && (
              <form onSubmit={deleteAccount} noValidate className="mt-4 rounded-[18px] border border-danger/30 bg-danger-soft/40 p-4 sm:p-5">
                <p className="text-[13px] font-medium text-fg">Ishonchingiz komilmi? Tasdiqlash uchun joriy parolingizni kiriting.</p>
                <div className="mt-3 sm:max-w-sm">
                  <PasswordField
                    id="sec-delete-password"
                    name="delete-password"
                    label="Parol"
                    value={deletePassword}
                    onChange={(v) => {
                      setDeletePassword(v);
                      setDeleteError(null);
                    }}
                    autoComplete="current-password"
                    placeholder="Joriy parolingiz"
                    error={deleteError || undefined}
                  />
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeletePassword("");
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                  >
                    Bekor qilish
                  </Button>
                  <Button type="submit" variant="danger" disabled={deleting} className="sm:min-w-[200px]">
                    {deleting ? <Spinner /> : <Trash2 size={15} />} Ha, o'chirish
                  </Button>
                </div>
              </form>
            )
          )}
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
