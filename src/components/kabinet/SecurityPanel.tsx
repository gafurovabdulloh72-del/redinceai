"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  MailCheck,
  Monitor,
  MonitorSmartphone,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PasswordField } from "@/components/auth/PasswordField";
import { Badge, Button, Spinner } from "@/components/ui";
import { passwordStrength } from "@/lib/security/password-strength";
import type { SessionListItem } from "@/lib/security/sessions";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/** «Faol sessiyalar»: joriy qurilmadan tashqari dastlab ko'rinadigan sessiyalar soni */
const SESSIONS_PREVIEW = 4;

export interface SecurityInitial {
  email: string;
  emailVerified: boolean;
  phone: string | null;
  /** ms */
  lastLoginAt: number | null;
  passwordChangedAt: number | null;
  createdAt: number;
  remember: boolean;
  role: "client" | "specialist" | "admin";
  /** 2FA (TOTP) yoqilgan */
  totpEnabled: boolean;
  /** Ishlatilmagan zaxira kodlari soni */
  recoveryLeft: number;
  /** Faol sessiyalar (joriy qurilma birinchi) */
  sessions: SessionListItem[];
  /** Kirishda zaxira kodi ishlatilgan va kam qolgan (?zaxira=kam) */
  lowRecovery?: boolean;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const TIPS = [
  { icon: KeyRound, title: "Parolni boshqa saytlarda takrorlamang", text: "Bitta sayt sizsa, hammasi xavf ostida qoladi. Parol menejeridan foydalaning." },
  { icon: ShieldAlert, title: "Shubhali havolalarga parol kiritmang", text: "Kasb Egalari parolni faqat rasmiy sayt manzilida so'raydi. Telegram/SMS orqali hech qachon so'ramaymiz." },
  { icon: MonitorSmartphone, title: "Umumiy qurilmada «Meni eslab qolish»ni o'chiring", text: "Shunda brauzer yopilishi bilan sessiya tugaydi." },
  { icon: Smartphone, title: "Begona faollik sezsangiz", text: "Parolni darhol o'zgartiring — barcha boshqa qurilmalar avtomatik chiqib ketadi." },
  { icon: ShieldCheck, title: "Ikki bosqichli himoyani yoqing", text: "Parol sizib chiqsa ham, telefoningizdagi kodsiz hisobga kirib bo'lmaydi." },
  { icon: LifeBuoy, title: "Zaxira kodlarini oflayn saqlang", text: "Telefon yo'qolsa, faqat ular orqali kirasiz. Ularni hech kimga yubormang." },
];

/** "ABCD EFGH IJKL …" — sirni qo'lda terish oson bo'lsin */
function groupSecret(secret: string) {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(" ");
}

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

  // Faol sessiyalar
  const [sessions, setSessions] = useState<SessionListItem[]>(initial.sessions);
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // Ro'yxat cheksiz o'smasin: joriy qurilma + yana SESSIONS_PREVIEW ta, qolgani «Yana N ta» ortida
  const [showAllSessions, setShowAllSessions] = useState(false);
  const otherSessions = sessions.filter((s) => !s.current);
  const hiddenSessions = showAllSessions ? 0 : Math.max(0, otherSessions.length - SESSIONS_PREVIEW);
  const shownSessions = showAllSessions ? sessions : [...sessions.filter((s) => s.current), ...otherSessions.slice(0, SESSIONS_PREVIEW)];

