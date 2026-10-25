import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { csvResponse } from "@/lib/security/csv";
import { attendance, touchAttendance } from "@/lib/live/zoom";

export const runtime = "nodejs";

/** GET — davomat jadvali; `?csv=1` bo'lsa CSV fayl (boshlovchi/hammuallif) */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("liveWrite", session.sub);
  const { id } = await ctx.params;
  const rows = await attendance(id, { id: session.sub, role: session.role });
  if (new URL(req.url).searchParams.get("csv") !== "1") return ok({ items: rows });
  const fmt = (ms: number) => new Date(ms).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" });
  return csvResponse(
    `davomat-${id}`,
    ["Ism", "Taxallus", "Kirishlar", "Birinchi kirish", "Oxirgi faollik", "Daqiqa"],
    rows.map((r) => [r.name, r.username ?? "", r.sessions, fmt(r.firstAt), fmt(r.lastAt), r.minutes]),
  );
});

/** POST — «tirik» signal (har 60 s): davomat vaqtini uzaytiradi */
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("liveWrite", session.sub);
  const { id } = await ctx.params;
  await touchAttendance(id, session.sub);
  return ok({ done: true });
});
