import { z } from "zod";
import { handler, parseQuery, requireSession } from "@/lib/api";
import { createWatcher } from "@/lib/chat/stream";
import { assertActiveMember, loadGroupBySlug } from "@/lib/groups/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel funksiya chegarasi; oqim ~50 s da yopiladi, EventSource o'zi qayta ulanadi (Last-Event-ID = cursor) */
export const maxDuration = 60;

const STREAM_MS = 50_000;
const TICK_MS = 1000;
const PING_MS = 15_000;

const querySchema = z.object({
  conv: z.string().trim().max(64).optional(),
  group: z.string().trim().max(80).optional(),
});

/**
 * SSE oqimi: `dm {conv}` va `group {}` hodisalari (lib/chat/stream.ts). Faqat kirgan foydalanuvchi;
 * jamoa chati — faqat faol a'zo. Hech qanday xabar matni oqimda ketmaydi — mijoz hodisadan keyin
 * odatdagi API'dan (ruxsat tekshiruvlari bilan) qayta so'raydi.
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const q = parseQuery(req.url, querySchema);
  let groupId: string | null = null;
  if (q.group) {
    const g = await loadGroupBySlug(q.group);
    if (g) {
      await assertActiveMember(g, { id: session.sub, role: session.role });
      groupId = g.id;
    }
  }
  const watcher = createWatcher(session.sub, { conv: q.conv ?? null, groupId });
  // Cursor: qayta ulanishda EventSource `Last-Event-ID` yuboradi — o'tkazib yuborilgan o'zgarishlar yo'qolmaydi
  const lastId = Number(req.headers.get("last-event-id"));
  let since = Number.isFinite(lastId) && lastId > 0 ? lastId : Date.now() - 2000;

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(enc.encode(s));
      send("retry: 800\n\n");
      const started = Date.now();
      let lastPing = started;
      let closed = false;
      const onAbort = () => {
        closed = true;
      };
      req.signal.addEventListener("abort", onAbort);
      try {
        while (!closed && Date.now() - started < STREAM_MS) {
          const now = Date.now();
          try {
            const events = await watcher.check(since, now);
            for (const e of events) send(`id: ${now}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
            since = now;
          } catch (e) {
            console.error("[chat:stream]", e instanceof Error ? e.message : e);
          }
          if (Date.now() - lastPing > PING_MS) {
            send(": ping\n\n");
            lastPing = Date.now();
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
        if (!closed) send(`id: ${since}\nevent: reconnect\ndata: {}\n\n`);
      } finally {
        req.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          /* allaqachon yopiq */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
