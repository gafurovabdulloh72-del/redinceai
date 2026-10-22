import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { submissionSchema } from "@/lib/mentorship/validators";
import { submitAssignment } from "@/lib/mentorship/learning";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { enforceLimit } from "@/lib/security/rate-limit";

/** POST {body, fileUrl?} — uy vazifasini topshirish (baholanmaguncha qayta yuborish mumkin) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, submissionSchema);
  await enforceLimit("comments", session.sub);
  if (input.fileUrl) await assertOwnUploads(session.sub, [input.fileUrl], [], "fileUrl");
  await submitAssignment(session.sub, id, { body: input.body, fileUrl: input.fileUrl ?? null }, session.role === "admin");
  return ok({ submitted: true }, { status: 201 });
});
