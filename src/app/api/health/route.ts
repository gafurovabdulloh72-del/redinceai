import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Railway healthcheck: baza javob bersa 200 */
export async function GET() {
  try {
    await db.run(sql`select 1`);
    return Response.json({ ok: true, ts: Date.now() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
