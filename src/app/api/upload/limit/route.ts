import { handler, ok, requireSession } from "@/lib/api";
import { isPremium } from "@/lib/social/quota";
import { videoLimitFor } from "@/components/chat/attachments";

/** GET: mening video/audio yuklash chegaram (oddiy 200 MB, premium/imtiyozli 600 MB) */
export const GET = handler(async () => {
  const session = await requireSession();
  const premium = await isPremium(session.sub);
  return ok({ maxBytes: videoLimitFor(premium), premium });
});
