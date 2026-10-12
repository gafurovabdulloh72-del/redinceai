import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { auditFilterFromQuery, labelFor, queryAuditLogs } from "@/app/admin/queries";

const schema = z.object({
  action: z.string().trim().max(40).optional(),
  actor: z.string().trim().max(120).optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(5000).default(2000),
});

const csvCell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Admin: audit jurnali — filtrlar (harakat, kim, sana) va CSV eksport (F90) */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const q = parseQuery(req.url, schema);
  const filter = auditFilterFromQuery(q);
  const rows = await queryAuditLogs(filter, { limit: q.limit, offset: 0 });

  if (q.format === "csv") {
    const header = ["vaqt", "harakat", "harakat_kodi", "kim", "email", "nishon_turi", "nishon_id", "ip", "izoh", "tafsilot"];
    const lines = rows.map((r) =>
      [
        formatDateTime(r.createdAt),
        labelFor(r.action),
        r.action,
        r.actorName ?? (r.actorId ? "O'chirilgan" : "Anonim"),
        r.actorEmail ?? "",
        r.targetType ?? "",
        r.targetId ?? "",
        r.ip ?? "",
        typeof r.meta?.note === "string" ? r.meta.note : "",
        JSON.stringify(r.meta ?? {}),
      ]
        .map(csvCell)
        .join(","),
    );
    const body = `﻿${header.join(",")}\n${lines.join("\n")}\n`;
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="redince-audit-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return ok(
    rows.map((r) => ({
      id: r.id,
      action: r.action,
      label: labelFor(r.action),
      actor: r.actorId ? { id: r.actorId, name: r.actorName, email: r.actorEmail } : null,
      targetType: r.targetType,
      targetId: r.targetId,
      ip: r.ip,
      meta: r.meta,
      createdAt: r.createdAt.getTime(),
    })),
  );
});
