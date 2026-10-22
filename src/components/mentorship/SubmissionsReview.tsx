"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime } from "@/lib/utils";

export type SubItem = { id: string; student: string; course: string; lesson: string; prompt: string; body: string; fileUrl: string | null; status: "pending" | "reviewed" | "needs_work"; grade: number | null; feedback: string; showcase: boolean; createdAt: number };

/** Mentor: talabalar topshirgan uy vazifalari — baholash, qayta ishlashga qaytarish, «Talabalar ishi»ga chiqarish */
export function SubmissionsReview({ items }: { items: SubItem[] }) {
  if (!items.length) return <p className="card p-6 text-center text-[14px] text-fg-3">Baholanmagan vazifa yo&apos;q. Darsga «Uy vazifasi» qo&apos;shsangiz, talabalar ishi shu yerga tushadi.</p>;
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <Item key={s.id} s={s} />
      ))}
    </ul>
  );
}

function Item({ s }: { s: SubItem }) {
  const router = useRouter();
  const [grade, setGrade] = useState(s.grade != null ? String(s.grade) : "");
  const [feedback, setFeedback] = useState(s.feedback);
  const [showcase, setShowcase] = useState(s.showcase);
  const [busy, setBusy] = useState<string | null>(null);

  async function review(status: "reviewed" | "needs_work") {
    setBusy(status);
    try {
      const r = await fetch(`/api/mentorlik/vazifalar/${s.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, grade: grade ? Math.min(100, Number(grade)) : null, feedback, showcase }) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Xatolik");
      showToast(status === "reviewed" ? "Baholandi" : "Qayta ishlashga qaytarildi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="card p-4">
      <p className="text-[12px] text-fg-3">{s.course} · {s.lesson} · {formatDateTime(s.createdAt)}</p>
      <p className="mt-0.5 text-[15px] font-bold text-fg">{s.student}</p>
      {s.prompt && <p className="mt-1 text-[12.5px] italic text-fg-3">Topshiriq: {s.prompt}</p>}
      {s.body && <p className="mt-2 whitespace-pre-line text-[14px] text-fg-2">{s.body}</p>}
      {s.fileUrl && (
        <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-text hover:underline">
          <Paperclip size={14} /> Biriktirilgan faylni ochish
        </a>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[90px_1fr]">
        <input value={grade} onChange={(e) => setGrade(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Baho /100" aria-label="Baho" className="field h-10 text-[14px]" />
        <input value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1500} placeholder="Izoh (ixtiyoriy)" aria-label="Izoh" className="field h-10 text-[14px]" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="mr-auto flex items-center gap-1.5 text-[13px] font-medium text-fg-2">
          <input type="checkbox" checked={showcase} onChange={(e) => setShowcase(e.target.checked)} /> «Talabalar ishi»da ko&apos;rsatish
        </label>
        <button type="button" disabled={busy !== null} onClick={() => void review("needs_work")} className={cn("h-10 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:text-fg")}>
          {busy === "needs_work" ? <Loader2 size={14} className="animate-spin" /> : "Qayta ishlash"}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void review("reviewed")} className="btn-accent inline-flex h-10 items-center gap-1.5 px-5 text-[13.5px] font-semibold">
          {busy === "reviewed" && <Loader2 size={14} className="animate-spin" />} Baholash
        </button>
      </div>
    </li>
  );
}
