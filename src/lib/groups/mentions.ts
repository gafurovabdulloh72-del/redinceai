import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, users, type Group } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { MENTION_MAX, MENTION_RE } from "./limits";

/** Matndagi @username'lar (kichik harfda, takrorsiz, ko'pi bilan MENTION_MAX) */
export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    out.add(m[2].toLowerCase());
    if (out.size >= MENTION_MAX) break;
  }
  return [...out];
}

/**
 * @username eslatmalari uchun bildirishnoma ("mention"); xabar yuborilgan foydalanuvchi id'larini qaytaradi. Xavfsizlik: yopiq jamoadagi post/izoh faqat shu jamoaning
 * faol a'zolariga yetadi — kontent begonaga sizmaydi. Muallifning o'zi va `excludeIds` (masalan, izohda post muallifi —
 * u allaqachon "izoh" bildirishnomasini oladi) chetlab o'tiladi. Email yuborilmaydi (kvota), sayt + Telegram.
 */
export async function notifyMentions(opts: {
  text: string;
  actorId: string;
  actorName: string;
  href: string;
  where: "post" | "comment";
  group?: Pick<Group, "id" | "isPrivate"> | null;
  excludeIds?: string[];
}): Promise<string[]> {
  const names = extractMentions(opts.text);
  if (!names.length) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(sql`lower(${users.username})`, names), eq(users.isBanned, false)));
  const skip = new Set([opts.actorId, ...(opts.excludeIds ?? [])]);
  let ids = rows.map((r) => r.id).filter((id) => !skip.has(id));
  if (ids.length && opts.group?.isPrivate) {
    const members = await db.query.groupMembers.findMany({
      where: and(eq(groupMembers.groupId, opts.group.id), eq(groupMembers.status, "active"), inArray(groupMembers.userId, ids)),
      columns: { userId: true },
    });
    const allowed = new Set(members.map((m) => m.userId));
    ids = ids.filter((id) => allowed.has(id));
  }
  if (!ids.length) return [];
  const snippet = opts.text.replace(/\s+/g, " ").trim().slice(0, 140);
  const title = `${opts.actorName} sizni ${opts.where === "post" ? "postda" : "izohda"} eslatdi`;
  await Promise.all(ids.map((id) => notify(id, "mention", title, snippet, opts.href, { skipMail: true }).catch(() => undefined)));
  return ids;
}
