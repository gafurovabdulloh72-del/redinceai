import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { csvResponse } from "@/lib/security/csv";
import { formatDateTime } from "@/lib/utils";
import { auditCursorOf, auditFilterFromQuery, labelFor, parseAuditCursor, queryAuditLogs } from "@/app/admin/queries";

const schema = z.object({
  action: z.string().trim().max(40).optional(),
  actor: z.string().trim().max(120).optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  q: z.string().trim().max(80).optional(),
  /** Nishon turi (aniq) va nishon id (boshidan moslik) */
  target: z.string().trim().max(40).optional(),
  tid: z.string().trim().max(200).optional(),
  /** Kursor: oldingi javobdagi `nextCursor` — shundan eski yozuvlar */
  before: z.string().trim().max(90).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  /** JSON: sahifa hajmi (≤200); CSV: eksport chegarasi (≤5000) */
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

/**
 * Admin: audit jurnali — filtrlar (harakat, kim, nishon turi/id, sana, erkin matn).
 *  · JSON: kursor bo'yicha sahifalash — `{ items, nextCursor }` (`?before=<nextCursor>` keyingi sahifa);
 *  · CSV (`format=csv`): joriy filtr bo'yicha 5000 tagacha qator, formula-inyeksiyadan himoyalangan (lib/security/csv.ts);
 *    eksportning o'zi ham jurnalga yoziladi (kim, qaysi filtr bilan, nechta qator).
 */
export const GET = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const q = parseQuery(req.url, schema);
  const filter = auditFilterFromQuery(q);

  if (q.format === "csv") {
    const rows = await queryAuditLogs(filter, { limit: Math.min(q.limit ?? 2000, 5000) });
    await audit(session.sub, "admin_export", { targetType: "audit", meta: { ...filter, rows: rows.length } }, req);
    return csvResponse(
      "kasbegalari-audit",
      ["vaqt", "harakat", "harakat_kodi", "kim", "email", "nishon_turi", "nishon_id", "ip", "izoh", "tafsilot"],
      rows.map((r) => [formatDateTime(r.createdAt), labelFor(r.action, r.meta), r.action, r.actorName ?? (r.actorId ? "O'chirilgan" : "Anonim"), r.actorEmail ?? "", r.targetType ?? "", r.targetId ?? "", r.ip ?? "", typeof r.meta?.note === "string" ? r.meta.note : "", JSON.stringify(r.meta ?? {})]),
    );
  }

  const limit = Math.min(q.limit ?? 50, 200);
  const rows = await queryAuditLogs(filter, { limit: limit + 1, before: parseAuditCursor(q.before) });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return ok({
    items: page.map((r) => ({
      id: r.id,
      action: r.action,
      label: labelFor(r.action, r.meta),
      actor: r.actorId ? { id: r.actorId, name: r.actorName, email: r.actorEmail } : null,
      targetType: r.targetType,
      targetId: r.targetId,
      ip: r.ip,
      meta: r.meta,
      createdAt: r.createdAt.getTime(),
    })),
    nextCursor: rows.length > limit && last ? auditCursorOf(last) : null,
  });
});
