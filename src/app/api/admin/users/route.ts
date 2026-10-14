import { desc, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";

/** Admin: foydalanuvchilarni qidirish/ko'rish (bloklash tugmasi uchun) — ism/email/username bo'yicha */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const flt = url.searchParams.get("holat"); // "banned" | "active" | null
  const pat = `%${q.replace(/[%_]/g, " ")}%`;
  const where = q ? or(like(users.name, pat), like(users.email, pat), like(users.username, pat)) : undefined;
  const rows = await db.query.users.findMany({
    where,
    orderBy: [desc(users.createdAt)],
    limit: 200,
    columns: { id: true, name: true, email: true, username: true, role: true, isBanned: true, bannedReason: true, avatarUrl: true, createdAt: true, lastLoginAt: true },
    with: { specialist: { columns: { slug: true } } },
  });
  const filtered = flt === "banned" ? rows.filter((u) => u.isBanned) : flt === "active" ? rows.filter((u) => !u.isBanned) : rows;
  const [{ n: total }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  return ok({
    total: Number(total),
    items: filtered.slice(0, 60).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      isBanned: u.isBanned,
      bannedReason: u.bannedReason,
      avatarUrl: u.avatarUrl,
      slug: u.specialist?.slug ?? null,
      createdAt: u.createdAt.getTime(),
      lastLoginAt: u.lastLoginAt?.getTime() ?? null,
    })),
  });
});
