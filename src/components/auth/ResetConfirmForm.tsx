"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, LinkIcon } from "lucide-react";
import { PasswordField } from "./PasswordField";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { passwordStrength } from "@/lib/security/password-strength";

type ApiResponse = { ok: true; data: { reset: boolean; name: string; requiresLogin?: boolean } } | { ok: false; error: string; fields?: Record<string, string> };

export function ResetConfirmForm({ token, initiallyValid }: { token: string; initiallyValid: boolean }) {
  const til = useLocale();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  /** 2FA yoqilgan — avtomatik kirilmaydi, kirish sahifasida kod bilan kiradi */
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (!initiallyValid) {
    return (
      <div className="animate-fade-up">
        <span className="eyebrow">{tr(til, AUTH.reset.eyebrow)}</span>
        <div className="mt-6 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-ios-red/10 text-ios-red">
            <LinkIcon size={22} />
          </span>
          <div>
            <h1 className="font-display text-[24px] font-semibold leading-tight text-fg">{tr(til, AUTH.resetConfirm.linkExpiredTitle)}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{tr(til, AUTH.resetConfirm.linkExpiredText)}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/auth/parol-tiklash" className="btn-accent inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold">
            {tr(til, AUTH.resetConfirm.requestNew)} <ArrowRight size={16} />
          </Link>
          <Link href="/auth/kirish" className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[14px] font-semibold text-fg-2 transition hover:text-fg">
            {tr(til, AUTH.reset.toLoginPage)}
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const errs: Record<string, string> = {};
    const s = passwordStrength(password);
    if (!s.valid) errs.newPassword = tr(til, password.length < 8 ? AUTH.errors.passwordShort : AUTH.errors.passwordWeak);
    if (confirm !== password) errs.confirm = tr(til, AUTH.resetConfirm.mismatch);
    if (Object.keys(errs).length) {
      setFields(errs);
      return;
    }
    setFields({});
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!json || !json.ok) {
        setError(json?.error ?? tr(til, AUTH.errors.server));
        if (json && !json.ok && json.fields) setFields(json.fields);
        setLoading(false);
        return;
      }
      setDone(true);
      const needs = Boolean(json.data.requiresLogin);
      setNeedsLogin(needs);
      window.setTimeout(() => {
        router.push(needs ? "/auth/kirish" : "/kabinet");
        router.refresh();
      }, needs ? 2200 : 1200);
    } catch {
      setError(tr(til, AUTH.errors.network));
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="animate-fade-up flex items-start gap-4" role="status">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-ios-green/14 text-[#15803d] dark:text-ios-green">
          <CheckCircle2 size={22} />
        </span>
        <div>
          <h1 className="font-display text-[24px] font-semibold leading-tight text-fg">{tr(til, AUTH.resetConfirm.doneTitle)}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{tr(til, needsLogin ? AUTH.resetConfirm.doneNeedsLogin : AUTH.resetConfirm.doneAuto)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <span className="eyebrow">{tr(til, AUTH.reset.eyebrow)}</span>
        <h1 className="display-xl mt-4 text-[30px] text-fg sm:text-[36px]">
          {tr(til, AUTH.resetConfirm.titleA)}
          <span className="accent-serif text-accent">{tr(til, AUTH.resetConfirm.titleAccent)}</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{tr(til, AUTH.resetConfirm.lead)}</p>
      </header>

      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordField
          id="reset-password"
          name="new-password"
          label={tr(til, AUTH.resetConfirm.newPassword)}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setFields((f) => ({ ...f, newPassword: "" }));
          }}
          autoComplete="new-password"
          placeholder={tr(til, AUTH.fields.passwordPlaceholderNew)}
          error={fields.newPassword || undefined}
          meter
        />
        <PasswordField
          id="reset-confirm"
          name="confirm-password"
          label={tr(til, AUTH.resetConfirm.repeatPassword)}
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setFields((f) => ({ ...f, confirm: "" }));
          }}
          autoComplete="new-password"
          placeholder={tr(til, AUTH.resetConfirm.repeatPlaceholder)}
          error={fields.confirm || undefined}
        />

        {error && (
          <div role="alert" className="expand-in flex items-start gap-2.5 rounded-[14px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
            <AlertCircle size={16} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Spinner /> {tr(til, AUTH.resetConfirm.saving)}
            </>
          ) : (
            <>
              {tr(til, AUTH.resetConfirm.save)} <ArrowRight size={18} />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
