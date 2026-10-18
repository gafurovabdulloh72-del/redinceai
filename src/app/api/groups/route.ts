import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { IMAGE_URL_RE } from "@/components/chat/attachments";
import { createGroup, listGroups } from "@/lib/groups/service";
import { groupInputSchema, groupListQuerySchema } from "@/lib/groups/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "./_lib";

/** GET: jamoalar ro'yxati (?q, ?category, ?region, ?mine=1, ?kind, ?sort) — ommaviy; POST: yangi jamoa (5 / kun) */
export const GET = handler(async (req) => {
  const q = parseQuery(req.url, groupListQuerySchema);
  const viewer = await optionalViewer();
  const items = await listGroups({ q: q.q, category: q.category, region: q.region, mine: q.mine === "1", kind: q.kind || undefined, limit: q.limit, sort: q.sort }, viewer);
  return ok({ items });
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, groupInputSchema);
  await enforceLimit("groups", session.sub);
  if (input.coverUrl) {
    if (!IMAGE_URL_RE.test(input.coverUrl)) throw new ApiError(422, "Muqova rasm bo'lishi kerak", { coverUrl: "Rasmni sayt orqali yuklang" });
    await assertOwnUploads(session.sub, [input.coverUrl], [], "coverUrl");
  }
  // Rasmiy kanal belgisi faqat sayt adminidan qabul qilinadi (oddiy foydalanuvchi yuborsa — e'tiborsiz)
  const g = await createGroup(session.sub, input, { isOfficial: session.role === "admin" && input.isOfficial === true });
  await audit(session.sub, "group_create", { targetType: "group", targetId: g.id, meta: { name: g.name, isPrivate: g.isPrivate } }, req);
  return ok({ id: g.id, slug: g.slug }, { status: 201 });
});
