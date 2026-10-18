import { createHash } from "node:crypto";
import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { fetchLinkPreview } from "@/lib/groups/posts-extra";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "@/app/api/groups/_lib";

const querySchema = z.object({ url: z.string().trim().url().max(2000) });

/**
 * GET ?url= — postdagi havola kartasi (Open Graph sarlavha/tavsif/domen). Server tomonda olinadi: 4 s timeout, 300 KB,
 * faqat ommaviy http(s) hostlar (SSRF himoyasi), 1 soat xotira keshi. Rasm yo'q (CSP img-src cheklangan). Topilmasa — null.
 */
export const GET = handler(async (req) => {
  const { url } = parseQuery(req.url, querySchema);
  const viewer = await optionalViewer();
  const key = viewer ? `u:${viewer.id}` : `a:${createHash("sha256").update((req.headers.get("x-forwarded-for") ?? "0").split(",")[0]).digest("hex").slice(0, 16)}`;
  await enforceLimit("preview", key);
  const data = await fetchLinkPreview(url);
  return ok(data, { headers: { "cache-control": "public, max-age=600" } });
});
