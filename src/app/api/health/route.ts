import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Railway healthcheck: baza javob bersa 200 (xato matni faqat server logida) */
export async function GET() {
  try {
    await db.run(sql`select 1`);
    return Response.json({ ok: true, ts: Date.now() });
  } catch (e) {
    console.error("[health]", e);
    return Response.json({ ok: false, error: "Baza javob bermayapti" }, { status: 503 });
  }
}
