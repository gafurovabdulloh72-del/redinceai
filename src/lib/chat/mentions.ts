import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, users, type Group } from "@/lib/db/schema";
import { extractMentions } from "@/lib/groups/mentions";
import { notify } from "@/lib/notifications";
import { filterBlocked } from "@/lib/privacy/blocks";

/**
 * Guruh chatidagi @eslatma bildirishnomasi (QA A21: havola chizilardi, lekin eslatilgan odamga hech narsa kelmasdi).
 * Chat xabarlari umuman sayt bildirishnomasiga yozilmaydi — @eslatma bundan mustasno (odam nomi bilan chaqirilgan).
 *
 * Kimga ketadi (hammasi bir vaqtda bajarilishi shart):
 *  - eslatilgan foydalanuvchi shu jamoaning FAOL a'zosi (chat faqat a'zolarga ko'rinadi — ochiq jamoada ham; yopiq jamoadagi
 *    matn parchasi begonaga sizmaydi);
 *  - yuboruvchining o'zi emas, bloklanmagan hisob, yuboruvchi bilan blok juftligida emas;
 *  - jamoani jim qilmagan (`muted` yoki `muted_until` hali o'tmagan) — Telegram'da jim chat ham @eslatmada xabar beradi,
 *    lekin bizda «jim» = «bu jamoadan hech narsa kelmasin» degan aniq so'rov.
 * Email yuborilmaydi (kvota) — sayt + Telegram + push. Qaytaradi: xabar ketgan foydalanuvchi id'lari.
 */
export async function notifyChatMentions(opts: { group: Pick<Group, "id" | "slug" | "name" | "kind">; senderId: string; text: string }): Promise<string[]> {
  const names = extractMentions(opts.text);
  if (!names.length) return [];
  const now = Date.now();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(groupMembers, and(eq(groupMembers.userId, users.id), eq(groupMembers.groupId, opts.group.id)))
    .where(
      and(
        inArray(sql`lower(${users.username})`, names),
        eq(users.isBanned, false),
        eq(groupMembers.status, "active"),
        eq(groupMembers.muted, false),
        sql`coalesce(${groupMembers.mutedUntil}, 0) <= ${now}`,
        sql`${users.id} != ${opts.senderId}`,
      ),
    );
  const ids = await filterBlocked(opts.senderId, rows.map((r) => r.id));
  if (!ids.length) return [];
  const sender = await db.query.users.findFirst({ where: eq(users.id, opts.senderId), columns: { name: true } });
  const snippet = opts.text.replace(/\s+/g, " ").trim().slice(0, 140);
  const where = opts.group.kind === "channel" ? "muhokamasida" : "chatida";
  const title = `${sender?.name ?? "Foydalanuvchi"} sizni «${opts.group.name}» ${where} eslatdi`;
  // To'g'ridan chat paneliga (guruh — chat, kanal — «Muhokama» tabi)
  const href = `/kabinet/chat?guruh=${encodeURIComponent(opts.group.slug)}&gtab=chat`;
  await Promise.all(ids.map((id) => notify(id, "mention", title, snippet, href, { skipMail: true }).catch(() => undefined)));
  return ids;
}
