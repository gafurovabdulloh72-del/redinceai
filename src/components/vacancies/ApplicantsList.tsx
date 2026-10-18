"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Download } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { APPLICATION_STATUS, APPLICATION_TONE, RESUME_EXPERIENCE, professionLabel, salaryLabel, slaHint, type ApplicationStatus } from "@/lib/vacancies/format";
import type { ApplicantView } from "@/lib/vacancies/service";
import { cn, formatUzPhone, timeAgo } from "@/lib/utils";

/** Ariza holati belgisi — umumiy Badge; holat o'zgarganda qayta chiziladi (badge-pop) */
export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge key={status} tone={APPLICATION_TONE[status]} className={cn("animate-badge-pop", className)}>
      {APPLICATION_STATUS[status]}
    </Badge>
  );
}

type Tab = "all" | ApplicationStatus;
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "Barchasi" },
  { key: "new", label: "Yangi" },
  { key: "viewed", label: "Ko'rildi" },
  { key: "shortlisted", label: "Tanlovda" },
  { key: "hired", label: "Qabul" },
  { key: "rejected", label: "Rad" },
];

const ACTIONS: Array<{ status: ApplicationStatus; label: string; cls: string }> = [
  { status: "shortlisted", label: "Tanlovga", cls: "border-line-2 text-fg-2 hover:border-fg hover:text-fg" },
  { status: "hired", label: "Ishga olindi", cls: "border-success/40 text-success-text hover:bg-success-soft" },
  { status: "rejected", label: "Rad etish", cls: "border-line-2 text-fg-3 hover:border-danger/40 hover:text-danger-text" },
];