  // Ikki bosqichli himoya (TOTP)
  const [tfaEnabled, setTfaEnabled] = useState(initial.totpEnabled);
  const [recoveryLeft, setRecoveryLeft] = useState(initial.recoveryLeft);
  const [tfaStep, setTfaStep] = useState<"idle" | "setup" | "codes" | "disable" | "regen">("idle");
  const [tfaSetup, setTfaSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaPassword, setTfaPassword] = useState("");
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaError, setTfaError] = useState<string | null>(null);
  const [tfaFields, setTfaFields] = useState<Record<string, string>>({});
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<"secret" | "codes" | null>(null);
  const [tfaNotice, setTfaNotice] = useState<string | null>(null);

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
      await reloadSessions();
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

  /* ---------- Sessiyalar ---------- */
  const reloadSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ sessions: SessionListItem[] }> | null;
      if (json && json.ok) setSessions(json.data.sessions);
    } catch {
      /* ro'yxat keyingi safar yangilanadi */
    }
  };

  const revokeOne = async (item: SessionListItem) => {
    if (!item.id || sessionBusy) return;
    setSessionError(null);
    setSessionBusy(item.id);
    try {
      const res = await fetch(`/api/auth/sessions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ revoked: boolean; current: boolean }> | null;
      if (!json || !json.ok) {
        if (res.status === 404) setSessions((list) => list.filter((x) => x.id !== item.id));
        setSessionError(errorText(res, json));
        return;
      }
      if (json.data.current) {
        router.push("/");
        router.refresh();
        return;
      }
      setSessions((list) => list.filter((x) => x.id !== item.id));
    } catch {
      setSessionError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setSessionBusy(null);
    }
  };

  /* ---------- Ikki bosqichli himoya ---------- */
  const resetTfa = (step: typeof tfaStep = "idle") => {
    setTfaStep(step);
    setTfaCode("");
    setTfaPassword("");
    setTfaError(null);
    setTfaFields({});
  };

  const tfaRequest = async <T,>(url: string, body?: unknown): Promise<T | null> => {
    setTfaBusy(true);
    setTfaError(null);
    setTfaFields({});
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
      if (!json || !json.ok) {
        // Maydon xatosi bo'lsa — faqat maydon ostida (bir xil xabar ikki marta chiqmasin)
        if (json && !json.ok && json.fields && Object.keys(json.fields).length) setTfaFields(json.fields);
        else setTfaError(errorText(res, json));
        return null;
      }
      return json.data;
    } catch {
      setTfaError("Tarmoq xatosi. Qayta urinib ko'ring.");
      return null;
    } finally {
      setTfaBusy(false);
    }
  };

  const startSetup = async () => {
    if (tfaBusy) return;
    setTfaNotice(null);
    const data = await tfaRequest<{ secret: string; uri: string }>("/api/auth/2fa/setup");
    if (!data) return;
    setTfaSetup(data);
    resetTfa("setup");
  };

  const enableTfa = async (e: FormEvent) => {
    e.preventDefault();
    if (tfaBusy) return;
    if (!/^\d{6}$/.test(tfaCode)) {
      setTfaFields({ code: "Ilovadagi 6 xonali kodni kiriting" });
      return;
    }
    const data = await tfaRequest<{ recoveryCodes: string[] }>("/api/auth/2fa/enable", { code: tfaCode });
    if (!data) {
      setTfaCode("");
      return;
    }
    setTfaEnabled(true);
    setRecoveryLeft(data.recoveryCodes.length);
    setRecoveryCodes(data.recoveryCodes);
    setTfaSetup(null);
    resetTfa("codes");
    router.refresh();
  };

  const regenerateCodes = async (e: FormEvent) => {
    e.preventDefault();
    if (tfaBusy) return;
    if (!/^\d{6}$/.test(tfaCode)) {
      setTfaFields({ code: "Ilovadagi 6 xonali kodni kiriting" });
      return;
    }
    const data = await tfaRequest<{ recoveryCodes: string[] }>("/api/auth/2fa/recovery", { code: tfaCode });
    if (!data) {
      setTfaCode("");
      return;
    }
    setRecoveryLeft(data.recoveryCodes.length);
    setRecoveryCodes(data.recoveryCodes);
    resetTfa("codes");
  };

  const disableTfa = async (e: FormEvent) => {
    e.preventDefault();
    if (tfaBusy) return;
    const errs: Record<string, string> = {};
    if (!tfaPassword) errs.password = "Parolni kiriting";
    if (tfaCode.replace(/\s/g, "").length < 6) errs.code = "Ilovadagi kod yoki zaxira kodini kiriting";
    if (Object.keys(errs).length) {
      setTfaFields(errs);
      return;
    }
    const data = await tfaRequest<{ disabled: boolean }>("/api/auth/2fa/disable", { password: tfaPassword, code: tfaCode });
    if (!data) return;
    setTfaEnabled(false);
    setRecoveryLeft(0);
    setRecoveryCodes(null);
    resetTfa("idle");
    setTfaNotice("Ikki bosqichli himoya o'chirildi.");
    router.refresh();
  };

  const copyText = async (text: string, what: "secret" | "codes") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    } catch {
      setTfaError("Nusxalab bo'lmadi — qo'lda belgilab nusxalang.");
    }
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const text = [
      "Kasb Egalari — ikki bosqichli himoya zaxira kodlari",
      `Hisob: ${initial.email}`,
      `Yaratilgan: ${formatDateTime(Date.now())}`,
      "",
      ...recoveryCodes,
      "",
      "Har bir kod faqat bir marta ishlaydi. Telefoningiz yo'qolsa, kirishda «Tiklash kodi bilan kirish» ni tanlang.",
      "Kodlarni hech kimga yubormang va xavfsiz joyda saqlang.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "redince-zaxira-kodlari.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const pwAge = initial.passwordChangedAt ?? initial.createdAt;
  const pwOld = Date.now() - pwAge > 180 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-5">
      {/* ---------- Admin: 2FA majburiy tavsiya ---------- */}
      {initial.role === "admin" && !tfaEnabled && (
        <div role="alert" className="flex flex-col gap-3 rounded-[16px] border border-danger/30 bg-danger-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-danger-text" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-danger-text">Admin hisobida ikki bosqichli himoya o&apos;chiq</p>
              <p className="mt-0.5 text-[13px] leading-snug text-fg-2">Admin to&apos;lovlar, pul chiqarish va foydalanuvchilarni boshqaradi. Parol sizib chiqsa — butun platforma xavf ostida. Himoyani hozir yoqing.</p>
            </div>
          </div>
          <a href="#ikki-bosqich" className="btn-ink inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold">
            <ShieldCheck size={15} /> Himoyani yoqish
          </a>
        </div>
      )}

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

      {/* ---------- Ikki bosqichli himoya (TOTP) ---------- */}
      <section id="ikki-bosqich" className="card scroll-mt-28 p-5 sm:p-7" aria-labelledby="sec-2fa">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="sec-2fa" className="font-display text-[20px] font-semibold tracking-tight text-fg">
                Ikki bosqichli himoya
              </h2>
              {tfaEnabled ? (
                <Badge tone="success">
                  <ShieldCheck size={12} /> Yoqilgan
                </Badge>
              ) : (
                <Badge tone="neutral">O&apos;chirilgan</Badge>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-fg-3">
              Kirishda paroldan tashqari telefoningizdagi autentifikator ilovasi (Google Authenticator, Microsoft Authenticator, 1Password…) ko&apos;rsatgan 6 xonali kod so&apos;raladi.
            </p>
          </div>
        </div>

        {initial.lowRecovery && tfaEnabled && tfaStep === "idle" && (
          <div role="status" className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-warning-soft px-4 py-3 text-[13px] font-medium text-warning-text">
            <LifeBuoy size={16} className="mt-px shrink-0" /> Siz zaxira kodi bilan kirdingiz — {recoveryLeft} ta kod qoldi. Yangi kodlar oling va xavfsiz saqlang.
          </div>
        )}

        {tfaStep === "codes" && recoveryCodes ? (
          <div className="mt-5 border-t border-line pt-5">
            <div role="status" className="flex items-start gap-2.5 rounded-[16px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={16} className="mt-px shrink-0" /> Zaxira kodlari tayyor. Ular faqat hozir ko&apos;rsatiladi — nusxalang yoki yuklab oling.
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Zaxira kodlari">
              {recoveryCodes.map((c) => (
                <li key={c} className="rounded-[12px] border border-line bg-surface-2 px-2 py-2.5 text-center font-mono text-[14px] font-semibold tracking-wide text-fg">
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-snug text-fg-3">Har bir kod bir marta ishlaydi. Telefoningiz yo&apos;qolsa, kirishda «Tiklash kodi bilan kirish»ni tanlang.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={() => copyText(recoveryCodes.join("\n"), "codes")}>
                {copied === "codes" ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied === "codes" ? "Nusxalandi" : "Nusxalash"}
              </Button>
              <Button type="button" variant="outline" onClick={downloadCodes}>
                <Download size={15} /> .txt yuklab olish
              </Button>
              <Button
                type="button"
                variant="primary"
                className="sm:ml-auto sm:min-w-[160px]"
                onClick={() => {
                  setRecoveryCodes(null);
                  resetTfa("idle");
                }}
              >
                Saqladim
              </Button>
            </div>
          </div>
        ) : tfaStep === "setup" && tfaSetup ? (
          <form onSubmit={enableTfa} noValidate className="mt-5 border-t border-line pt-5">
            <ol className="space-y-5">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-[13px] font-semibold text-fg-2">1</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-fg">Autentifikator ilovasini oching</p>
                  <p className="mt-0.5 text-[13px] text-fg-3">Telefoningizda bo&apos;lmasa — Google Authenticator yoki Microsoft Authenticator&apos;ni o&apos;rnating.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-[13px] font-semibold text-fg-2">2</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-fg">Kasb Egalari hisobini qo&apos;shing</p>
                  <p className="mt-0.5 text-[13px] text-fg-3">Shu telefonda bo&apos;lsangiz — pastdagi havolani bosing. Aks holda ilovada «Kalitni kiritish»ni tanlab, quyidagi sirni yozing (turi: vaqtga asoslangan).</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <code className="min-w-0 flex-1 select-all break-all rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[15px] font-semibold tracking-[0.08em] text-fg" aria-label="Sir kalit">
                      {groupSecret(tfaSetup.secret)}
                    </code>
                    <Button type="button" variant="outline" onClick={() => copyText(tfaSetup.secret, "secret")} className="shrink-0">
                      {copied === "secret" ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied === "secret" ? "Nusxalandi" : "Nusxalash"}
                    </Button>
                  </div>
                  <a href={tfaSetup.uri} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-accent-text underline underline-offset-2 hover:brightness-110">
                    <ExternalLink size={14} /> Autentifikator ilovasida ochish
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-[13px] font-semibold text-fg-2">3</span>
                <div className="min-w-0 flex-1">
                  <label htmlFor="sec-2fa-code" className="text-[14px] font-semibold text-fg">
                    Ilova ko&apos;rsatgan kodni kiriting
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input
                      id="sec-2fa-code"
                      name="one-time-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="123456"
                      value={tfaCode}
                      onChange={(e) => {
                        setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setTfaFields({});
                      }}
                      className={cn("field font-mono text-[18px] tracking-[0.3em] sm:w-48", tfaFields.code && "!border-ios-red/60")}
                      aria-invalid={!!tfaFields.code}
                      aria-describedby={tfaFields.code ? "sec-2fa-code-error" : undefined}
                    />
                    <Button type="submit" variant="accent" disabled={tfaBusy} className="sm:min-w-[190px]">
                      {tfaBusy ? <Spinner /> : <ShieldCheck size={15} />} Tasdiqlash va yoqish
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={tfaBusy}
                      onClick={() => {
                        setTfaSetup(null);
                        resetTfa("idle");
                      }}
                    >
                      Bekor qilish
                    </Button>
                  </div>
                  {tfaFields.code && (
                    <p id="sec-2fa-code-error" role="alert" className="field-error">
                      {tfaFields.code}
                    </p>
                  )}
                </div>
              </li>
            </ol>
          </form>
        ) : tfaStep === "disable" ? (
          <form onSubmit={disableTfa} noValidate className="mt-5 rounded-[18px] border border-danger/30 bg-danger-soft/40 p-4 sm:p-5">
            <p className="text-[13px] font-medium text-fg">Himoyani o&apos;chirish uchun parol va ilovadagi kodni (yoki zaxira kodini) kiriting.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <PasswordField
                id="sec-2fa-password"
                name="current-password"
                label="Parol"
                value={tfaPassword}
                onChange={(v) => {
                  setTfaPassword(v);
                  setTfaFields((f) => ({ ...f, password: "" }));
                }}
                autoComplete="current-password"
                placeholder="Joriy parolingiz"
                error={tfaFields.password || undefined}
              />
              <div>
                <label htmlFor="sec-2fa-off-code" className="field-label">
                  Kod
                </label>
                <input
                  id="sec-2fa-off-code"
                  name="one-time-code"
                  type="text"
                  autoComplete="one-time-code"
                  maxLength={20}
                  placeholder="123456 yoki abcd-efgh"
                  value={tfaCode}
                  onChange={(e) => {
                    setTfaCode(e.target.value);
                    setTfaFields((f) => ({ ...f, code: "" }));
                  }}
                  className={cn("field font-mono", tfaFields.code && "!border-ios-red/60")}
                  aria-invalid={!!tfaFields.code}
                  aria-describedby={tfaFields.code ? "sec-2fa-off-code-error" : undefined}
                />
                {tfaFields.code && (
                  <p id="sec-2fa-off-code-error" className="field-error">
                    {tfaFields.code}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => resetTfa("idle")} disabled={tfaBusy}>
                Bekor qilish
              </Button>
              <Button type="submit" variant="danger" disabled={tfaBusy} className="sm:min-w-[200px]">
                {tfaBusy ? <Spinner /> : <ShieldOff size={15} />} Himoyani o&apos;chirish
              </Button>
            </div>
          </form>
        ) : tfaStep === "regen" ? (
          <form onSubmit={regenerateCodes} noValidate className="mt-5 border-t border-line pt-5">
            <label htmlFor="sec-2fa-regen" className="text-[14px] font-semibold text-fg">
              Yangi zaxira kodlari — eskilari bekor bo&apos;ladi
            </label>
            <p className="mt-0.5 text-[13px] text-fg-3">Tasdiqlash uchun ilovadagi joriy kodni kiriting.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <input
                id="sec-2fa-regen"
                name="one-time-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={tfaCode}
                onChange={(e) => {
                  setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setTfaFields({});
                }}
                className={cn("field font-mono text-[18px] tracking-[0.3em] sm:w-48", tfaFields.code && "!border-ios-red/60")}
                aria-invalid={!!tfaFields.code}
                aria-describedby={tfaFields.code ? "sec-2fa-regen-error" : undefined}
              />
              <Button type="submit" variant="primary" disabled={tfaBusy} className="sm:min-w-[180px]">
                {tfaBusy ? <Spinner /> : <RefreshCw size={15} />} Yangi kodlar olish
              </Button>
              <Button type="button" variant="ghost" onClick={() => resetTfa("idle")} disabled={tfaBusy}>
                Bekor qilish
              </Button>
            </div>
            {tfaFields.code && (
              <p id="sec-2fa-regen-error" role="alert" className="field-error">
                {tfaFields.code}
              </p>
            )}
          </form>
        ) : (
          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px]" aria-live="polite">
              {tfaNotice ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
                  <CheckCircle2 size={15} /> {tfaNotice}
                </span>
              ) : tfaEnabled ? (
                <span className={cn("inline-flex items-center gap-1.5", recoveryLeft <= 3 ? "font-semibold text-warning-text" : "text-fg-3")}>
                  <LifeBuoy size={15} /> Zaxira kodlari: {recoveryLeft} ta qoldi
                </span>
              ) : (
                <span className="text-fg-4">Sozlash 1 daqiqa oladi. QR kod shart emas — sirni ilovaga kiritasiz.</span>
              )}
            </div>
            {tfaEnabled ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => resetTfa("regen")}>
                  <RefreshCw size={15} /> Zaxira kodlarini yangilash
                </Button>
                <Button type="button" variant="ghost" onClick={() => resetTfa("disable")} className="!text-danger-text hover:!bg-danger-soft">
                  <ShieldOff size={15} /> O&apos;chirish
                </Button>
              </div>
            ) : (
              <Button type="button" variant="primary" onClick={startSetup} disabled={tfaBusy} className="sm:min-w-[200px]">
                {tfaBusy ? <Spinner /> : <ShieldCheck size={15} />} Himoyani yoqish
              </Button>
            )}
          </div>
        )}

        {tfaError && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
            <AlertCircle size={16} className="mt-px shrink-0" /> {tfaError}
          </div>
        )}
      </section>

      {/* ---------- Qurilmalar ---------- */}
      <section id="sessiyalar" className="card scroll-mt-28 p-5 sm:p-7" aria-labelledby="sec-devices">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <MonitorSmartphone size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sec-devices" className="font-display text-[20px] font-semibold tracking-tight text-fg">
              Faol sessiyalar
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              Joriy sessiya: {initial.remember ? "«Meni eslab qolish» yoqilgan — 30 kun" : "brauzer yopilguncha"}. Tanimagan qurilmani ko&apos;rsangiz — «Chiqish»ni bosing va parolni o&apos;zgartiring.
            </p>
          </div>
        </div>

        <ul id="sessions-list" className="mt-5 divide-y divide-line border-t border-line" aria-label="Faol sessiyalar ro'yxati">
          {sessions.length === 0 && <li className="py-4 text-[13px] text-fg-4">Faol sessiyalar topilmadi.</li>}
          {shownSessions.map((item) => {
            const Icon = item.mobile ? Smartphone : Monitor;
            return (
              <li key={item.id ?? "current"} className="flex items-center gap-3 py-3.5">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", item.current ? "bg-accent-soft text-accent-text" : "bg-fg/6 text-fg-2")}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[14px] font-semibold text-fg">{item.label}</span>
                    {item.current && <Badge tone="success">Shu qurilma</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-3">
                    {item.current ? (
                      "Hozir faol"
                    ) : (
                      <>
                        Oxirgi faollik:{" "}
                        <time dateTime={new Date(item.lastSeenAt).toISOString()} suppressHydrationWarning>
                          {timeAgo(item.lastSeenAt)}
                        </time>
                      </>
                    )}
                    <span className="text-fg-4">
                      {" "}
                      · Kirgan:{" "}
                      <time dateTime={new Date(item.createdAt).toISOString()} suppressHydrationWarning>
                        {formatDateTime(item.createdAt)}
                      </time>
                    </span>
                  </p>
                </div>
                {!item.current && item.id && (
                  <Button type="button" variant="outline" size="sm" onClick={() => revokeOne(item)} disabled={sessionBusy !== null} className="!h-10 shrink-0" aria-label={`${item.label} sessiyasidan chiqish`}>
                    {sessionBusy === item.id ? <Spinner /> : <LogOut size={14} />} Chiqish
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {otherSessions.length > SESSIONS_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAllSessions((v) => !v)}
            aria-expanded={showAllSessions}
            aria-controls="sessions-list"
            className="mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg"
          >
            <ChevronDown size={15} aria-hidden="true" className={cn("transition-transform", showAllSessions && "rotate-180")} />
            {showAllSessions ? "Kamroq ko'rsatish" : `Yana ${hiddenSessions} ta sessiya`}
          </button>
        )}
        {sessionError && (
          <p role="alert" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-ios-red">
            <AlertCircle size={15} /> {sessionError}
          </p>
        )}

        <div className="mt-2 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
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
