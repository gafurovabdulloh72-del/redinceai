import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { handler, ok, requireSession } from "@/lib/api";
import { r2Usage } from "@/lib/storage/r2-usage";

/**
 * Admin: saqlash hisobi — R2 hajmi (jami, papkalar bo'yicha), so'nggi yuklangan fayllar, Cloudflare paneli havolasi
 * va ma'lumotlar bazasi hajmi. `?force=1` — keshni chetlab qayta hisoblash.
 */
export const maxDuration = 60;

async function dbSize(): Promise<number | null> {
  try {
    const pc = (await db.all(sql`pragma page_count`)) as Array<Record<string, number>>;
    const ps = (await db.all(sql`pragma page_size`)) as Array<Record<string, number>>;
    const pages = Number(Object.values(pc[0] ?? {})[0] ?? 0);
    const size = Number(Object.values(ps[0] ?? {})[0] ?? 0);
    return pages && size ? pages * size : null;
  } catch {
    return null;
  }
}

export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const force = new URL(req.url).searchParams.get("force") === "1";
  const [usage, dbBytes] = await Promise.all([r2Usage(force), dbSize()]);
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim() ? "https://app.turso.tech" : null;
  return ok({ usage, db: { bytes: dbBytes, dashboardUrl: tursoUrl } });
});
