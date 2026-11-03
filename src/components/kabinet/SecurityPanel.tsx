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
  History,
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
import { cn, formatDateTime } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { FORMA, XAVF as X, loginEventLabel } from "@/lib/i18n/dict/kabinet-forms";

/** «Faol sessiyalar»: joriy qurilmadan tashqari dastlab ko'rinadigan sessiyalar soni */
const SESSIONS_PREVIEW = 4;

/** Kirish tarixi qatori (audit_logs): harakat, vaqt, maskalangan IP, 2FA usuli */
export interface LoginEvent {
  id: string;
  action: string;
  /** ms */
  at: number;
  ip: string | null;
  twoFactor: string | null;
}

/** Kirish tarixidagi harakat yorliqlari (audit action → matn, ohang) */
const LOGIN_EVENT_META: Record<string, { label: string; bad?: boolean }> = {
  login_success: { label: "Kirish" },
  login_failed: { label: "Noto'g'ri parol bilan urinish", bad: true },
  login_2fa_failed: { label: "2FA kodi noto'g'ri", bad: true },
  login_2fa_required: { label: "2FA kodi so'raldi" },
  logout: { label: "Chiqish" },
  logout_all: { label: "Barcha qurilmalardan chiqish" },
  password_changed: { label: "Parol o'zgartirildi" },
  session_revoked: { label: "Sessiya yopildi" },
};

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
  /** Kirish tarixi (oxirgi 12 ta): kirish, muvaffaqiyatsiz urinish, chiqish, parol o'zgarishi */
  history?: LoginEvent[];
  /** Hisobga Telegram ulangan — parolni bilmaganlar (bot orqali ochilgan hisob) havolani Telegramga oladi */
  telegramLinked?: boolean;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

/** Maslahat ikonkalari — matnlar XAVF.tips (lug'at) bilan bir xil tartibda */
const TIP_ICONS = [KeyRound, ShieldAlert, MonitorSmartphone, Smartphone, ShieldCheck, LifeBuoy];
const TIPS = X.tips.map((t, i) => ({ icon: TIP_ICONS[i], ...t }));

/** "ABCD EFGH IJKL …" — sirni qo'lda terish oson bo'lsin */
function groupSecret(secret: string) {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(" ");
}

