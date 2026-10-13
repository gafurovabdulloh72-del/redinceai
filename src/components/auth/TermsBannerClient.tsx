"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, FileCheck2, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

type ApiResponse = { ok: true; data: { accepted: boolean } } | { ok: false; error: string };

/**
 * Yangilangan oferta/maxfiylik siyosati haqida bloklamaydigan banner. «Roziman» — POST /api/account/terms.
 * «Keyinroq» faqat shu sahifa uchun yashiradi (keyingi sahifada yana chiqadi, toki qabul qilinmaguncha).
 */
export function TermsBannerClient({ version, firstTime }: { version: string; firstTime: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (hidden) return null;

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/terms", { method: "POST" });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!json || !json.ok) {
        setError(json && !json.ok ? json.error : "Serverda kutilmagan xatolik");
        return;
      }
      setHidden(true);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section role="region" aria-labelledby="terms-banner-title" className="card-outline mb-5 flex flex-col gap-3 !rounded-[16px] px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent-text">
          <FileCheck2 size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p id="terms-banner-title" className="text-[14px] font-semibold text-fg">
            {firstTime ? "Foydalanish shartlari bilan tanishing" : "Foydalanish shartlari yangilandi"}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-3">
            <Link href="/oferta" className="font-semibold text-accent-text underline underline-offset-2">
              Oferta
            </Link>{" "}
            va{" "}
            <Link href="/maxfiylik" className="font-semibold text-accent-text underline underline-offset-2">
              Maxfiylik siyosati
            </Link>{" "}
            <span className="whitespace-nowrap">(versiya {version})</span> — mutaxassislar obunasi, eskrou va ma&apos;lumotlar saqlanishi haqida.
          </p>
          {error && (
            <p role="alert" className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ios-red">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        <Button type="button" variant="primary" onClick={accept} disabled={busy} className="flex-1 sm:flex-none sm:min-w-[120px]">
          {busy ? <Spinner /> : "Roziman"}
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setHidden(true)} aria-label="Keyinroq eslatish" title="Keyinroq">
          <X size={18} />
        </Button>
      </div>
    </section>
  );
}
