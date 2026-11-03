import { handler, ok, requireSession } from "@/lib/api";
import { premiumTier } from "@/lib/social/quota";
import { videoLimitFor } from "@/components/chat/attachments";

/** GET: mening video/audio yuklash chegaram (oddiy 200 MB, premium/imtiyozli 600 MB) */
export const GET = handler(async () => {
  const session = await requireSession();
  const tier = await premiumTier(session.sub);
  return ok({ maxBytes: videoLimitFor(tier), premium: tier !== "free", tier });
});
