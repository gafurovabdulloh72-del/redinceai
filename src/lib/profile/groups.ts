import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/lib/db/schema";

/**
 * Profil sahifasidagi «Jamoalari» bo'limi: ijodkor faol a'zo bo'lgan OCHIQ (isPrivate=false) jamoa va kanallar.
 * Yopiq jamoalar hech kimga chiqmaydi (a'zolik ham maxfiy); rasmiy kanal (hamma avtomatik a'zo) ro'yxatni to'ldirmasin — chiqarib tashlanadi.
 */
export interface PublicGroupLite {
  slug: string;
  name: string;
  kind: "group" | "channel";
  membersCount: number;
  coverUrl: string | null;
  /** Ijodkor asoschimi */
  isOwner: boolean;
}

export async function listPublicGroupsOf(userId: string, limit = 6): Promise<PublicGroupLite[]> {
  const rows = await db
    .select({ slug: groups.slug, name: groups.name, kind: groups.kind, membersCount: groups.membersCount, coverUrl: groups.coverUrl, ownerId: groups.ownerId, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active"), eq(groups.isPrivate, false), eq(groups.isOfficial, false)))
    .orderBy(desc(groups.membersCount))
    .limit(limit);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    kind: r.kind === "channel" ? "channel" : "group",
    membersCount: r.membersCount,
    coverUrl: r.coverUrl,
    isOwner: r.ownerId === userId,
  }));
}
