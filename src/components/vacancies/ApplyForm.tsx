"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileUser, Send } from "lucide-react";
import { Button } from "@/components/ui";
import { APPLICATION_STATUS, COVER_LETTER_MAX, COVER_LETTER_MIN, type ApplicationStatus } from "@/lib/vacancies/format";

type Mine = { id: string; status: ApplicationStatus; createdAt: number } | null;

/**
 * Ariza yuborish: rezyume bo'lsa — biriktiriladi (xat ixtiyoriy), bo'lmasa — qisqa xat majburiy.
 * Nomzodga aniq aytiladi: ariza bilan uning ism, email va telefoni shu ish beruvchiga ochiladi.
 */
export function ApplyForm({ vacancyId, loggedIn, hasResume, resumeTitle, initialMine, applyUrl }: { vacancyId: string; loggedIn: boolean; hasResume: boolean; resumeTitle?: string | null; initialMine: Mine; applyUrl: string | null }) {
  const router = useRouter();
  const [mine, setMine] = useState<Mine>(initialMine);
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needLetter = !hasResume;
  const canSend = !busy && (!needLetter || letter.trim().length >= COVER_LETTER_MIN);

  async function apply() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/ariza`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverLetter: letter.trim() }) });
      const j = (await res.json()) as { ok: boolean; data?: { id: string; status: ApplicationStatus }; error?: string; fields?: Record<string, string> };
      if (!res.ok || !j.ok || !j.data) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
      setMine({ id: j.data.id, status: j.data.status, createdAt: Date.now() });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!mine || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/arizalar/${encodeURIComponent(mine.id)}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Qaytarib bo'lmadi");
      setMine(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Qaytarib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  /** Tashqi forma bosildi — egasi uchun hisoblagich (javob kutilmaydi) */
  function countExternal() {
    const url = `/api/vakansiyalar/${encodeURIComponent(vacancyId)}/tashqi`;
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
  }

  if (!loggedIn) {
    return (
      <div className="card p-5">
        <p className="text-[15px] font-semibold text-fg">Ariza yuborish uchun kiring</p>
        <p className="mt-1 text-[13px] text-fg-3">Bepul hisob oching — rezyume to&apos;ldiring va bir bosishda ariza yuboring.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/auth/kirish?next=${encodeURIComponent(`/vakansiyalar/${vacancyId}`)}`} className="btn-ink inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold">
            Kirish
          </Link>
          <Link href={`/auth/royxat?next=${encodeURIComponent(`/vakansiyalar/${vacancyId}`)}`} className="inline-flex h-11 items-center rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </div>
      </div>
    );
  }

  if (mine) {
    return (
      <div className="card expand-in p-5">
        <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-success-text">
          <CheckCircle2 size={18} className="animate-pop" /> Arizangiz yuborilgan
        </p>
        <p className="mt-1 text-[13px] text-fg-2">
          Holati: <strong className="text-fg">{APPLICATION_STATUS[mine.status]}</strong>. Ish beruvchi javobi bildirishnomaga va «Arizalarim» bo&apos;limiga keladi.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href="/kabinet/arizalarim" className="inline-flex h-10 items-center rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg">
            Arizalarim
          </Link>
          {(mine.status === "new" || mine.status === "viewed") && (
            <button type="button" onClick={withdraw} disabled={busy} className="press text-[13px] font-semibold text-fg-3 underline-offset-2 hover:text-danger-text hover:underline disabled:opacity-50">
              Arizani qaytarib olish
            </button>
          )}
          {error && (
            <span role="alert" className="basis-full text-[12.5px] text-danger-text">
              {error}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="text-[15px] font-semibold text-fg">Ariza yuborish</p>
      <div className={`mt-3 flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[13px] ${hasResume ? "bg-success-soft text-fg" : "bg-warning-soft text-fg"}`}>
        <FileUser size={16} className="mt-0.5 shrink-0" />
        {hasResume ? (
          <span>
            Rezyumeingiz biriktiriladi: <strong>{resumeTitle}</strong>.{" "}
            <Link href="/kabinet/rezyume" className="underline underline-offset-2">
              Yangilash
            </Link>
          </span>
        ) : (
          <span>
            Rezyumeingiz yo&apos;q —{" "}
            <Link href="/kabinet/rezyume" className="font-semibold underline underline-offset-2">
              2 daqiqada to&apos;ldiring
            </Link>{" "}
            yoki quyida qisqacha o&apos;zingiz haqingizda yozing (kamida {COVER_LETTER_MIN} belgi).
          </span>
        )}
      </div>
      <textarea
        value={letter}
        onChange={(e) => setLetter(e.target.value)}
        maxLength={COVER_LETTER_MAX}
        rows={4}
        placeholder={hasResume ? "Qisqa xat (ixtiyoriy): nega aynan siz, qachondan boshlay olasiz…" : "Tajribangiz, ko'nikmalaringiz, portfolio havolasi…"}
        className="field mt-3 w-full resize-y py-2.5 text-[14px] leading-relaxed"
      />
      <div className="mt-1 flex justify-between text-[11.5px] text-fg-4">
        <span>{needLetter && letter.trim().length < COVER_LETTER_MIN ? `Yana ${COVER_LETTER_MIN - letter.trim().length} ta belgi` : ""}</span>
        <span>
          {letter.length}/{COVER_LETTER_MAX}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-fg-3">Ism, email va telefoningiz faqat shu ish beruvchiga ko&apos;rinadi.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="accent" size="md" onClick={apply} disabled={!canSend}>
          <Send size={15} /> {busy ? "Yuborilmoqda…" : "Ariza yuborish"}
        </Button>
        {applyUrl && (
          <a href={applyUrl} target="_blank" rel="noopener noreferrer" onClick={countExternal} className="press inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:text-fg">
            Tashqi forma <ExternalLink size={14} />
          </a>
        )}
        {error && (
          <span role="alert" className="basis-full text-[13px] font-semibold text-danger-text">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
