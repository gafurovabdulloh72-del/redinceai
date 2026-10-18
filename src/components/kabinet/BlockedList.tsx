"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, Search, ShieldCheck } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { BlockedUserRow } from "@/lib/privacy/blocks";
import { formatDate } from "@/lib/utils";

type ApiResp = { ok: boolean; error?: string };

/** Qidiruv maydoni shu sondan ko'p bloklangan bo'lsa chiqadi */
const SEARCH_FROM = 5;

/** Kabinet → Xavfsizlik → Bloklanganlar: ro'yxat (qidiruv bilan) + blokdan chiqarish */
export function BlockedList({ initial }: { initial: BlockedUserRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((u) => u.name.toLowerCase().includes(t) || (u.username ?? "").toLowerCase().includes(t.replace(/^@/, "")));
  }, [rows, q]);

  async function unblock(u: BlockedUserRow) {
    if (busy) return;
    setBusy(u.id);
    try {
      const res = await fetch(`/api/blocks/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
      setRows((r) => r.filter((x) => x.id !== u.id));
      toast(`${u.name} blokdan chiqarildi`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="bloklanganlar" className="card scroll-mt-28 p-5 sm:p-6" aria-labelledby="sec-blocked">
      <h2 id="sec-blocked" className="font-display text-[19px] font-semibold tracking-tight text-fg">
        Bloklanganlar {rows.length > 0 && <span className="text-fg-3">· {rows.length}</span>}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Bloklangan odam sizga yoza olmaydi, obuna bo&apos;lmaydi, izoh va reaksiya qo&apos;ya olmaydi.</p>
      {rows.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-[14px] bg-fg/4 px-4 py-3 text-[13px] text-fg-3">
          <ShieldCheck size={15} className="text-success" aria-hidden="true" /> Hali hech kim bloklanmagan. Bloklash — profil yoki chat sarlavhasidagi <Ban size={12} className="inline" aria-label="blok" /> tugmasi.
        </p>
      ) : (
        <>
          {rows.length > SEARCH_FROM && (
            <div className="relative mt-4">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className="field !h-10 pl-9" placeholder="Ism yoki @taxallus bo'yicha qidirish" aria-label="Bloklanganlar orasida qidirish" />
            </div>
          )}
          {shown.length === 0 ? (
            <p className="mt-3 px-1 text-[13px] text-fg-3" role="status">
              «{q.trim()}» bo&apos;yicha hech kim topilmadi.
            </p>
          ) : (
            <ul className="list-inset mt-4" aria-live="polite">
              {shown.map((u) => (
                <li key={u.id} className="press flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={u.name} src={u.avatarUrl} size={36} decorative />
                  <span className="min-w-0 flex-1">
                    {u.slug ? (
                      <Link href={`/mutaxassislar/${u.slug}`} className="block truncate text-[14px] font-semibold text-fg hover:underline">
                        {u.name}
                      </Link>
                    ) : (
                      <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                    )}
                    <span className="block truncate text-[12px] text-fg-3" suppressHydrationWarning>
                      {u.username ? `@${u.username} · ` : ""}
                      {formatDate(u.blockedAt)}
                    </span>
                  </span>
                  <Button size="sm" variant="outline" className="!h-9 shrink-0" onClick={() => void unblock(u)} disabled={busy === u.id} aria-label={`${u.name} — blokdan chiqarish`}>
                    Blokdan chiqarish
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
