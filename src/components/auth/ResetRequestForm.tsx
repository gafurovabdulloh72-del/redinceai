"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type ApiResponse = { ok: true; data: { requested: boolean } } | { ok: false; error: string; fields?: Record<string, string> };

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setFieldError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError("Email noto'g'ri");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!json || !json.ok) {
        if (res.status === 429) {
          const retry = Number(res.headers.get("Retry-After") || 0);
          setError(retry > 0 ? `Juda ko'p so'rov. ${Math.ceil(retry / 60)} daqiqadan keyin qayta urinib ko'ring.` : (json?.error ?? "Juda ko'p so'rov"));
        } else setError(json?.error ?? "Serverda kutilmagan xatolik");
        if (json && !json.ok && json.fields?.email) setFieldError(json.fields.email);
        return;
      }
      setDone(true);
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="animate-fade-up" role="status">
        <span className="eyebrow">Parolni tiklash</span>
        <div className="mt-6 flex items-start gap-4">
          <span className="btn-ink flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]">
            <MailCheck size={22} />
          </span>
          <div>
            <h1 className="font-display text-[24px] font-semibold leading-tight text-fg">Xatni tekshiring</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
              Agar <span className="font-semibold text-fg">{email.trim()}</span> bizda ro'yxatdan o'tgan bo'lsa, unga parolni tiklash havolasi yuborildi. Havola 1 soat amal qiladi.
            </p>
            <p className="mt-3 text-[13px] text-fg-3">Xat kelmadimi? «Spam» papkasini tekshiring yoki bir necha daqiqadan so'ng qayta so'rang.</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setDone(false)}>
            Boshqa email kiritish
          </Button>
          <Link href="/auth/kirish" className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold text-fg-2 transition hover:text-fg">
            <ArrowLeft size={15} /> Kirish sahifasiga
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <span className="eyebrow">Parolni tiklash</span>
        <h1 className="display-xl mt-4 text-[30px] text-fg sm:text-[36px]">
          Parolni <span className="accent-serif text-accent">unutdingizmi?</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-2">Hisobingiz emailini kiriting — yangi parol o'rnatish havolasini yuboramiz.</p>
      </header>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="field-label">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="siz@misol.uz"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(null);
            }}
            className={cn("field", fieldError && "!border-ios-red/60")}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "reset-email-error" : undefined}
            autoFocus
          />
          {fieldError && (
            <p id="reset-email-error" className="field-error">
              {fieldError}
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[16px] bg-ios-red/10 px-4 py-3 text-[13px] font-medium text-ios-red">
            <AlertCircle size={16} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="accent" size="lg" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Spinner /> Yuborilmoqda…
            </>
          ) : (
            <>
              Havola yuborish <ArrowRight size={18} />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-fg-2">
        Esladingizmi?{" "}
        <Link href="/auth/kirish" className="font-semibold text-accent transition hover:brightness-110">
          Kirish
        </Link>
      </p>
    </div>
  );
}
