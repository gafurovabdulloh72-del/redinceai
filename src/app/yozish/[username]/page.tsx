import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getOrCreateConversation } from "@/lib/chat/dm";
import { normalizeUsername } from "@/lib/chat/username";
import { db } from "@/lib/db";
import { conversations, users } from "@/lib/db/schema";
import { assertCanDm, isBlockedEither } from "@/lib/privacy/blocks";

export const dynamic = "force-dynamic";

/**
 * Chat havolasi: /yozish/<username> — t.me/<nick> kabi ulashiladigan manzil.
 * Kirmagan bo'lsa — login (keyin shu yerga qaytadi); kirgan bo'lsa suhbat ochilib, chatga yo'naltiriladi.
 * Ochib bo'lmasa — SABABI bilan chat ro'yxatiga (`?xato=`, sahifa tepasida ko'rsatiladi): ilgari noto'g'ri taxallus yoki
 * blok holatida foydalanuvchi hech qanday izohsiz ro'yxatga tushib qolardi (guruh chatidagi mavjud bo'lmagan @eslatma
 * havolasi ham shu yerga keladi).
 *   topilmadi — bunday taxallus yo'q yoki hisob bloklangan;  ozim — o'z taxallusi;
 *   blok — juftlikda blok bor (qaysi tomon qo'ygani aytilmaydi);  yopiq — «kim yozishi mumkin» siyosati ruxsat bermaydi.
 */
export default async function WritePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = normalizeUsername(decodeURIComponent(raw));

  const me = await getCurrentUser();
  if (!me) redirect(await loginRedirectPath(`/yozish/${username}`));

  let other = await db.query.users.findFirst({ where: eq(users.username, username), columns: { id: true, isBanned: true, dmPolicy: true } });
  // Kamchilik #39: taxallus o'zgargan bo'lsa eski manzil ham ishlaydi (boshqa hisob egallamagan bo'lsa)
  if (!other) other = await db.query.users.findFirst({ where: eq(users.prevUsername, username), columns: { id: true, isBanned: true, dmPolicy: true } });
  if (!other || other.isBanned) redirect("/kabinet/chat?xato=topilmadi");
  if (other.id === me.id) redirect("/kabinet/chat?xato=ozim");
  // Blok yoki «kim yozishi mumkin» siyosati ruxsat bermasa — suhbat YARATILMAYDI (aks holda bo'sh suhbat
  // qabul qiluvchi ro'yxatida paydo bo'lib, dm_policy chetlab o'tilar edi)
  if (await isBlockedEither(me.id, other.id)) redirect("/kabinet/chat?xato=blok");
  const existing = await db.query.conversations.findFirst({
    where: and(eq(conversations.aId, me.id < other.id ? me.id : other.id), eq(conversations.bId, me.id < other.id ? other.id : me.id)),
    columns: { id: true, lastMessageAt: true },
  });
  try {
    await assertCanDm(me.id, other, Boolean(existing?.lastMessageAt));
  } catch {
    redirect("/kabinet/chat?xato=yopiq");
  }

  const conv = await getOrCreateConversation(me.id, other.id);
  redirect(`/kabinet/chat?s=${conv.id}`);
}
