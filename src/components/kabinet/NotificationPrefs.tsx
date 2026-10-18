"use client";

import { useState } from "react";
import { ChevronDown, Mail, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { usePresence } from "@/components/motion/usePresence";
import { cn } from "@/lib/utils";

export type NotifyGroupKey = "orders" | "jobs" | "social" | "chat" | "system";
export interface NotifyPrefsInitial {
  groups: Record<NotifyGroupKey, boolean>;
  notifyEmail: boolean;
  meta: Record<NotifyGroupKey, { label: string; hint: string }>;
}
type ApiResp = { ok: boolean; data?: NotifyPrefsInitial; error?: string; fields?: Record<string, string> };

/**
 * Bildirishnoma sozlamalari (yig'iladigan panel): guruh bo'yicha yoqish/o'chirish + email kaliti.
 * Har o'zgarish darhol saqlanadi (PUT /api/notifications/prefs); xato bo'lsa eski holat qaytadi.
 */
export function NotificationPrefs({ initial, defaultOpen = false }: { initial: NotifyPrefsInitial; defaultOpen?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const { mounted, closing } = usePresence(open, 180);
  const keys = Object.keys(v.meta) as NotifyGroupKey[];
  const offCount = keys.filter((k) => !v.groups[k]).length;

  async function save(patch: { groups?: Partial<Record<NotifyGroupKey, boolean>>; notifyEmail?: boolean }, key: string) {
    const prev = v;
    setV((s) => ({ ...s, groups: { ...s.groups, ...(patch.groups ?? {}) }, notifyEmail: patch.notifyEmail ?? s.notifyEmail }));
    setBusy(key);
    try {
      const res = await fetch("/api/notifications/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok || !j.data) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlanmadi");
      setV(j.data);
    } catch (e) {
      setV(prev);
      toast(e instanceof Error ? e.message : "Saqlanmadi", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="notif-prefs-title">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="notif-prefs-body"
        className="press flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-fg/4 sm:px-5"
      >
        <SlidersHorizontal size={18} className="shrink-0 text-fg-3" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span id="notif-prefs-title" className="block text-[14px] font-semibold text-fg">
            Sozlamalar
          </span>
          <span className="block truncate text-[12px] text-fg-3">
            {offCount === 0 ? "Hamma guruh yoqilgan" : `${offCount} ta guruh o'chirilgan`} · email {v.notifyEmail ? "yoqilgan" : "o'chiq"}
          </span>
        </span>
        <ChevronDown size={16} className={cn("shrink-0 text-fg-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {mounted && (
        <div id="notif-prefs-body" className={cn("border-t border-line", closing ? "expand-out" : "expand-in")}>
          <ul className="divide-y divide-line">
            {keys.map((k) => (
              <li key={k} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span id={`np-${k}`} className="block text-[14px] font-medium text-fg">
                    {v.meta[k].label}
                  </span>
                  <span id={`np-${k}-hint`} className="block text-[12px] text-fg-3">
                    {v.meta[k].hint}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={v.groups[k]}
                  aria-labelledby={`np-${k}`}
                  aria-describedby={`np-${k}-hint`}
                  disabled={busy === k}
                  onClick={() => void save({ groups: { [k]: !v.groups[k] } }, k)}
                  className="switch"
                />
              </li>
            ))}
            <li className="flex items-center gap-3 bg-surface-2/60 px-4 py-3 sm:px-5">
              <Mail size={18} className="shrink-0 text-fg-3" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span id="np-email" className="block text-[14px] font-medium text-fg">
                  Email orqali ham
                </span>
                <span id="np-email-hint" className="block text-[12px] text-fg-3">
                  Muhim hodisalar (buyurtma, to'lov, taklif, xabar) emailga ham keladi. Xavfsizlik xatlari doim yuboriladi.
                </span>
              </span>
              <button type="button" role="switch" aria-checked={v.notifyEmail} aria-labelledby="np-email" aria-describedby="np-email-hint" disabled={busy === "email"} onClick={() => void save({ notifyEmail: !v.notifyEmail }, "email")} className="switch" />
            </li>
          </ul>
          <p className="px-4 py-2.5 text-[11.5px] text-fg-4 sm:px-5">Hisob xavfsizligi, nizo va pul qaytarish xabarlari sozlamadan qat&apos;i nazar keladi.</p>
        </div>
      )}
    </section>
  );
}
