import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { getReels } from "@/lib/reels";

const schema = z.object({
  mode: z.enum(["foryou", "new", "top"]).optional().default("foryou"),
  cursor: z.string().max(12).optional(),
});

/** GET ?mode=foryou|new|top&cursor= — Reels lentasining keyingi sahifasi */
export const GET = handler(async (req) => {
  const { mode, cursor } = parseQuery(req.url, schema);
  return ok(await getReels(await optionalViewer(), mode, cursor ?? null, 6));
});
