import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Railway healthcheck: baza javob bersa 200. Xato matni faqat server logida —
 * productionda javob {ok:false} (ichki tafsilotlar sizmaydi), dev'da qisqa xabar.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await db.run(sql`select 1`);
    return Response.json({ ok: true, ts: Date.now() }, { headers });
  } catch (e) {
    console.error("[health]", e);
    const body = process.env.NODE_ENV === "production" ? { ok: false } : { ok: false, error: e instanceof Error ? e.message : "Baza javob bermayapti" };
    return Response.json(body, { status: 503, headers });
  }
}