type PatchResp = { ok: boolean; error?: string; data?: { status: ApplicationStatus; employerNote: string } };
async function patchApplication(id: string, body: Record<string, unknown>): Promise<PatchResp> {
  const res = await fetch(`/api/arizalar/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({ ok: false }))) as PatchResp;
  if (!res.ok || !j.ok) throw new Error(j.error || "Bajarilmadi");
  return j;
}

/**
 * Nomzodlar ro'yxati (ish beruvchi): holat bo'limlari, kontakt (nomzod ariza bilan rozilik bergan), rezyume, xat,
 * shaxsiy eslatma, CSV eksporti. Ochilganda "yangi" arizalar avtomatik "ko'rildi" bo'ladi — nomzod kabinetida ko'radi.
 */
export function ApplicantsList({ vacancyId, initial, vacancyOpen = true }: { vacancyId: string; initial: ApplicantView[]; vacancyOpen?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** «Ishga olindi» dan keyin vakansiyani yopish taklifi */
  const [askClose, setAskClose] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const fresh = initial.filter((a) => a.status === "new");
    if (!fresh.length) return;
    void Promise.all(fresh.map((a) => patchApplication(a.id, { status: "viewed" }).catch(() => undefined))).then(() =>
      setItems((prev) => prev.map((a) => (a.status === "new" ? { ...a, status: "viewed", viewedAt: a.viewedAt ?? Date.now() } : a))),
    );
  }, [initial]);

  async function setStatus(id: string, status: ApplicationStatus) {
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      await patchApplication(id, { status });
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      if (status === "hired" && vacancyOpen) setAskClose(true);
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Bajarilmadi" }));
    } finally {
      setBusy(null);
    }
  }

  async function saveNote(id: string, note: string) {
    try {
      await patchApplication(id, { note });
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, employerNote: note } : a)));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Eslatma saqlanmadi" }));
    }
  }

  async function closeVacancy() {
    setClosing(true);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
      if (!res.ok) throw new Error();
      toast("Vakansiya yopildi", "success");
      setAskClose(false);
      router.refresh();
    } catch {
      toast("Yopib bo'lmadi", "error");
    } finally {
      setClosing(false);
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/vakansiyalar/${vacancyId}`);
      toast("Havola nusxalandi", "info");
    } catch {
      toast("Nusxalab bo'lmadi", "error");
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">
        <p>Hali ariza yo&apos;q. Vakansiya havolasini jamoalarda va Telegramda ulashing.</p>
        <button type="button" onClick={copyLink} className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg">
          <Copy size={13} /> Havolani nusxalash
        </button>
      </div>
    );
  }

  const counts = items.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});
  const list = tab === "all" ? items : items.filter((a) => a.status === tab);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segment max-w-full overflow-x-auto no-scrollbar" role="tablist" aria-label="Arizalar holati">
          {TABS.map((t) => {
            const n = t.key === "all" ? items.length : (counts[t.key] ?? 0);
            if (t.key !== "all" && n === 0) return null;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-active={tab === t.key} onClick={() => setTab(t.key)} className="segment-item inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap">
                {t.label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <a href={`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/ariza?format=csv`} className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg" download>
          <Download size={13} /> CSV
        </a>
      </div>

      {askClose && (
        <div role="status" className="expand-in flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-[13px] text-fg">
          <span className="font-semibold">Nomzod tanlandi — vakansiyani yopasizmi?</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={closeVacancy} disabled={closing} className="press btn-ink inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-50">
              <Check size={13} /> Ha, yopish
            </button>
            <button type="button" onClick={() => setAskClose(false)} className="press inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
              Hozircha ochiq qolsin
            </button>
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-3">Bu bo&apos;limda ariza yo&apos;q.</p>
      ) : (
        <ul className="stagger grid gap-3">
          {list.map((a) => (
            <ApplicantItem key={a.id} a={a} busy={busy === a.id} error={errors[a.id]} onStatus={(s) => void setStatus(a.id, s)} onNote={(n) => void saveNote(a.id, n)} />
          ))}
        </ul>
      )}
    </div>
  );
}

const MAX_SKILLS = 6;

function ApplicantItem({ a, busy, error, onStatus, onNote }: { a: ApplicantView; busy: boolean; error?: string; onStatus: (s: ApplicationStatus) => void; onNote: (note: string) => void }) {
  const [noteOpen, setNoteOpen] = useState(Boolean(a.employerNote));
  const [note, setNote] = useState(a.employerNote);
  const waiting = slaHint(a.status, a.createdAt);
  const extra = a.resume ? a.resume.skills.length - MAX_SKILLS : 0;
  return (
    <li className="min-w-0 rounded-[14px] border border-line p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={a.user.name} src={a.user.avatarUrl} size={40} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-fg">{a.user.name}</p>
            <StatusBadge status={a.status} />
            <span className="text-[12px] text-fg-4" suppressHydrationWarning>
              {timeAgo(a.createdAt)}
            </span>
            {waiting && <span className="text-[12px] font-semibold text-warning-text">{waiting}</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-fg-2">
            {a.resume ? `${a.resume.title} · ${professionLabel(a.resume.profession, true)} · ${RESUME_EXPERIENCE[a.resume.experience]} · ${salaryLabel(a.resume.expectedSalary, null)}` : "Rezyumesiz — faqat xat"}
          </p>
          {/* Kontakt: nomzod ariza yuborish bilan shu ish beruvchiga ochgan */}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <a href={`mailto:${a.user.email}`} className="break-all font-semibold text-fg underline-offset-2 hover:underline">
              {a.user.email}
            </a>
            {a.user.phone && (
              <a href={`tel:${a.user.phone}`} className="whitespace-nowrap font-semibold text-fg underline-offset-2 hover:underline">
                {formatUzPhone(a.user.phone)}
              </a>
            )}
            {a.user.username && (
              <Link href={`/yozish/${a.user.username}`} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                Chatda yozish
              </Link>
            )}
            {a.resume && (
              <Link href={`/rezyumelar/${a.resume.id}`} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                Rezyume
              </Link>
            )}
            {a.user.specialistSlug && (
              <Link href={`/mutaxassislar/${a.user.specialistSlug}`} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                Profil
              </Link>
            )}
          </div>
        </div>
      </div>
      {a.coverLetter && <p className="mt-3 whitespace-pre-wrap break-words rounded-[10px] bg-fg/4 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg">{a.coverLetter}</p>}
      {a.resume && a.resume.skills.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Ko'nikmalar">
          {a.resume.skills.slice(0, MAX_SKILLS).map((s) => (
            <li key={s} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-fg-2">
              {s}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 text-[11.5px] font-medium text-fg-3">+{extra}</li>}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {ACTIONS.map((act) => (
          <button
            key={act.status}
            type="button"
            disabled={busy || a.status === act.status}
            onClick={() => onStatus(act.status)}
            className={cn("press inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold transition disabled:opacity-50", act.cls)}
          >
            {act.label}
          </button>
        ))}
        <button type="button" onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen} className="press ml-auto inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold text-fg-3 hover:text-fg">
          {a.employerNote ? "Eslatma" : "+ Eslatma"}
        </button>
        {error && (
          <span role="alert" className="basis-full text-[12px] text-danger-text">
            {error}
          </span>
        )}
      </div>
      {noteOpen && (
        <label className="expand-in mt-2 block">
          <span className="sr-only">Shaxsiy eslatma</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== a.employerNote && onNote(note.trim())}
            maxLength={500}
            rows={2}
            placeholder="Faqat sizga ko'rinadi: suhbat vaqti, taassurot…"
            className="field w-full resize-y py-2 text-[13px]"
          />
        </label>
      )}
    </li>
  );
}
