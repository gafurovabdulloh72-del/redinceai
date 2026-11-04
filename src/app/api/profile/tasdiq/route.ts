import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { requestVerification, verificationStatus } from "@/lib/verification";

/** GET: tasdiq holati va mezonlar (faqat o'zi); POST: «Tasdiqlash so'rovi» — mezonlar bajarilgan bo'lsa (lib/verification.ts) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok(await verificationStatus(session.sub));
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("profile", session.sub);
  const res = await requestVerification(session.sub, session.name ?? "Mutaxassis");
  await audit(session.sub, "verification_requested", { targetType: "user", targetId: session.sub }, req);
  return ok(res, { status: 201 });
});
