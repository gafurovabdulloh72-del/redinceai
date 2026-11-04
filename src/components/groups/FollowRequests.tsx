"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SOROVLAR } from "@/lib/i18n/dict/moderation";
import type { FollowRequestRow } from "@/lib/privacy/private-profile";

type ApiResp = { ok: boolean; data?: { items: FollowRequestRow[] }; error?: string };

/**
 * Yopiq profil egasiga kelgan obuna so'rovlari ro'yxati (Kabinet → Obunalar → So'rovlar):
 * tasdiqlash → obuna yoziladi va so'rovchiga xabar; rad etish → so'rov o'chadi. Optimistik: qator darhol yo'qoladi.
 */
export function FollowRequests({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const til = useLocale();
  const { toast } = useToast();
  const [items, setItems] = useState<FollowRequestRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/follow/sorovlar", { cache: "no-store" });
        const j = (await res.json()) as ApiResp;
        if (alive && j.ok && j.data) {
          setItems(j.data.items);
          onCountChange?.(j.data.items.length);
        }
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(r: FollowRequestRow, approve: boolean) {
    if (busy) return;
    setBusy(r.id);
    const prev = items ?? [];
    const next = prev.filter((x) => x.id !== r.id);
    setItems(next);
    onCountChange?.(next.length);
    try {
      const res = await fetch(`/api/follow/sorovlar/${encodeURIComponent(r.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: approve ? "approve" : "reject" }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      toast(tr(til, approve ? SOROVLAR.approved : SOROVLAR.rejectedT), approve ? "success" : "info");
    } catch (e) {
      setItems(prev);
      onCountChange?.(prev.length);
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!items) {
    return (
      <ul className="space-y-1 p-1" aria-busy="true">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-3 p-2">
            <span className="h-10 w-10 shrink-0 rounded-full skeleton" />
            <span className="flex-1 space-y-2">
              <span className="block h-3.5 w-1/2 skeleton" />
              <span className="block h-3 w-1/3 skeleton" />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (items.length === 0) return <p className="px-4 py-10 text-center text-[13px] text-fg-3">{tr(til, SOROVLAR.empty)}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((r) => {
        const href = r.from.slug ? `/mutaxassislar/${r.from.slug}` : r.from.username ? `/yozish/${r.from.username}` : null;
        const name = <span className="block truncate text-[14px] font-semibold text-fg">{r.from.name}</span>;
        return (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={r.from.name} src={r.from.avatarUrl} size={40} decorative />
            <span className="min-w-0 flex-1">
              {href ? (
                <Link href={href} className="hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
              {r.from.username && <span className="block truncate text-[12px] text-fg-3">@{r.from.username}</span>}
            </span>
            <Button type="button" size="sm" onClick={() => void decide(r, true)} disabled={busy === r.id} aria-label={`${r.from.name}: ${tr(til, SOROVLAR.approve)}`}>
              <Check size={14} /> {tr(til, SOROVLAR.approve)}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void decide(r, false)} disabled={busy === r.id} aria-label={`${r.from.name}: ${tr(til, SOROVLAR.reject)}`}>
              <X size={14} />
              <span className="sr-only sm:not-sr-only">{tr(til, SOROVLAR.reject)}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
