"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, Check, Lightbulb, MessageSquareHeart, MessageSquareText, RotateCcw } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime } from "@/lib/utils";

interface Row {
  id: string;
  kind: "bug" | "idea" | "other";
  text: string;
  page: string;
  screenshotUrl: string | null;
  userAgent: string;
  status: "open" | "done";
  createdAt: string | number;
  user: { id: string; name: string; email: string } | null;
}

const KIND_ICON = { bug: Bug, idea: Lightbulb, other: MessageSquareText } as const;
const KIND_LABEL = { bug: "Xato", idea: "G'oya", other: "Boshqa" } as const;

/** Admin «Tizim» tabi: foydalanuvchi fikrlari — ochiq/bajarilgan filtri, holatni almashtirish. Matn — matn sifatida (XSS yo'q). */
export function AdminFeedback() {
  const [status, setStatus] = useState<"open" | "done">("open");
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const r = await fetch(`/api/admin/fikrlar?status=${status}`);
      const j = (await r.json()) as { data?: { items: Row[] } };
      setRows(j.data?.items ?? []);
    } catch {
      setRows([]);
    }
  }, [status]);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(r: Row) {
    const next = r.status === "open" ? "done" : "open";
    const res = await fetch("/api/admin/fikrlar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: next }) });
    if (!res.ok) return showToast("Saqlanmadi", "error");
    setRows((l) => l?.filter((x) => x.id !== r.id) ?? l);
  }

  return (
    <section className="card mt-5 overflow-hidden" id="fikrlar-karta">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold text-fg">
            <MessageSquareHeart size={16} /> Foydalanuvchi fikrlari
          </h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">«Fikr bildirish» tugmasidan kelgan xato/g&apos;oya/boshqa. Ko&apos;rib chiqilgach «Bajarildi» deb belgilang.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-line p-0.5" role="tablist">
          {(["open", "done"] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold transition", status === s ? "bg-fg text-bg" : "text-fg-2 hover:text-fg")}>
              {s === "open" ? "Ochiq" : "Bajarilgan"}
            </button>
          ))}
        </div>
      </header>
      {rows === null ? (
        <p className="px-4 py-6 text-center text-[13px] text-fg-3">Yuklanmoqda…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13.5px] text-fg-3">{status === "open" ? "Ochiq fikr yo'q" : "Bajarilganlar yo'q"}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const Icon = KIND_ICON[r.kind];
            return (
              <li key={r.id} className="flex gap-3 px-4 py-3">
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", r.kind === "bug" ? "bg-danger-soft text-danger-text" : r.kind === "idea" ? "bg-warning-soft text-warning-text" : "bg-fg/6 text-fg-2")} title={KIND_LABEL[r.kind]}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-3">
                    <b className="text-fg">{r.user ? r.user.name : "Mehmon"}</b>
                    {r.user && <span>{r.user.email}</span>}
                    <span>· {formatDateTime(r.createdAt)}</span>
                    {r.page && <code className="rounded bg-fg/6 px-1 text-[11px] text-fg-2">{r.page}</code>}
                  </p>
                  {/* Matn — matn sifatida; whitespace saqlanadi */}
                  <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-snug text-fg" data-no-auto>
                    {r.text}
                  </p>
                  {r.screenshotUrl && (
                    <a href={r.screenshotUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.screenshotUrl} alt="Skrinshot" className="h-20 rounded-md border border-line object-cover" />
                    </a>
                  )}
                  {r.userAgent && <p className="mt-1 truncate text-[11px] text-fg-4">{r.userAgent}</p>}
                </div>
                <button type="button" onClick={() => void toggle(r)} className="btn-ink h-8 shrink-0 self-start rounded-full px-3 text-[12px] font-semibold" title={r.status === "open" ? "Bajarildi deb belgilash" : "Qayta ochish"}>
                  {r.status === "open" ? <Check size={14} /> : <RotateCcw size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
