"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CornerDownRight, Loader2, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

type C = { id: string; parentId: string | null; body: string; createdAt: number; helpful: boolean; name: string; avatarUrl: string | null; isMentor: boolean; mine: boolean };

/** Dars ostidagi savol-javob: talaba savol beradi, ustoz/talabalar javob beradi, ustoz «foydali» deb belgilaydi */
export function LessonQA({ lessonId, isMentor }: { lessonId: string; isMentor: boolean }) {
  const [items, setItems] = useState<C[] | null>(null);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [rtext, setRtext] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/mentorlik/darslar/${lessonId}/izohlar`, { cache: "no-store" });
      const j = (await r.json()) as { data?: { items: C[] } };
      setItems(j.data?.items ?? []);
    } catch {
      setItems([]);
    }
  }, [lessonId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: string, parentId: string | null) {
    setBusy(true);
    try {
      const r = await fetch(`/api/mentorlik/darslar/${lessonId}/izohlar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, parentId }) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Yuborilmadi");
      if (parentId) {
        setRtext("");
        setReply(null);
      } else setText("");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }
  async function act(id: string, method: "PATCH" | "DELETE", body?: unknown) {
    await fetch(`/api/mentorlik/izohlar/${id}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => undefined);
    await load();
  }

  if (!items) return <div className="mt-6 grid h-16 place-items-center"><Loader2 className="animate-spin text-fg-3" /></div>;
  const top = items.filter((c) => !c.parentId).sort((a, b) => Number(b.helpful) - Number(a.helpful) || b.createdAt - a.createdAt);
  const replies = (id: string) => items.filter((c) => c.parentId === id);

  const Row = ({ c, child }: { c: C; child?: boolean }) => (
    <div id={`izoh-${c.id}`} className={cn("flex gap-2.5", child && "ml-9")}>
      <Avatar name={c.name} src={c.avatarUrl} size={child ? 26 : 32} decorative />
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">
          <span className="font-semibold text-fg">{c.name}</span>
          {c.isMentor && <span className="ml-1.5 rounded bg-fg px-1.5 py-0.5 text-[10.5px] font-bold text-bg">USTOZ</span>}
          {c.helpful && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11.5px] font-bold text-success-text"><Check size={12} /> foydali</span>}
          <span className="ml-2 text-[11.5px] text-fg-4">{formatDateTime(c.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{c.body}</p>
        <div className="mt-1 flex gap-3 text-[12px] font-semibold text-fg-3">
          {!child && <button type="button" onClick={() => setReply(reply === c.id ? null : c.id)} className="hover:text-fg">Javob yozish</button>}
          {isMentor && !child && <button type="button" onClick={() => void act(c.id, "PATCH", { helpful: !c.helpful })} className="hover:text-fg">{c.helpful ? "Belgini olib tashlash" : "Foydali deb belgilash"}</button>}
          {(c.mine || isMentor) && <button type="button" aria-label="O'chirish" onClick={() => void act(c.id, "DELETE")} className="hover:text-danger"><Trash2 size={13} /></button>}
        </div>
      </div>
    </div>
  );

  return (
    <section className="mt-8 border-t border-line pt-5">
      <h2 className="text-[16px] font-bold text-fg">Savol va javoblar <span className="text-fg-4">· {top.length}</span></h2>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 2) void send(text.trim(), null); }} className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1200} placeholder="Savolingizni yozing…" aria-label="Savol" className="field h-11 min-w-0 flex-1 text-[14px]" />
        <button type="submit" disabled={busy || text.trim().length < 2} className="btn-accent h-11 px-5 text-[14px] font-semibold disabled:opacity-50">Yuborish</button>
      </form>
      <ul className="mt-5 space-y-5">
        {top.length === 0 && <li className="text-[13.5px] text-fg-3">Hali savol yo&apos;q — birinchi bo&apos;ling.</li>}
        {top.map((c) => (
          <li key={c.id} className="space-y-3">
            <Row c={c} />
            {replies(c.id).map((r) => (
              <Row key={r.id} c={r} child />
            ))}
            {reply === c.id && (
              <form onSubmit={(e) => { e.preventDefault(); if (rtext.trim().length >= 2) void send(rtext.trim(), c.id); }} className="ml-9 flex gap-2">
                <CornerDownRight size={16} className="mt-3 shrink-0 text-fg-4" />
                <input autoFocus value={rtext} onChange={(e) => setRtext(e.target.value)} maxLength={1200} placeholder="Javobingiz…" aria-label="Javob" className="field h-10 min-w-0 flex-1 text-[14px]" />
                <button type="submit" disabled={busy || rtext.trim().length < 2} className="h-10 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg disabled:opacity-50">Javob</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
