import { getCurrentUser } from "@/lib/auth";
import { PAYOUT_STATE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { loadMonthlyReport, parseMonth } from "../report";

/** CSV katak: qo'shtirnoq ichida, ichki qo'shtirnoq ikkilanadi; formulalar (=,+,-,@) neytrallanadi */
function cell(v: string | number | null | undefined): string {
  if (typeof v === "number") return String(v);
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Oylik hisobot CSV (Excel/Sheets uchun; UTF-8 BOM bilan): ?oy=YYYY-MM — faqat o'z mutaxassis profilingiz.
 * Bo'limlar: xulosa, yakunlangan to'lovlar, bajarilgan buyurtmalar, payoutlar, obuna to'lovlari.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Avval tizimga kiring", { status: 401 });
  if (!user.specialist) return new Response("Mutaxassis profili yo'q", { status: 404 });
  const month = parseMonth(new URL(req.url).searchParams.get("oy") ?? undefined);
  const r = await loadMonthlyReport(user.specialist.id, month);
  const t = r.totals;
  const rows: Array<Array<string | number | null | undefined>> = [
    ["Kasb Egalari — oylik hisobot", month.label],
    ["Mutaxassis", user.name],
    ["Davr", `${formatDate(month.startMs)} — ${formatDate(month.endMs - 1)}`],
    [],
    ["Xulosa", "Qiymat (so'm)"],
    ["Bajarilgan buyurtmalar (ta)", t.completedCount],
    ["Yalpi tushum", t.gross],
    ["Platforma komissiyasi", -t.commission],
    ["Sof daromad", t.net],
    ["Obuna to'lovlari", -t.subscriptionPaid],
    ["Obunadan keyingi sof", t.netAfterSubscription],
    ["To'langan payoutlar", t.payoutsPaid],
    [],
    ["Yakunlangan to'lovlar", "Sana", "Summa", "Komissiya %", "Komissiya", "Sof"],
    ...r.released.map((p) => [p.orderTitle, p.releasedAt ? formatDate(p.releasedAt) : "", p.amount, p.commissionPct, p.commissionAmount, p.netAmount]),
    [],
    ["Bajarilgan buyurtmalar", "Sana", "Summa", "To'lov holati"],
    ...r.completed.map((o) => [o.title, o.completedAt ? formatDate(o.completedAt) : "", o.amount ?? "", o.paymentState]),
    [],
    ["Payoutlar", "So'ralgan", "To'langan", "Summa", "Holat"],
    ...r.payouts.map((p) => [p.method, formatDate(p.createdAt), p.processedAt ? formatDate(p.processedAt) : "", p.amount, PAYOUT_STATE_LABEL[p.state]]),
    [],
    ["Obuna to'lovlari", "Sana", "Oylar", "Summa", "Provayder"],
    ...r.subscriptions.map((s) => [`${s.months} oylik`, s.paidAt ? formatDate(s.paidAt) : "", s.months, s.amount, s.provider]),
  ];
  const csv = "﻿" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kasb-egalari-hisobot-${month.key}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
