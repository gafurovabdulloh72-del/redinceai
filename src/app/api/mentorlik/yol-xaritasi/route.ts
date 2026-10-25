import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { roadmapSchema } from "@/lib/mentorship/validators";
import { deleteRoadmap, saveRoadmap } from "@/lib/mentorship/learning";

export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const input = await parseBody(req, roadmapSchema.extend({ id: z.string().optional() }));
  return ok(await saveRoadmap(session.sub, session.role === "admin", input), { status: 201 });
});

export const DELETE = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await deleteRoadmap(session.sub, session.role === "admin", id);
  return ok({ deleted: true });
});
