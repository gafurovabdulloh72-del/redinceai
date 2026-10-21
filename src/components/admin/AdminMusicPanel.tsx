"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Music2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";

interface Row {
  id: string;
  url: string;
  title: string;
  artist: string | null;
  usesCount: number;
  isHidden: boolean;
}

/** Admin: musiqa kutubxonasi — ishlatilish soni bo'yicha; nomaqbul trekni yashirish (qidiruvdan chiqadi, mavjud story/postlarga tegmaydi) */
export function AdminMusicPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch("/api/admin/music")
      .then((r) => r.json())
      .then((j: { data?: { items: Row[] } }) => setRows(j.data?.items ?? []))
      .catch(() => setRows([]));
  }, []);
  async function toggle(r: Row) {
    const res = await fetch("/api/admin/music", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, isHidden: !r.isHidden }) });
    if (!res.ok) return showToast("Saqlanmadi", "error");
    setRows((l) => l?.map((x) => (x.id === r.id ? { ...x, isHidden: !r.isHidden } : x)) ?? l);
  }
  return (
    <section className="card mt-5 overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold text-fg">
          <Music2 size={16} /> Musiqa kutubxonasi
        </h2>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Story/postda ishlatilgan treklar. Nomaqbul trekni yashiring.</p>
      </header>
      {rows === null ? (
        <p className="px-4 py-6 text-center text-[13px] text-fg-3">Yuklanmoqda…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13.5px] text-fg-3">Hali treklar yo&apos;q</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={r.isHidden ? "truncate text-[14px] font-semibold text-fg-4 line-through" : "truncate text-[14px] font-semibold text-fg"}>{r.title}</p>
                <p className="truncate text-[12px] text-fg-3">
                  {r.artist ?? "—"} · {r.usesCount} marta ishlatilgan
                </p>
              </div>
              <audio src={r.url} controls preload="none" className="hidden h-8 w-44 sm:block" />
              <button type="button" onClick={() => void toggle(r)} aria-label={r.isHidden ? "Qaytarish" : "Yashirish"} className="grid h-9 w-9 place-items-center rounded-full text-fg-2 hover:bg-fg/6">
                {r.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
