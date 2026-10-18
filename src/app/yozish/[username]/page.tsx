import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getOrCreateConversation } from "@/lib/chat/dm";
import { normalizeUsername } from "@/lib/chat/username";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isBlockedEither } from "@/lib/privacy/blocks";

export const dynamic = "force-dynamic";

/**
 * Chat havolasi: /yozish/<username> — t.me/<nick> kabi ulashiladigan manzil.
 * Kirmagan bo'lsa — login (keyin shu yerga qaytadi); kirgan bo'lsa suhbat ochilib, chatga yo'naltiriladi.
 */
export default async function WritePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = normalizeUsername(decodeURIComponent(raw));

  const me = await getCurrentUser();
  if (!me) redirect(await loginRedirectPath(`/yozish/${username}`));

  const other = await db.query.users.findFirst({ where: eq(users.username, username), columns: { id: true, isBanned: true } });
  if (!other || other.isBanned) redirect("/kabinet/chat");
  if (other.id === me.id) redirect("/kabinet/chat");
  // Blok bo'lsa suhbat yaratilmaydi (siyosat tekshiruvi — xabar yuborishda, /api/chat/[id])
  if (await isBlockedEither(me.id, other.id)) redirect("/kabinet/chat");

  const conv = await getOrCreateConversation(me.id, other.id);
  redirect(`/kabinet/chat?s=${conv.id}`);
}
