import { clearSession } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const POST = handler(async () => {
  await clearSession();
  return ok({ loggedOut: true });
});
