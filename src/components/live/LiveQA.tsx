"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Check, ChevronUp, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Q = { id: string; body: string; votes: number; answered: boolean; name: string; mine: boolean; voted: boolean };
type Poll = { id: string; question: string; options: string[]; counts: number[]; total: number; closed: boolean; myVote: number | null } | null;

async function call(url: string, method: "GET" | "POST", body?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { data?: unknown; error?: string };
  if (!r.ok) throw new Error(j.error || "Xatolik");
  return j.data as never;
}

/** Efirdagi savollar (ovoz berish, boshlovchi «javob berildi» deydi) va so'rovnoma — 4 soniyada yangilanadi */
export function LiveQA({ streamId, isHost, flash }: { streamId: string; isHost: boolean; flash: (t: string) => void }) {
  const [tab, setTab] = useState<"q" | "poll">("q");
  const [qs, setQs] = useState<Q[]>([]);
  const [poll, setPoll] = useState<Poll>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pq, setPq] = useState("");
  const [opts, setOpts] = useState(["", ""]);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([call(`/api/live/${streamId}/savollar`, "GET") as Promise<{ items: Q[] }>, call(`/api/live/${streamId}/soralnoma`, "GET") as Promise<{ poll: Poll }>]);
      setQs(a.items);
      setPoll(b.poll);
    } catch {
      /* keyingi urinish */
    }
  }, [streamId]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1 px-2 pt-2">
        {([["q", "Savollar"], ["poll", poll && !poll.closed ? "So'rovnoma •" : "So'rovnoma"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("h-8 rounded-lg px-3 text-[12.5px] font-semibold", tab === k ? "bg-white/15" : "text-white/60 hover:text-white")}>{l}</button>
        ))}
      </div>

      {tab === "q" ? (
        <>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {qs.length === 0 && <li className="py-6 text-center text-[13px] text-white/45">Hali savol yo&apos;q. Ustozga savolingizni yozing.</li>}
            {qs.map((q) => (
              <li key={q.id} className={cn("flex gap-2.5 rounded-xl bg-white/[0.06] p-2.5", q.answered && "opacity-55")}>
                <button type="button" disabled={busy} onClick={() => void run(() => call(`/api/live/${streamId}/savollar`, "POST", { vote: q.id }))} aria-label="Ovoz berish" className={cn("flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[12px] font-bold", q.voted ? "bg-accent text-white" : "bg-white/10")}>
                  <ChevronUp size={15} /> {q.votes}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[13.5px] leading-snug">{q.body}</p>
                  <p className="mt-0.5 text-[11.5px] text-white/45">{q.name}{q.mine ? " (siz)" : ""}</p>
                </div>
                {isHost && (
                  <button type="button" aria-label={q.answered ? "Javob berilmagan" : "Javob berildi"} onClick={() => void run(() => call(`/api/live/${streamId}/savollar`, "POST", { answered: q.id, value: !q.answered }))} className={cn("grid h-8 w-8 shrink-0 place-items-center self-center rounded-full", q.answered ? "bg-success text-white" : "bg-white/10")}>
                    <Check size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t.length >= 3) { setText(""); void run(() => call(`/api/live/${streamId}/savollar`, "POST", { body: t })); } }} className="flex gap-2 border-t border-white/10 p-2.5">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Ustozga savol…" aria-label="Savol" className="h-10 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[14px] text-white outline-none placeholder:text-white/40 focus:bg-white/15" />
            <button type="submit" disabled={busy || text.trim().length < 3} className="h-10 rounded-full bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40">Yuborish</button>
          </form>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {poll ? (
            <div className="rounded-xl bg-white/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[14.5px] font-bold"><BarChart3 size={15} /> {poll.question}</p>
              <ul className="mt-2.5 space-y-1.5">
                {poll.options.map((o, i) => {
                  const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
                  const canVote = !poll.closed && poll.myVote === null;
                  return (
                    <li key={i}>
                      <button type="button" disabled={!canVote || busy} onClick={() => void run(() => call(`/api/live/${streamId}/soralnoma`, "POST", { vote: i }))} className={cn("relative w-full overflow-hidden rounded-lg bg-white/10 px-3 py-2 text-left text-[13.5px]", canVote && "hover:bg-white/15", poll.myVote === i && "ring-2 ring-accent")}>
                        {(!canVote || poll.total > 0) && <span className="absolute inset-y-0 left-0 bg-white/15" style={{ width: `${pct}%` }} />}
                        <span className="relative flex justify-between gap-2"><span className="truncate">{o}</span>{!canVote && <span className="tabular-nums font-semibold">{pct}%</span>}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11.5px] text-white/45">{poll.total} ovoz · {poll.closed ? "yopilgan" : "ochiq"}</p>
              {isHost && !poll.closed && <button type="button" onClick={() => void run(() => call(`/api/live/${streamId}/soralnoma`, "POST", { close: true }))} className="mt-2 h-8 rounded-lg bg-white/10 px-3 text-[12.5px] font-semibold">So&apos;rovnomani yopish</button>}
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] text-white/45">{isHost ? "Tomoshabinlardan fikr so'rang." : "Hozircha so'rovnoma yo'q."}</p>
          )}
          {isHost && (
            <div className="mt-3">
              {!creating ? (
                <button type="button" onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[13px] font-semibold"><Plus size={14} /> Yangi so&apos;rovnoma</button>
              ) : (
                <div className="space-y-2 rounded-xl bg-white/[0.06] p-3">
                  <input value={pq} onChange={(e) => setPq(e.target.value)} maxLength={140} placeholder="Savol" className="h-9 w-full rounded-lg bg-white/10 px-3 text-[13.5px] outline-none placeholder:text-white/40" />
                  {opts.map((o, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input value={o} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? e.target.value : x)))} maxLength={60} placeholder={`Variant ${i + 1}`} className="h-9 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-[13.5px] outline-none placeholder:text-white/40" />
                      {opts.length > 2 && <button type="button" aria-label="O'chirish" onClick={() => setOpts((a) => a.filter((_, k) => k !== i))} className="text-white/50"><X size={14} /></button>}
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    {opts.length < 5 && <button type="button" onClick={() => setOpts((a) => [...a, ""])} className="text-[12.5px] font-semibold text-white/70">+ variant</button>}
                    <button type="button" disabled={busy || pq.trim().length < 3 || opts.filter((o) => o.trim()).length < 2} onClick={() => void run(async () => { await call(`/api/live/${streamId}/soralnoma`, "POST", { question: pq, options: opts }); setCreating(false); setPq(""); setOpts(["", ""]); })} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold disabled:opacity-40">
                      {busy && <Loader2 size={13} className="animate-spin" />} Boshlash
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
