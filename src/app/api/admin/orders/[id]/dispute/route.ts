import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { DISPUTE_RESOLUTIONS, resolveDispute } from "@/lib/payments/disputes";

const schema = z.object({
  resolution: z.enum(DISPUTE_RESOLUTIONS),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Admin nizo qarori: release — eskrou mutaxassisga; refund — mijozga qaytariladi. Tomonlarga bildirishnoma + jurnal. */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { resolution, note } = await parseBody(req, schema);
  const result = await resolveDispute(id, session.sub, resolution, note?.trim() || null, req);
  return ok({ id, disputeState: "resolved" as const, resolution: result.resolution });
});
