import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { fetchLinkPreview } from "@/lib/chat/link-preview";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ url: z.string().trim().url().max(500) });

/**
 * GET ?url= — xabar matnidagi havola prevyusi (OG). Faqat kirgan foydalanuvchi; https va ommaviy hostlar;
 * natija (yoki null) serverda 1 soat keshlanadi, klientga ham 1 soat (private) kesh beriladi.
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const { url } = parseQuery(req.url, schema);
  await enforceLimit("linkPreview", session.sub);
  const preview = await fetchLinkPreview(url);
  return ok({ preview }, { headers: { "cache-control": "private, max-age=3600" } });
});
