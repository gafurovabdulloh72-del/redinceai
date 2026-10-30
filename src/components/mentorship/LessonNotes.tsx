"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { LESSON_SEEK_EVENT, LESSON_VIDEO_ATTR } from "./LessonPlayer";

type Note = { id: string; atSec: number; body: string; createdAt: number };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Pleyerdagi joriy soniya — LessonPlayer `data-lesson-video` bilan belgilaydi */
function currentSec(): number {
  const v = document.querySelector<HTMLVideoElement>(`[${LESSON_VIDEO_ATTR}]`);
  return v && Number.isFinite(v.currentTime) ? Math.floor(v.currentTime) : 0;
}

/**
 * Dars eslatmalari (Udemy «Notes»): talaba videoning ayni joyiga shaxsiy qayd yozadi — vaqt belgisi bosilsa
 * pleyer shu joyga o'tadi. Faqat o'ziga ko'rinadi (ustoz ham ko'rmaydi).
 */
export function LessonNotes({ lessonId, hasVideo }: { lessonId: string; hasVideo: boolean }) {
  const [items, setItems] = useState<Note[] | null>(null);
  const [text, setText] = useState("");
  const [at, setAt] = useState<number | null>(null); // yozish boshlanganda qotirilgan vaqt
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/mentorlik/darslar/${lessonId}/eslatmalar`, { cache: "no-store" });
      const j = (await r.json()) as { data?: { items: Note[] } };
      setItems(j.data?.items ?? []);
    } catch {
      setItems([]);
    }
  }, [lessonId]);
  useEffect(() => {
    void load();
  }, [load]);

  function startAtNow() {
    if (hasVideo) setAt(currentSec());
  }
  async function add() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const atSec = at ?? (hasVideo ? currentSec() : 0);
      const r = await fetch(`/api/mentorlik/darslar/${lessonId}/eslatmalar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, atSec }) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Saqlanmadi");
      setText("");
      setAt(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setItems((s) => (s ? s.filter((n) => n.id !== id) : s));
    await fetch(`/api/mentorlik/eslatmalar/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
  function seek(sec: number) {
    window.dispatchEvent(new CustomEvent(LESSON_SEEK_EVENT, { detail: { sec } }));
    document.querySelector(`[${LESSON_VIDEO_ATTR}]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!items) return <div className="grid h-16 place-items-center"><Loader2 className="animate-spin text-fg-3" /></div>;

  return (
    <section>
      <h2 className="sr-only">Eslatmalar</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="rounded-[14px] border border-line p-3"
      >
        <div className="flex items-center gap-2">
          {hasVideo && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-fg/6 px-2.5 text-[12px] font-semibold tabular-nums text-fg-2">
              <Clock size={12} /> {fmt(at ?? 0)}
            </span>
          )}
          <span className="text-[12.5px] text-fg-3">{hasVideo ? "Yozish boshlanganda videodagi vaqt saqlanadi" : "Shaxsiy qayd — faqat sizga ko'rinadi"}</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => at === null && startAtNow()}
          maxLength={2000}
          rows={2}
          placeholder="Eslatma yozing…"
          aria-label="Eslatma"
          className="field mt-2 min-h-[64px] w-full resize-y text-[14px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11.5px] tabular-nums text-fg-4">{text.length}/2000</span>
          <button type="submit" disabled={busy || !text.trim()} className="btn-ink inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
            <Plus size={14} /> Saqlash
          </button>
        </div>
      </form>

      <ul className="mt-4 divide-y divide-line">
        {items.length === 0 && <li className="py-4 text-[13.5px] text-fg-3">Hali eslatma yo&apos;q. Videoni ko&apos;rayotib muhim joylarni yozib boring — vaqt belgisi bilan saqlanadi.</li>}
        {items.map((n) => (
          <li key={n.id} className="group flex gap-3 py-3">
            {hasVideo ? (
              <button type="button" onClick={() => seek(n.atSec)} aria-label={`${fmt(n.atSec)} ga o'tish`} className="h-7 shrink-0 rounded-md bg-fg px-2 text-[12px] font-bold tabular-nums text-bg transition hover:bg-fg/85">
                {fmt(n.atSec)}
              </button>
            ) : (
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fg/30" aria-hidden />
            )}
            <p className={cn("min-w-0 flex-1 whitespace-pre-line text-[14px] leading-relaxed text-fg-2")}>{n.body}</p>
            <button type="button" onClick={() => void remove(n.id)} aria-label="Eslatmani o'chirish" className="h-7 w-7 shrink-0 rounded-full text-fg-4 transition hover:bg-fg/6 hover:text-danger">
              <Trash2 size={14} className="mx-auto" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
