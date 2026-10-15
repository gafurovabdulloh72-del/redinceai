import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { DISPUTE_RESOLUTIONS, resolveDispute } from "@/lib/payments/disputes";

const schema = z.object({
  resolution: z.enum(DISPUTE_RESOLUTIONS),
  /** Qaror izohi majburiy (kamida 5 belgi) — tomonlar sababsiz qaror olmasin */
  note: z.string().trim().min(5, "Kamida 5 belgi").max(500, "Ko'pi bilan 500 belgi"),
});

/** Admin nizo qarori: release — eskrou mutaxassisga; refund — mijozga qaytariladi. Izoh majburiy. Tomonlarga bildirishnoma + jurnal. */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { resolution, note } = await parseBody(req, schema);
  const result = await resolveDispute(id, session.sub, resolution, note.trim(), req);
  return ok({ id, disputeState: "resolved" as const, resolution: result.resolution });
});
