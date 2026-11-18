"use client";

import { formatDate } from "@/lib/utils";
import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Stats = { until: number; active: boolean; granted: number; pending: number };

/** Toshkent vaqti bo'yicha sana → kun oxiri (23:59) ms */
function endOfDayTashkent(ymd: string): number {
  return new Date(`${ymd}T23:59:59+05:00`).getTime();
}
function ymdTashkent(ms: number): string {
  return new Date(ms + 5 * 3_600_000).toISOString().slice(0, 10);
}
const fmt = (ms: number) => formatDate(ms);

/**
 * Ishga tushirish sovg'asi: aksiya davomida har bir mutaxassisga (mavjud va yangi) BIR MARTA 1 yil Max tarifi bepul.
 * Sana — aksiya tugashi (shu kungacha ro'yxatdan o'tganlar oladi); olingan sovg'a 1 yil amal qiladi.
 */
export function LaunchGiftCard({ initial }: { initial: Stats }) {
  const confirm = useConfirm();
  const [s, setS] = useState(initial);
  const [date, setDate] = useState(initial.until > 0 ? ymdTashkent(initial.until) : ymdTashkent(Date.now() + 90 * 86_400_000));
  const [busy, setBusy] = useState<"" | "save" | "off" | "grant">("");

  async function call(method: "PATCH" | "POST", body: unknown): Promise<Stats & { granted: number }> {
    const r = await fetch("/api/admin/sovga", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as { ok: boolean; error?: string; fields?: Record<string, string>; data?: Stats & { granted: number } } | null;
    if (!r.ok || !j?.ok || !j.data) throw new Error((j?.fields && Object.values(j.fields)[0]) || j?.error || "Saqlab bo'lmadi");
    return j.data;
  }

  async function save(on: boolean) {
    setBusy(on ? "save" : "off");
    try {
      const d = await call("PATCH", { until: on ? endOfDayTashkent(date) : 0 });
      setS(d);
      showToast(on ? `Aksiya ${fmt(d.until)} gacha yoqildi` : "Aksiya o'chirildi");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi", "error");
    } finally {
      setBusy("");
    }
  }

  async function grantAll() {
    const ok = await confirm({ title: "Hammaga 1 yil Max berilsinmi?", text: `Hali sovg'a olmagan ${s.pending} ta mutaxassisga Max tarifi 1 yilga beriladi va har biriga xabar boradi. Bu amalni qaytarib bo'lmaydi.`, confirmLabel: "Ha, berish" });
    if (!ok) return;
    setBusy("grant");
    try {
      const d = await call("POST", { action: "grant_all" });
      const fresh = await (await fetch("/api/admin/sovga")).json().catch(() => null);
      if (fresh?.data) setS(fresh.data as Stats);
      showToast(`${d.granted} ta mutaxassisga sovg'a berildi`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-[var(--r-md)] border border-line p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"><Gift size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-fg">Ishga tushirish sovg'asi — 1 yil Max bepul</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">
            Aksiya davomida har bir mutaxassis (hozirgilar va yangi ro'yxatdan o'tganlar) bir marta 1 yillik Max tarifini oladi. To'lab qo'ygan obunasi uzunroq bo'lsa — qisqarmaydi.
          </p>
          <p className="mt-2 text-[13px] font-semibold text-fg">
            {s.active ? <span className="text-success-text">Yoqilgan · {fmt(s.until)} gacha</span> : <span className="text-fg-3">O'chiq</span>}
            <span className="ml-2 font-normal text-fg-3">· berildi: {s.granted} · kutmoqda: {s.pending}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="field-label">Aksiya tugashi (shu kungacha ro'yxatdan o'tganlar oladi)</span>
          <input type="date" className="field h-11 tabular-nums" value={date} min={ymdTashkent(Date.now() + 86_400_000)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" disabled={!!busy || !date} onClick={() => void save(true)} className="btn-ink inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold disabled:opacity-50">
          {busy === "save" && <Loader2 size={15} className="animate-spin" />} {s.active ? "Sanani saqlash" : "Aksiyani yoqish"}
        </button>
        {s.active && (
          <>
            <button type="button" disabled={!!busy || s.pending === 0} onClick={() => void grantAll()} className="btn-accent inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold disabled:opacity-50">
              {busy === "grant" && <Loader2 size={15} className="animate-spin" />} Hozir hammaga berish ({s.pending})
            </button>
            <button type="button" disabled={!!busy} onClick={() => void save(false)} className="inline-flex h-11 items-center rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
              O'chirish
            </button>
          </>
        )}
      </div>
      <p className="mt-3 text-[11.5px] text-fg-4">O'chirilsa — allaqachon berilgan sovg'alar o'z kuchida qoladi, faqat yangilarga berilmaydi. Kunlik cron ham o'tkazib yuborilganlarga avtomatik beradi.</p>
    </div>
  );
}
