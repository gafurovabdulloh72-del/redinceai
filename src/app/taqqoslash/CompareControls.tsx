"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { compareHref, getCompareServerSnapshot, getCompareSnapshot, removeCompare, subscribeCompare, syncCompare, type CompareItem } from "@/components/specialists/compare-store";

/**
 * Taqqoslash sahifasi va brauzer ro'yxatini moslashtiradi:
 *  - URL'da ids bo'lmasa, lekin ro'yxatda tanlanganlar bo'lsa — o'sha ids bilan qayta ochadi;
 *  - server topgan mutaxassislar ro'yxatga yoziladi (katalogdan chiqqanlar avtomatik tushib qoladi).
 */
export function CompareSync({ items, hasIds }: { items: CompareItem[]; hasIds: boolean }) {
  const router = useRouter();
  const snap = useSyncExternalStore(subscribeCompare, getCompareSnapshot, getCompareServerSnapshot);
  const key = items.map((i) => i.id).join(",");

  useEffect(() => {
    if (!hasIds) {
      if (snap.items.length) router.replace(compareHref(snap.items));
      return;
    }
    syncCompare(items);
    // Gidratatsiyadan keyin brauzer ro'yxati (server snapshot bo'sh) — items.length o'zgarishi ham kuzatiladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasIds, key, hasIds ? 0 : snap.items.length]);

  return null;
}

/** Ustundan olib tashlash: ro'yxatdan o'chiradi va sahifani qolganlar bilan qayta ochadi */
export function CompareRemove({ id, name, rest }: { id: string; name: string; rest: string[] }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        removeCompare(id);
        router.replace(rest.length ? compareHref(rest.map((r) => ({ id: r }))) : "/taqqoslash?ids=");
      }}
      aria-label={`${name} — taqqoslashdan olib tashlash`}
      title="Olib tashlash"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
    >
      <X size={16} />
    </button>
  );
}
