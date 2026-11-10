"use client";

import { useState } from "react";
import { Copy, Eye } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Audit jurnali qatorining to'liq ko'rinishi (pastki varaq / markaziy oyna): harakat, kim, nishon (to'liq id), IP,
 * aniq vaqt va `meta` — chiroyli formatlangan JSON (ro'yxatda u bir qatorga siqilgan). Matn — matn sifatida (HTML emas).
 * Eslatma: jurnal user-agent saqlamaydi (faqat IP) — qurilma ma'lumoti bu yerda yo'q.
 */
export interface AuditDetail {
  id: string;
  at: number;
  action: string;
  label: string;
  actor: { id: string; name: string | null; email: string | null } | null;
  /** Tizim harakati (cron) — aktyor yo'q */
  system: boolean;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 gap-3 py-1.5">
      <dt className="w-24 shrink-0 text-[12.5px] text-fg-4">{label}</dt>
      <dd className={cn("min-w-0 flex-1 break-all text-[13px] text-fg", mono && "font-mono text-[12px]")} data-no-auto>
        {children}
      </dd>
    </div>
  );
}

export function AuditDetailButton({ row, className }: { row: AuditDetail; className?: string }) {
  const [open, setOpen] = useState(false);
  const hasMeta = Object.keys(row.meta ?? {}).length > 0;
  const json = hasMeta ? JSON.stringify(row.meta, null, 2) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ id: row.id, at: new Date(row.at).toISOString(), action: row.action, actor: row.actor, targetType: row.targetType, targetId: row.targetId, ip: row.ip, meta: row.meta }, null, 2));
      showToast("Nusxalandi");
    } catch {
      showToast("Nusxalab bo'lmadi", "error");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${row.label}: batafsil`} title="Batafsil" className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line-2 px-2.5 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg", className)}>
        <Eye size={13} aria-hidden="true" /> Batafsil
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={row.label} desktop="center" size="lg">
        <dl className="divide-y divide-line">
          <Row label="Vaqt">
            {formatDateTime(row.at)} <span className="text-fg-4">(Toshkent)</span>
          </Row>
          <Row label="Harakat kodi" mono>
            {row.action}
          </Row>
          <Row label="Kim">{row.system && !row.actor ? "Tizim" : row.actor ? `${row.actor.name ?? "O'chirilgan foydalanuvchi"}${row.actor.email ? ` · ${row.actor.email}` : ""}` : "Anonim"}</Row>
          {row.actor && (
            <Row label="Kim (id)" mono>
              {row.actor.id}
            </Row>
          )}
          <Row label="Nishon" mono>
            {row.targetType ? `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ""}` : "—"}
          </Row>
          <Row label="IP" mono>
            {row.ip ?? "—"}
          </Row>
          <Row label="Yozuv id" mono>
            {row.id}
          </Row>
        </dl>
        <div className="mt-4 flex items-center justify-between gap-2">
          <h3 className="text-[12.5px] font-semibold text-fg-3">Tafsilot (meta)</h3>
          <button type="button" onClick={() => void copy()} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
            <Copy size={13} /> Nusxalash
          </button>
        </div>
        {hasMeta ? (
          <pre className="mt-2 max-h-[46vh] overflow-auto rounded-[var(--r-sm)] border border-line bg-fg/[0.03] p-3 font-mono text-[12px] leading-relaxed text-fg-2" tabIndex={0} aria-label="Tafsilot (JSON)" data-no-auto>
            {json}
          </pre>
        ) : (
          <p className="mt-2 rounded-[var(--r-sm)] border border-line px-3 py-4 text-center text-[12.5px] text-fg-4">Qo&apos;shimcha tafsilot yozilmagan.</p>
        )}
      </Sheet>
    </>
  );
}
