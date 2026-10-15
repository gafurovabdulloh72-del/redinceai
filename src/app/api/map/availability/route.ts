import { NextResponse, type NextRequest } from "next/server";
import { DATE_RE, getAvailableCounts } from "@/lib/map-stats";
import { CATEGORY_BY_SLUG, REGIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Xarita: berilgan kunga bo'sh mutaxassislar soni (hudud kesimida). GET ?date=YYYY-MM-DD&category= */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const catParam = req.nextUrl.searchParams.get("category");
  const category = catParam && CATEGORY_BY_SLUG[catParam] ? catParam : null;
  if (!DATE_RE.test(date)) return NextResponse.json({ ok: false, error: "Sana formati: YYYY-MM-DD" }, { status: 422 });
  const d = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  if (Number.isNaN(d) || d < today || d > today + 180 * 24 * 3600 * 1000) {
    return NextResponse.json({ ok: false, error: "Sana bugundan 180 kungacha bo'lishi kerak" }, { status: 422 });
  }
  const counts = await getAvailableCounts(date, category);
  const total = REGIONS.reduce((a, r) => a + (counts[r.slug] ?? 0), 0);
  return NextResponse.json({ ok: true, data: { date, category, counts, total } });
}