export function SecurityPanel({ initial }: { initial: SecurityInitial }) {
  const router = useRouter();
  const til = useLocale();
  const [current, setCurrent] = useState("");
  const [confirmExport, setConfirmExport] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [tgLinkBusy, setTgLinkBusy] = useState(false);
  const [tgLinkSent, setTgLinkSent] = useState(false);
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
  /** Kamchilik #94: JSON (texnik) yoki HTML (o'qiladigan hujjat) */
  const [exportFormat, setExportFormat] = useState<"json" | "html">("json");
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


  /** Telegram orqali ochilgan hisob parolni bilmaydi — yangi parol havolasi hisobga ulangan Telegramga yuboriladi */
  async function sendTgPasswordLink() {
    if (tgLinkBusy || tgLinkSent) return;
    setTgLinkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/parol/telegram", { method: "POST" });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ sent: boolean }> | null;
      if (json?.ok) setTgLinkSent(true);
      else setError((json && !json.ok && json.error) || tr(til, X.tgSendFailed));
    } catch {
      setError(tr(til, X.networkDash));
    } finally {
      setTgLinkBusy(false);
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = tr(til, X.currentRequired);
    const s = passwordStrength(next);
    if (!s.valid) errs.newPassword = tr(til, next.length < 8 ? X.pwMin : X.pwMix);
    else if (next === current) errs.newPassword = tr(til, X.pwSame);
    if (confirm !== next) errs.confirm = tr(til, X.pwMismatch);
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
          setError(retry > 0 ? X.tooMany[til](Math.ceil(retry / 60)) : (json?.error ?? tr(til, X.tooManyShort)));
        } else setError(json?.error ?? tr(til, X.serverError));
        if (json && !json.ok && json.fields) setFields(json.fields);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
      router.refresh();
    } catch {
      setError(tr(til, FORMA.networkError));
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
        setRevokeError(json?.error ?? tr(til, X.serverError));
        return;
      }
      setConfirmAll(false);
      setRevoked(true);
      await reloadSessions();
      router.refresh();
    } catch {
      setRevokeError(tr(til, FORMA.networkRetry));
    } finally {
      setRevoking(false);
    }
  };

  useEffect(() => {
    if (!exported) return;
    const t = window.setTimeout(() => setExported(false), 6000);
    return () => window.clearTimeout(t);
  }, [exported]);

  const errorText = (res: Response, json: ApiResponse<unknown> | null, fallback = tr(til, X.serverError)) => {
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") || 0);
      return retry > 0 ? X.tooMany[til](Math.ceil(retry / 60)) : (json && !json.ok && json.error) || tr(til, X.tooManyShort);
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
      setVerifyError(tr(til, FORMA.networkRetry));
    } finally {
      setVerifyBusy(null);
    }
  };

  const confirmCode = async (e: FormEvent) => {
    e.preventDefault();
    if (verifyBusy) return;
    if (!/^\d{6}$/.test(code)) {
      setVerifyError(tr(til, X.code6));
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
      setVerifyError(tr(til, FORMA.networkRetry));
    } finally {
      setVerifyBusy(null);
    }
  };

  const exportData = async () => {
    if (exporting) return;
    if (!exportPassword) {
      setExportError(tr(til, X.exportPwRequired));
      return;
    }
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: exportPassword, format: exportFormat }) });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        setExportError(errorText(res, json, tr(til, X.exportFailed)));
        return;
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `kasb-egalari-export.${exportFormat}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExported(true);
      setConfirmExport(false);
      setExportPassword("");
    } catch {
      setExportError(tr(til, FORMA.networkRetry));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (deleting) return;
    if (!deletePassword) {
      setDeleteError(tr(til, X.deletePwRequired));
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ deleted: boolean }> | null;
      if (!json || !json.ok) {
        setDeleteError(errorText(res, json, tr(til, X.deleteFailed)));
        return;
      }
      setDeleted(true);
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1800);
    } catch {
      setDeleteError(tr(til, FORMA.networkRetry));
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
      setSessionError(tr(til, FORMA.networkRetry));
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
      setTfaError(tr(til, FORMA.networkRetry));
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
      setTfaFields({ code: tr(til, X.appCode6) });
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
      setTfaFields({ code: tr(til, X.appCode6) });
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
    if (!tfaPassword) errs.password = tr(til, X.pwRequired);
    if (tfaCode.replace(/\s/g, "").length < 6) errs.code = tr(til, X.codeOrRecovery);
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
    setTfaNotice(tr(til, X.tfaDisabled));
    router.refresh();
  };

  const copyText = async (text: string, what: "secret" | "codes") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
    } catch {
      setTfaError(tr(til, X.copyFailed));
    }
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const text = [
      tr(til, X.codesFileTitle),
      X.codesFileAccount[til](initial.email),
      X.codesFileCreated[til](formatDateTime(Date.now())),
      "",
      ...recoveryCodes,
      "",
      tr(til, X.codesFileNote1),
      tr(til, X.codesFileNote2),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kasb-egalari-zaxira-kodlari.txt";
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
              <p className="text-[14px] font-semibold text-danger-text">{tr(til, X.adminAlertTitle)}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-fg-2">{tr(til, X.adminAlertText)}</p>
            </div>
          </div>
          <a href="#ikki-bosqich" className="btn-ink inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold">
            <ShieldCheck size={15} /> {tr(til, X.enableProtection)}
          </a>
        </div>
      )}

      {/* ---------- Holat ---------- */}
      <section className="grid grid-cols-2 gap-3 max-sm:gap-2 lg:grid-cols-4" aria-label={tr(til, X.statusAria)}>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Clock3 size={14} /> {tr(til, X.lastLogin)}
          </div>
          <div className="mt-2 font-display text-[17px] font-semibold leading-tight text-fg">
            {initial.lastLoginAt ? (
              <time dateTime={new Date(initial.lastLoginAt).toISOString()} suppressHydrationWarning>
                {timeAgoLabel(til, initial.lastLoginAt)}
              </time>
            ) : (
              tr(til, X.now)
            )}
          </div>
          <div className="mt-1 text-[12px] text-fg-4">{initial.lastLoginAt ? formatDateTime(initial.lastLoginAt) : tr(til, X.firstSession)}</div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <KeyRound size={14} /> {tr(til, X.password)}
          </div>
          <div className="mt-2 font-display text-[17px] font-semibold leading-tight text-fg">
            {initial.passwordChangedAt ? (
              <>
                <time dateTime={new Date(initial.passwordChangedAt).toISOString()} suppressHydrationWarning>
                  {timeAgoLabel(til, initial.passwordChangedAt)}
                </time>{" "}
                {tr(til, X.updatedSuffix)}
              </>
            ) : (
              tr(til, X.neverChanged)
            )}
          </div>
          <div className="mt-1 text-[12px] text-fg-4">{tr(til, pwOld ? X.pwOld : X.pwRecent)}</div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Mail size={14} /> {tr(til, X.email)}
          </div>
          <div className="mt-2 truncate text-[14px] font-semibold text-fg">{initial.email}</div>
          <div className="mt-2">
            {verified ? (
              <Badge tone="success">
                <ShieldCheck size={12} /> {tr(til, X.verified)}
              </Badge>
            ) : (
              <Badge tone="warning">
                <AlertCircle size={12} /> {tr(til, X.unverified)}
              </Badge>
            )}
          </div>
        </div>
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Phone size={14} /> {tr(til, X.phone)}
          </div>
          <div className="mt-2 truncate text-[14px] font-semibold text-fg">{initial.phone || tr(til, X.notEntered)}</div>
          <div className="mt-2">
            {initial.phone ? <Badge tone="neutral">{tr(til, X.entered)}</Badge> : <Badge tone="neutral">{tr(til, X.addInProfile)}</Badge>}
          </div>
        </div>
      </section>

      {/* ---------- Emailni tasdiqlash ---------- */}
      {(!verified || justVerified) && (
        <section className="card m-flat p-5 sm:p-6" aria-labelledby="sec-verify">
          <div className="flex items-start gap-3">
            <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
              <MailCheck size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="sec-verify" className="font-display text-[19px] font-semibold tracking-tight text-fg">
                {tr(til, X.verifyTitle)}
              </h2>
              <p className="mt-0.5 text-[13px] text-fg-3">
                {tr(til, X.verifyDescStart)} <span className="font-semibold text-fg-2">{initial.email}</span>{til === "ru" ? "" : " "}{tr(til, X.verifyDescEnd)}
              </p>
            </div>
          </div>

          {justVerified ? (
            <div role="status" className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={16} className="mt-px shrink-0" /> {tr(til, X.verifiedThanks)}
            </div>
          ) : codeSent ? (
            <form onSubmit={confirmCode} noValidate className="mt-5 border-t border-line pt-5">
              <p className="text-[13px] text-fg-2">
                {tr(til, codeSent.sent ? X.codeSent : X.codeDev)}{" "}
                <span className="text-fg-4">
                  {tr(til, X.codeValidStart)}{" "}
                  <time dateTime={new Date(codeSent.expiresAt).toISOString()} suppressHydrationWarning>
                    {formatDateTime(codeSent.expiresAt)}
                  </time>
                  {til === "ru" ? "" : " "}
                  {tr(til, X.codeValidEnd)}
                </span>
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-56">
                  <label htmlFor="sec-code" className="field-label">
                    {tr(til, X.verifyCode)}
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
                    className={cn("field font-mono text-[18px] tracking-[0.3em]", verifyError && "!border-danger/60")}
                    aria-invalid={!!verifyError}
                    aria-describedby={verifyError ? "sec-code-error" : undefined}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" variant="accent" disabled={verifyBusy !== null} className="sm:min-w-[150px]">
                    {verifyBusy === "confirm" ? <Spinner /> : tr(til, X.confirm)}
                  </Button>
                  <Button type="button" variant="ghost" onClick={sendCode} disabled={verifyBusy !== null}>
                    {verifyBusy === "send" ? <Spinner /> : tr(til, X.resend)}
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
                  <span className="inline-flex items-center gap-1.5 font-medium text-danger-text">
                    <AlertCircle size={15} /> {verifyError}
                  </span>
                ) : (
                  <span className="text-fg-4">{tr(til, X.codeTtl)}</span>
                )}
              </div>
              <Button type="button" variant="primary" onClick={sendCode} disabled={verifyBusy !== null} className="sm:min-w-[180px]">
                {verifyBusy === "send" ? <Spinner /> : <Mail size={15} />} {tr(til, X.sendCode)}
              </Button>
            </div>
          )}
        </section>
      )}

      {/* ---------- Parolni o'zgartirish ---------- */}
      <form onSubmit={changePassword} className="card m-flat p-5 sm:p-6" noValidate>
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
            <KeyRound size={18} />
          </span>
          <div>
            <h2 className="font-display text-[19px] font-semibold tracking-tight text-fg">{tr(til, X.changePw)}</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, X.changePwDesc)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-sm">
            <PasswordField
              id="sec-current"
              name="current-password"
              label={tr(til, X.currentPw)}
              value={current}
              onChange={(v) => {
                setCurrent(v);
                setFields((f) => ({ ...f, currentPassword: "" }));
              }}
              autoComplete="current-password"
              placeholder={tr(til, X.currentPwPh)}
              error={fields.currentPassword || undefined}
            />
          </div>
          <PasswordField
            id="sec-new"
            name="new-password"
            label={tr(til, X.newPw)}
            value={next}
            onChange={(v) => {
              setNext(v);
              setFields((f) => ({ ...f, newPassword: "" }));
            }}
            autoComplete="new-password"
            placeholder={tr(til, X.newPwPh)}
            error={fields.newPassword || undefined}
            meter
          />
          <PasswordField
            id="sec-confirm"
            name="confirm-password"
            label={tr(til, X.repeatPw)}
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setFields((f) => ({ ...f, confirm: "" }));
            }}
            autoComplete="new-password"
            placeholder={tr(til, X.repeatPwPh)}
            error={fields.confirm || undefined}
          />
        </div>

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-danger-soft px-4 py-3 text-[13px] font-medium text-danger-text">
            <AlertCircle size={16} className="mt-px shrink-0" /> {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px]" aria-live="polite">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
                <CheckCircle2 size={15} /> {tr(til, X.pwUpdated)}
              </span>
            ) : (
              <span className="text-fg-4">{tr(til, X.pwStored)}</span>
            )}
          </div>
          <Button type="submit" variant="accent" disabled={busy} className="sm:min-w-[180px]">
            {busy ? <Spinner /> : tr(til, X.updatePw)}
          </Button>
        </div>

        {initial.telegramLinked && (
          <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-fg-3">
            {tr(til, X.tgPwStart)}{" "}
            <button
              type="button"
              onClick={() => void sendTgPasswordLink()}
              disabled={tgLinkBusy || tgLinkSent}
              className="font-semibold text-accent underline-offset-2 hover:underline disabled:cursor-default disabled:opacity-70"
            >
              {tr(til, tgLinkBusy ? X.tgSending : tgLinkSent ? X.tgSent : X.tgSendLink)}
            </button>
            {tr(til, X.tgPwEnd)}
          </p>
        )}
      </form>

      {/* ---------- Ikki bosqichli himoya (TOTP) ---------- */}
      <section id="ikki-bosqich" className="card m-flat scroll-mt-28 p-5 sm:p-6" aria-labelledby="sec-2fa">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="sec-2fa" className="font-display text-[19px] font-semibold tracking-tight text-fg">
                {tr(til, X.tfaTitle)}
              </h2>
              {tfaEnabled ? (
                <Badge tone="success">
                  <ShieldCheck size={12} /> {tr(til, X.enabled)}
                </Badge>
              ) : (
                <Badge tone="neutral">{tr(til, X.disabled)}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {tr(til, X.tfaDesc)}
            </p>
          </div>
        </div>

        {initial.lowRecovery && tfaEnabled && tfaStep === "idle" && (
          <div role="status" className="mt-5 flex items-start gap-2.5 rounded-[16px] bg-warning-soft px-4 py-3 text-[13px] font-medium text-warning-text">
            <LifeBuoy size={16} className="mt-px shrink-0" /> {X.lowRecovery[til](recoveryLeft)}
          </div>
        )}

        {tfaStep === "codes" && recoveryCodes ? (
          <div className="mt-5 border-t border-line pt-5">
            <div role="status" className="flex items-start gap-2.5 rounded-[16px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={16} className="mt-px shrink-0" /> {tr(til, X.codesReady)}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label={tr(til, X.codesAria)}>
              {recoveryCodes.map((c) => (
                <li key={c} className="rounded-[12px] border border-line bg-surface-2 px-2 py-2.5 text-center font-mono text-[14px] font-semibold tracking-wide text-fg">
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-snug text-fg-3">{tr(til, X.codesNote)}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={() => copyText(recoveryCodes.join("\n"), "codes")}>
                {copied === "codes" ? <CheckCircle2 size={15} /> : <Copy size={15} />} {tr(til, copied === "codes" ? FORMA.copied : FORMA.copy)}
              </Button>
              <Button type="button" variant="outline" onClick={downloadCodes}>
                <Download size={15} /> {tr(til, X.downloadTxt)}
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
                {tr(til, X.savedCodes)}
              </Button>
            </div>
          </div>
        ) : tfaStep === "setup" && tfaSetup ? (
          <form onSubmit={enableTfa} noValidate className="mt-5 border-t border-line pt-5">
            <ol className="space-y-5">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-[13px] font-semibold text-fg-2">1</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-fg">{tr(til, X.step1)}</p>
                  <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, X.step1Hint)}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-[13px] font-semibold text-fg-2">2</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-fg">{tr(til, X.step2)}</p>
                  <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, X.step2Hint)}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <code className="min-w-0 flex-1 select-all break-all rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[15px] font-semibold tracking-[0.08em] text-fg" aria-label={tr(til, X.secretAria)}>
                      {groupSecret(tfaSetup.secret)}
                    </code>
                    <Button type="button" variant="outline" onClick={() => copyText(tfaSetup.secret, "secret")} className="shrink-0">
                      {copied === "secret" ? <CheckCircle2 size={15} /> : <Copy size={15} />} {tr(til, copied === "secret" ? FORMA.copied : FORMA.copy)}
                    </Button>
                  </div>
                  <a href={tfaSetup.uri} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-accent-text underline underline-offset-2 hover:brightness-110">
                    <ExternalLink size={14} /> {tr(til, X.openInApp)}
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg/6 text-[13px] font-semibold text-fg-2">3</span>
                <div className="min-w-0 flex-1">
                  <label htmlFor="sec-2fa-code" className="text-[14px] font-semibold text-fg">
                    {tr(til, X.step3)}
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
                      className={cn("field font-mono text-[18px] tracking-[0.3em] sm:w-48", tfaFields.code && "!border-danger/60")}
                      aria-invalid={!!tfaFields.code}
                      aria-describedby={tfaFields.code ? "sec-2fa-code-error" : undefined}
                    />
                    <Button type="submit" variant="accent" disabled={tfaBusy} className="sm:min-w-[190px]">
                      {tfaBusy ? <Spinner /> : <ShieldCheck size={15} />} {tr(til, X.confirmEnable)}
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
                      {tr(til, FORMA.cancel)}
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
            <p className="text-[13px] font-medium text-fg">{tr(til, X.disableHint)}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <PasswordField
                id="sec-2fa-password"
                name="current-password"
                label={tr(til, X.password)}
                value={tfaPassword}
                onChange={(v) => {
                  setTfaPassword(v);
                  setTfaFields((f) => ({ ...f, password: "" }));
                }}
                autoComplete="current-password"
                placeholder={tr(til, X.currentPwPh)}
                error={tfaFields.password || undefined}
              />
              <div>
                <label htmlFor="sec-2fa-off-code" className="field-label">
                  {tr(til, X.code)}
                </label>
                <input
                  id="sec-2fa-off-code"
                  name="one-time-code"
                  type="text"
                  autoComplete="one-time-code"
                  maxLength={20}
                  placeholder={tr(til, X.codePh)}
                  value={tfaCode}
                  onChange={(e) => {
                    setTfaCode(e.target.value);
                    setTfaFields((f) => ({ ...f, code: "" }));
                  }}
                  className={cn("field font-mono", tfaFields.code && "!border-danger/60")}
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
                {tr(til, FORMA.cancel)}
              </Button>
              <Button type="submit" variant="danger" disabled={tfaBusy} className="sm:min-w-[200px]">
                {tfaBusy ? <Spinner /> : <ShieldOff size={15} />} {tr(til, X.disableProtection)}
              </Button>
            </div>
          </form>
        ) : tfaStep === "regen" ? (
          <form onSubmit={regenerateCodes} noValidate className="mt-5 border-t border-line pt-5">
            <label htmlFor="sec-2fa-regen" className="text-[14px] font-semibold text-fg">
              {tr(til, X.regenTitle)}
            </label>
            <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, X.regenHint)}</p>
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
                className={cn("field font-mono text-[18px] tracking-[0.3em] sm:w-48", tfaFields.code && "!border-danger/60")}
                aria-invalid={!!tfaFields.code}
                aria-describedby={tfaFields.code ? "sec-2fa-regen-error" : undefined}
              />
              <Button type="submit" variant="primary" disabled={tfaBusy} className="sm:min-w-[180px]">
                {tfaBusy ? <Spinner /> : <RefreshCw size={15} />} {tr(til, X.getNewCodes)}
              </Button>
              <Button type="button" variant="ghost" onClick={() => resetTfa("idle")} disabled={tfaBusy}>
                {tr(til, FORMA.cancel)}
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
                  <LifeBuoy size={15} /> {X.codesLeft[til](recoveryLeft)}
                </span>
              ) : (
                <span className="text-fg-4">{tr(til, X.setupHint)}</span>
              )}
            </div>
            {tfaEnabled ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => resetTfa("regen")}>
                  <RefreshCw size={15} /> {tr(til, X.refreshCodes)}
                </Button>
                <Button type="button" variant="ghost" onClick={() => resetTfa("disable")} className="!text-danger-text hover:!bg-danger-soft">
                  <ShieldOff size={15} /> {tr(til, X.turnOff)}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="primary" onClick={startSetup} disabled={tfaBusy} className="sm:min-w-[200px]">
                {tfaBusy ? <Spinner /> : <ShieldCheck size={15} />} {tr(til, X.enableProtection)}
              </Button>
            )}
          </div>
        )}

        {tfaError && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-danger-soft px-4 py-3 text-[13px] font-medium text-danger-text">
            <AlertCircle size={16} className="mt-px shrink-0" /> {tfaError}
          </div>
        )}
      </section>

      {/* ---------- Qurilmalar ---------- */}
      <section id="sessiyalar" className="card m-flat scroll-mt-28 p-5 sm:p-6" aria-labelledby="sec-devices">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
            <MonitorSmartphone size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sec-devices" className="font-display text-[19px] font-semibold tracking-tight text-fg">
              {tr(til, X.sessionsTitle)}
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {tr(til, X.sessionsDescStart)} {tr(til, initial.remember ? X.remember30 : X.untilClose)}{tr(til, X.sessionsDescEnd)}
            </p>
          </div>
        </div>

        <ul id="sessions-list" className="mt-5 divide-y divide-line border-t border-line" aria-label={tr(til, X.sessionsListAria)}>
          {sessions.length === 0 && <li className="py-4 text-[13px] text-fg-4">{tr(til, X.noSessions)}</li>}
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
                    {item.current && <Badge tone="success">{tr(til, X.thisDevice)}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-3">
                    {item.current ? (
                      tr(til, X.activeNow)
                    ) : (
                      <>
                        {tr(til, X.lastActivity)}{" "}
                        <time dateTime={new Date(item.lastSeenAt).toISOString()} suppressHydrationWarning>
                          {timeAgoLabel(til, item.lastSeenAt)}
                        </time>
                      </>
                    )}
                    <span className="text-fg-4">
                      {" "}
                      {tr(til, X.signedIn)}{" "}
                      <time dateTime={new Date(item.createdAt).toISOString()} suppressHydrationWarning>
                        {formatDateTime(item.createdAt)}
                      </time>
                    </span>
                  </p>
                </div>
                {!item.current && item.id && (
                  <Button type="button" variant="outline" size="sm" onClick={() => revokeOne(item)} disabled={sessionBusy !== null} className="!h-10 shrink-0" aria-label={X.logoutSessionAria[til](item.label)}>
                    {sessionBusy === item.id ? <Spinner /> : <LogOut size={14} />} {tr(til, X.logout)}
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
            {showAllSessions ? tr(til, X.showLess) : X.moreSessions[til](hiddenSessions)}
          </button>
        )}
        {sessionError && (
          <p role="alert" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-danger-text">
            <AlertCircle size={15} /> {sessionError}
          </p>
        )}

        <div className="mt-2 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px]" aria-live="polite">
            {revoked ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
                <CheckCircle2 size={15} /> {tr(til, X.othersRevoked)}
              </span>
            ) : revokeError ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-danger-text">
                <AlertCircle size={15} /> {revokeError}
              </span>
            ) : confirmAll ? (
              <span className="font-medium text-fg">{tr(til, X.confirmAll)}</span>
            ) : (
              <span className="text-fg-4">{tr(til, X.currentUnaffected)}</span>
            )}
          </div>
          <div className={cn("flex gap-2", confirmAll ? "flex-col-reverse sm:flex-row" : undefined)}>
            {confirmAll ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setConfirmAll(false)} disabled={revoking}>
                  {tr(til, FORMA.cancel)}
                </Button>
                <Button type="button" variant="danger" onClick={logoutAll} disabled={revoking} className="sm:min-w-[200px]">
                  {revoking ? <Spinner /> : <LogOut size={15} />} {tr(til, X.yesLogoutAll)}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmAll(true)} className="sm:min-w-[260px]">
                <LogOut size={15} /> {tr(til, X.logoutAll)}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Kirish tarixi (audit) ---------- */}
      {initial.history && initial.history.length > 0 && (
        <section className="card m-flat p-5 sm:p-6" aria-labelledby="sec-history">
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
                <History size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span id="sec-history" className="block font-display text-[19px] font-semibold tracking-tight text-fg">
                  {tr(til, X.historyTitle)}
                </span>
                <span className="block text-[13px] text-fg-3">{X.historyDesc[til](initial.history.length)}</span>
              </span>
              <ChevronDown size={16} className="shrink-0 text-fg-3 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {initial.history.map((h) => {
                const m = LOGIN_EVENT_META[h.action] ?? { label: h.action };
                return (
                  <li key={h.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", m.bad ? "bg-danger" : "bg-success")} aria-hidden="true" />
                    <span className={cn("min-w-0 flex-1 truncate font-medium", m.bad ? "text-danger-text" : "text-fg")}>
                      {loginEventLabel(til, h.action, m.label)}
                      {h.twoFactor && <span className="font-normal text-fg-3"> · 2FA ({tr(til, h.twoFactor === "recovery" ? X.tfaRecovery : X.tfaApp)})</span>}
                    </span>
                    {h.ip && <span className="hidden shrink-0 font-mono text-[12px] text-fg-4 sm:inline">{h.ip}</span>}
                    <time dateTime={new Date(h.at).toISOString()} className="shrink-0 text-[12px] text-fg-3 tabular-nums" suppressHydrationWarning>
                      {formatDateTime(h.at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      )}

      {/* ---------- Xavfli zona ---------- */}
      <section className="card m-flat p-5 sm:p-6" aria-labelledby="sec-danger">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-danger-soft text-danger-text">
            <TriangleAlert size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="sec-danger" className="font-display text-[19px] font-semibold tracking-tight text-fg">
              {tr(til, X.dangerTitle)}
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, X.dangerDesc)}</p>
          </div>
        </div>

        {/* Eksport */}
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg">{tr(til, X.exportTitle)}</div>
            <div className="mt-0.5 text-[13px] text-fg-3" aria-live="polite">
              {exported ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 size={15} /> {tr(til, X.exported)}
                </span>
              ) : exportError ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-danger-text">
                  <AlertCircle size={15} /> {exportError}
                </span>
              ) : (
                tr(til, X.exportDesc)
              )}
            </div>
          </div>
          {!confirmExport && (
            <Button type="button" variant="outline" onClick={() => setConfirmExport(true)} className="sm:min-w-[200px]">
              <Download size={15} /> {tr(til, X.download)}
            </Button>
          )}
        </div>

        {confirmExport && !exported && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void exportData();
            }}
            noValidate
            className="mt-4 rounded-[18px] border border-line bg-surface p-4 sm:p-5"
          >
            <p className="text-[13px] font-medium text-fg">{tr(til, X.exportConfirm)}</p>
            {/* Format tanlovi (kamchilik #94): HTML — o'qiladigan hujjat, brauzerda ochilib chop etilsa PDF bo'ladi */}
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label={tr(til, X.formatAria)}>
              {(
                [
                  { v: "json", label: tr(til, X.formatJson) },
                  { v: "html", label: tr(til, X.formatHtml) },
                ] as const
              ).map((f) => (
                <button
                  key={f.v}
                  type="button"
                  role="radio"
                  aria-checked={exportFormat === f.v}
                  onClick={() => setExportFormat(f.v)}
                  className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition", exportFormat === f.v ? "border-fg bg-fg text-bg" : "border-line text-fg-2 hover:border-fg hover:text-fg")}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-3 sm:max-w-sm">
              <PasswordField
                id="sec-export-password"
                name="export-password"
                label={tr(til, X.password)}
                value={exportPassword}
                onChange={(v) => {
                  setExportPassword(v);
                  setExportError(null);
                }}
                autoComplete="current-password"
                placeholder={tr(til, X.currentPwPh)}
                error={exportError || undefined}
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirmExport(false);
                  setExportPassword("");
                  setExportError(null);
                }}
                disabled={exporting}
              >
                {tr(til, FORMA.cancel)}
              </Button>
              <Button type="submit" variant="outline" disabled={exporting} className="sm:min-w-[200px]">
                {exporting ? <Spinner /> : <Download size={15} />} {tr(til, X.download)}
              </Button>
            </div>
          </form>
        )}

        {/* O'chirish */}
        <div className="mt-5 border-t border-line pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-fg">{tr(til, X.deleteTitle)}</div>
              <div className="mt-0.5 text-[13px] text-fg-3">
                {tr(til, X.deleteDesc)}
              </div>
            </div>
            {!confirmDelete && !deleted && (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} className="sm:min-w-[200px]">
                <Trash2 size={15} /> {tr(til, X.deleteBtn)}
              </Button>
            )}
          </div>

          {deleted ? (
            <div role="status" className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-success-soft px-4 py-3 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={16} className="mt-px shrink-0" /> {tr(til, X.deleted)}
            </div>
          ) : (
            confirmDelete && (
              <form onSubmit={deleteAccount} noValidate className="mt-4 rounded-[18px] border border-danger/30 bg-danger-soft/40 p-4 sm:p-5">
                <p className="text-[13px] font-medium text-fg">{tr(til, X.deleteConfirm)}</p>
                <div className="mt-3 sm:max-w-sm">
                  <PasswordField
                    id="sec-delete-password"
                    name="delete-password"
                    label={tr(til, X.password)}
                    value={deletePassword}
                    onChange={(v) => {
                      setDeletePassword(v);
                      setDeleteError(null);
                    }}
                    autoComplete="current-password"
                    placeholder={tr(til, X.currentPwPh)}
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
                    {tr(til, FORMA.cancel)}
                  </Button>
                  <Button type="submit" variant="danger" disabled={deleting} className="sm:min-w-[200px]">
                    {deleting ? <Spinner /> : <Trash2 size={15} />} {tr(til, FORMA.yes)}
                  </Button>
                </div>
              </form>
            )
          )}
        </div>
      </section>

      {/* ---------- Maslahatlar (yig'ilgan) ---------- */}
      <details className="card-outline group p-4 sm:p-5">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span id="sec-tips" className="eyebrow">
            {tr(til, X.tipsTitle)}
          </span>
          <ChevronDown size={16} className="shrink-0 text-fg-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {TIPS.map((t) => (
            <li key={t.title.uz} className="flex items-start gap-3">
              <t.icon size={16} className="mt-0.5 shrink-0 text-fg-3" aria-hidden="true" />
              <span>
                <span className="block text-[13.5px] font-semibold text-fg">{tr(til, t.title)}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{tr(til, t.text)}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
