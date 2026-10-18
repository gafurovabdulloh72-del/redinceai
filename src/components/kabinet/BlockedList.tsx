"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, ShieldCheck } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { BlockedUserRow } from "@/lib/privacy/blocks";
import { formatDateTime } from "@/lib/utils";

type ApiResp = { ok: boolean; error?: string };

/** Kabinet → Xavfsizlik → Bloklanganlar: ro'yxat + blokdan chiqarish */
export function BlockedList({ initial }: { initial: BlockedUserRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

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
    <section id="bloklanganlar" className="card scroll-mt-28 p-5 sm:p-7" aria-labelledby="sec-blocked">
      <h2 id="sec-blocked" className="font-display text-[20px] font-semibold tracking-tight text-fg">
        Bloklanganlar {rows.length > 0 && <span className="text-fg-3">· {rows.length}</span>}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Bloklangan foydalanuvchi sizga yoza olmaydi, obuna bo&apos;la olmaydi, postlaringizga izoh va reaksiya qo&apos;ya olmaydi; lentada bir-biringizning postlaringiz chiqmaydi.</p>
      {rows.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-[14px] bg-fg/4 px-4 py-3 text-[13px] text-fg-3">
          <ShieldCheck size={15} className="text-success" /> Hali hech kim bloklanmagan. Bloklash — foydalanuvchi profilidagi yoki chat sarlavhasidagi <Ban size={12} className="inline" /> tugmasi.
        </p>
      ) : (
        <ul className="list-inset mt-4">
          {rows.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={u.name} src={u.avatarUrl} size={36} decorative />
              <span className="min-w-0 flex-1">
                {u.slug ? (
                  <Link href={`/mutaxassislar/${u.slug}`} className="block truncate text-[14px] font-semibold text-fg hover:underline">
                    {u.name}
                  </Link>
                ) : (
                  <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                )}
                <span className="block truncate text-[12px] text-fg-3">
                  {u.username ? `@${u.username} · ` : ""}
                  {formatDateTime(u.blockedAt)}
                </span>
              </span>
              <Button size="sm" variant="outline" className="!h-9 shrink-0" onClick={() => void unblock(u)} disabled={busy === u.id}>
                Blokdan chiqarish
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
