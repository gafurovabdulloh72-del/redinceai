"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui";
import { APPLICATION_STATUS, APPLICATION_TONE, RESUME_EXPERIENCE, professionLabel, salaryLabel, type ApplicationStatus } from "@/lib/vacancies/format";
import type { ApplicantView } from "@/lib/vacancies/service";
import { cn, timeAgo } from "@/lib/utils";

const TONE: Record<string, string> = {
  neutral: "bg-fg/6 text-fg-2",
  info: "bg-info-soft text-info-text",
  accent: "bg-accent-soft text-accent-text",
  danger: "bg-danger-soft text-danger-text",
  success: "bg-success-soft text-success-text",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-bold", TONE[APPLICATION_TONE[status]])}>{APPLICATION_STATUS[status]}</span>;
}

/**
 * Nomzodlar ro'yxati (ish beruvchi): kontakt (nomzod ariza bilan rozilik bergan), rezyume, xat, holat amallari.
 * Ochilganda "yangi" arizalar avtomatik "ko'rildi" bo'ladi — nomzod kabinetida ko'radi.
 */
export function ApplicantsList({ vacancyId, initial }: { vacancyId: string; initial: ApplicantView[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fresh = initial.filter((a) => a.status === "new");
    if (!fresh.length) return;
    void Promise.all(fresh.map((a) => fetch(`/api/arizalar/${encodeURIComponent(a.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "viewed" }) }).catch(() => undefined))).then(() =>
      setItems((prev) => prev.map((a) => (a.status === "new" ? { ...a, status: "viewed" } : a))),
    );
  }, [initial]);

  async function setStatus(id: string, status: ApplicationStatus) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/arizalar/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Bajarilmadi");
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bajarilmadi");
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Hali ariza yo&apos;q. Vakansiyani jamoalarda va Telegramda ulashing — havola: /vakansiyalar/{vacancyId}</p>;

  return (
    <ul className="grid gap-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-[16px] border border-line p-4">
          <div className="flex flex-wrap items-start gap-3">
            <Avatar name={a.user.name} src={a.user.avatarUrl} size={44} decorative />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-fg">{a.user.name}</p>
                <StatusBadge status={a.status} />
                <span className="text-[12px] text-fg-4" suppressHydrationWarning>
                  {timeAgo(a.createdAt)}
                </span>
              </div>
              {a.resume ? (
                <p className="mt-0.5 text-[13px] text-fg-2">
                  {a.resume.title} · {professionLabel(a.resume.profession, true)} · {RESUME_EXPERIENCE[a.resume.experience]} · {salaryLabel(a.resume.expectedSalary, null)}
                </p>
              ) : (
                <p className="mt-0.5 text-[13px] text-fg-3">Rezyumesiz — faqat xat</p>
              )}
              {/* Kontakt: nomzod ariza yuborish bilan shu ish beruvchiga ochgan */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <a href={`mailto:${a.user.email}`} className="inline-flex items-center gap-1 font-semibold text-fg underline-offset-2 hover:underline">
                  <Mail size={13} className="text-fg-3" /> {a.user.email}
                </a>
                {a.user.phone && (
                  <a href={`tel:${a.user.phone}`} className="inline-flex items-center gap-1 font-semibold text-fg underline-offset-2 hover:underline">
                    <Phone size={13} className="text-fg-3" /> {a.user.phone}
                  </a>
                )}
                {a.user.username && (
                  <Link href={`/yozish/${a.user.username}`} className="inline-flex items-center gap-1 text-fg-2 hover:text-fg">
                    <MessageCircle size={13} /> Chatda yozish
                  </Link>
                )}
                {a.user.specialistSlug && (
                  <Link href={`/mutaxassislar/${a.user.specialistSlug}`} className="inline-flex items-center gap-1 text-fg-2 hover:text-fg">
                    <UserRound size={13} /> Profil
                  </Link>
                )}
                {a.resume && (
                  <Link href={`/rezyumelar/${a.resume.id}`} className="inline-flex items-center gap-1 text-fg-2 hover:text-fg">
                    <ExternalLink size={13} /> Rezyume
                  </Link>
                )}
              </div>
            </div>
          </div>
          {a.coverLetter && <p className="mt-3 whitespace-pre-wrap rounded-[12px] bg-fg/4 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg">{a.coverLetter}</p>}
          {a.resume && a.resume.skills.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {a.resume.skills.map((s) => (
                <li key={s} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-fg-2">
                  {s}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            {(["shortlisted", "hired", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy === a.id || a.status === s}
                onClick={() => void setStatus(a.id, s)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold transition disabled:opacity-50",
                  s === "rejected" ? "border-line-2 text-fg-3 hover:border-danger/40 hover:text-danger-text" : s === "hired" ? "border-success/40 text-success-text hover:bg-success-soft" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg",
                )}
              >
                {s === "shortlisted" ? "Tanlovga" : s === "hired" ? "Ishga olindi" : "Rad etish"}
              </button>
            ))}
            {error && busy === null && <span className="text-[12px] text-danger-text">{error}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
