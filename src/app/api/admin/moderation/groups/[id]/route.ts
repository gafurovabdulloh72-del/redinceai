import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { groupMembers, groups, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { deleteGroup } from "@/lib/groups/service";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { uid } from "@/lib/utils";

const schema = z.object({
  /** Yangi egasining emaili — ega almashtirish */
  ownerEmail: z.string().trim().email("Email noto'g'ri").optional(),
  /** Yopiq/ochiq holatini admin o'zgartiradi */
  isPrivate: z.boolean().optional(),
});

/** Admin: jamoa egasini almashtirish (eski ega admin bo'lib qoladi) yoki yopiq/ochiq holatini o'zgartirish */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const group = await db.query.groups.findFirst({ where: eq(groups.id, id), columns: { id: true, name: true, slug: true, ownerId: true, isOfficial: true } });
  if (!group) throw new ApiError(404, "Jamoa topilmadi");

  if (input.ownerEmail) {
    const next = await db.query.users.findFirst({ where: eq(users.email, input.ownerEmail.toLowerCase()), columns: { id: true, name: true, isBanned: true, role: true } });
    if (!next) throw new ApiError(404, "Bunday emailli foydalanuvchi yo'q", { ownerEmail: "Topilmadi" });
    if (next.isBanned) throw new ApiError(400, "Bloklangan foydalanuvchi ega bo'la olmaydi", { ownerEmail: "Bloklangan" });
    if (next.id === group.ownerId) throw new ApiError(400, "Bu foydalanuvchi allaqachon ega", { ownerEmail: "Allaqachon ega" });
    const prevOwner = group.ownerId;
    await db.transaction(async (tx) => {
      await tx.update(groups).set({ ownerId: next.id }).where(eq(groups.id, id));
      // Yangi ega: a'zolik bo'lsa — roli owner; bo'lmasa yaratiladi
      const m = await tx.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, id), eq(groupMembers.userId, next.id)), columns: { id: true } });
      if (m) await tx.update(groupMembers).set({ role: "owner", status: "active" }).where(eq(groupMembers.id, m.id));
      else await tx.insert(groupMembers).values({ id: uid(), groupId: id, userId: next.id, role: "owner", status: "active" });
      // Eski ega admin bo'lib qoladi (jamoadan chiqarilmaydi)
      await tx.update(groupMembers).set({ role: "admin" }).where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, prevOwner)));
    });
    await audit(session.sub, "admin_group_owner", { targetType: "group", targetId: id, meta: { slug: group.slug, from: prevOwner, to: next.id } }, req);
    await notify(next.id, "account", `Siz «${group.name}» jamoasining egasi bo'ldingiz`, "Administratsiya egalikni sizga o'tkazdi. Sozlamalar va a'zolarni endi siz boshqarasiz.", `/jamoalar/${group.slug}`);
    if (prevOwner !== next.id) await notify(prevOwner, "account", `«${group.name}» egaligi o'tkazildi`, `Yangi ega: ${next.name}. Siz jamoada admin bo'lib qolasiz.`, `/jamoalar/${group.slug}`);
  }

  if (input.isPrivate !== undefined) {
    if (group.isOfficial && input.isPrivate) throw new ApiError(400, "Rasmiy kanal yopiq bo'la olmaydi");
    await db.update(groups).set({ isPrivate: input.isPrivate }).where(eq(groups.id, id));
    await audit(session.sub, input.isPrivate ? "admin_group_private" : "admin_group_public", { targetType: "group", targetId: id, meta: { slug: group.slug } }, req);
  }

  if (!input.ownerEmail && input.isPrivate === undefined) throw new ApiError(400, "O'zgartiriladigan maydon berilmadi");
  const fresh = await db.query.groups.findFirst({ where: eq(groups.id, id), columns: { ownerId: true, isPrivate: true }, with: { owner: { columns: { id: true, name: true, email: true, isBanned: true } } } });
  return ok({ id, isPrivate: fresh?.isPrivate ?? null, owner: fresh?.owner ?? null });
});

/** Admin: jamoani butunlay o'chirish (postlar, chat, a'zoliklar kaskad). Rasmiy kanal o'chirilmaydi. */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const group = await db.query.groups.findFirst({ where: eq(groups.id, id), columns: { id: true, name: true, slug: true, ownerId: true, isOfficial: true, membersCount: true } });
  if (!group) throw new ApiError(404, "Jamoa topilmadi");
  if (group.isOfficial) throw new ApiError(400, "Rasmiy kanal o'chirilmaydi — avval rasmiy belgisini oling");
  await deleteGroup(id);
  await audit(session.sub, "admin_group_delete", { targetType: "group", targetId: id, meta: { slug: group.slug, name: group.name, members: group.membersCount } }, req);
  await notify(group.ownerId, "account", `«${group.name}» jamoasi o'chirildi`, "Jamoa platforma qoidalariga ko'ra administratsiya tomonidan o'chirildi. Savollar bo'lsa qo'llab-quvvatlashga yozing.", "/jamoalar");
  return ok({ deleted: true });
});
