"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatSom } from "@/lib/mentorship/format";
import { formatCard } from "@/lib/payments/card";
import { formatDateTime } from "@/lib/utils";

export type PayoutRow = { id: string; mentor: string; amount: number; card: string; createdAt: number };
export type PendingPurchase = { id: string; title: string; buyer: string; amount: number; createdAt: number };
export type RecentPurchase = PendingPurchase & { provider: string; refunded: boolean; refundAsked?: boolean };

const PROVIDER_LABEL: Record<string, string> = { payme: "Payme", click: "Click", manual: "Karta", telegram: "Telegram", free: "Bepul" };

/** Admin: mentor yechish so'rovlari (kartaga o'tkazgach «To'landi») va qo'lda o'tkazma xaridlarini tasdiqlash */
export function AdminMentorMoney({ payouts, purchases, recent = [] }: { payouts: PayoutRow[]; purchases: PendingPurchase[]; recent?: RecentPurchase[] }) {
  const router = useRouter();
  const confirm = useConfirm();

  /** Qaytarish: kirish yopiladi, ustoz daromadi bekor qilinadi (to'langan bo'lsa — manfiy tuzatish), xaridorga xabar ketadi */
  async function refund(p: RecentPurchase) {
    const yes = await confirm({
      title: "Xarid qaytarilsinmi?",
      text: `${p.title} — ${formatSom(p.amount)} (${p.buyer}). Kirish yopiladi va ustoz daromadidan chiqariladi. Pulni mijozning kartasiga o'zingiz qaytarasiz — tugma faqat hisobni yuritadi.`,
      confirmLabel: "Ha, qaytarish",
      cancelLabel: "Bekor qilish",
      danger: true,
    });
    if (!yes) return;
    await act(`r${p.id}`, { kind: "invoice", id: p.id, action: "refund" }, "Qaytarildi — kirish yopildi, xaridorga xabar ketdi");
  }
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, body: Record<string, unknown>, okText: string) {
    setBusy(key);
    try {
      const r = await fetch("/api/admin/mentor-money", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Xatolik");
      showToast(okText, "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 font-display text-[16px] font-bold text-fg">Yechish so&apos;rovlari {payouts.length > 0 && <span className="text-fg-3">{payouts.length}</span>}</h2>
        {payouts.length === 0 ? (
          <p className="card p-4 text-[13.5px] text-fg-3">Kutilayotgan so&apos;rov yo&apos;q.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13.5px]">
                <span className="font-semibold text-fg">{p.mentor}</span>
                <span className="tabular-nums text-fg">{formatSom(p.amount)}</span>
                <span className="tabular-nums text-fg-3">{formatCard(p.card)}</span>
                <span className="text-[12px] text-fg-4">{formatDateTime(p.createdAt)}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, { kind: "payout", id: p.id, action: "paid" }, "To'landi deb belgilandi")} className="btn-accent inline-flex h-9 items-center gap-1.5 px-4 text-[13px]">
                    {busy === p.id && <Loader2 size={13} className="animate-spin" />} To&apos;landi
                  </button>
                  <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, { kind: "payout", id: p.id, action: "rejected", note: "Karta ma'lumotini tekshiring" }, "Rad etildi")} className="h-9 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2">
                    Rad etish
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-display text-[16px] font-bold text-fg">Qo&apos;lda o&apos;tkazmalar (mentorlik xaridlari) {purchases.length > 0 && <span className="text-fg-3">{purchases.length}</span>}</h2>
        {purchases.length === 0 ? (
          <p className="card p-4 text-[13.5px] text-fg-3">Tasdiqlashni kutayotgan o&apos;tkazma yo&apos;q.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate font-semibold text-fg">{p.title}</span>
                <span className="text-fg-3">{p.buyer}</span>
                <span className="tabular-nums text-fg">{formatSom(p.amount)}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, { kind: "invoice", id: p.id, action: "approve" }, "Tasdiqlandi — kirish ochildi")} className="btn-accent inline-flex h-9 items-center gap-1.5 px-4 text-[13px]">
                    {busy === p.id && <Loader2 size={13} className="animate-spin" />} Tasdiqlash
                  </button>
                  <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, { kind: "invoice", id: p.id, action: "reject" }, "Rad etildi")} className="h-9 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2">
                    Rad etish
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-display text-[16px] font-bold text-fg">So&apos;nggi xaridlar <span className="text-[13px] font-normal text-fg-3">· 45 kun</span></h2>
        {recent.length === 0 ? (
          <p className="card p-4 text-[13.5px] text-fg-3">Hali xarid yo&apos;q.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate font-semibold text-fg">
                  {p.title}
                  {p.refundAsked && !p.refunded && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">Qaytarish so&apos;ralgan</span>}
                </span>
                <span className="text-fg-3">{p.buyer}</span>
                <span className="tabular-nums text-fg">{formatSom(p.amount)}</span>
                <span className="text-[12px] text-fg-4">
                  {PROVIDER_LABEL[p.provider] ?? p.provider} · {formatDateTime(p.createdAt)}
                </span>
                <span className="ml-auto">
                  {p.refunded ? (
                    <span className="rounded-full bg-fg/8 px-2.5 py-1 text-[11.5px] font-bold text-fg-3">Qaytarilgan</span>
                  ) : p.amount > 0 ? (
                    <button type="button" disabled={busy === `r${p.id}`} onClick={() => void refund(p)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:border-danger hover:text-danger disabled:opacity-60">
                      {busy === `r${p.id}` && <Loader2 size={13} className="animate-spin" />} Qaytarish
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
