import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";
import { escapeLike } from "@/lib/utils";

/**
 * Admin: foydalanuvchilarni qidirish/ko'rish — ism/email/@taxallus/telefon bo'yicha.
 * Qidiruv va holat filtri SQL darajasida: LIMIT 60 FILTRDAN KEYIN qo'llanadi (avval emas),
 * shuning uchun 60-qatordan nariga "yashiringan" mosliklar yo'qolmaydi. matchTotal — filtrga
 * mos jami son (UI "N ta topildi" deb ko'rsatadi; umumiy global son chalg'itmasin).
 */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const flt = url.searchParams.get("holat"); // "banned" | "active" | "privileged" | "unlisted" | null

  const conds: SQL[] = [];
  if (q) {
    const term = `%${escapeLike(q.toLowerCase())}%`;
    const match = or(
      sql`lower(${users.name}) like ${term} escape '\\'`,
      sql`lower(${users.email}) like ${term} escape '\\'`,
      sql`lower(coalesce(${users.username}, '')) like ${term} escape '\\'`,
      sql`lower(coalesce(${users.phone}, '')) like ${term} escape '\\'`,
    );
    if (match) conds.push(match);
  }
  // Holat filtrlari ham SQL'da — natija to'plami LIMIT'gacha to'g'ri bo'lsin.
  // Diqqat: relational query builder ichki subquery'dagi ${specialists.x} ustunlarini tashqi alias bilan
  // noto'g'ri nomlaydi, shuning uchun subquery xom identifikatorlar bilan (sp alias) yozilgan.
  if (flt === "banned") conds.push(eq(users.isBanned, true));
  else if (flt === "active") conds.push(eq(users.isBanned, false));
  else if (flt === "privileged") conds.push(sql`exists (select 1 from specialists sp where sp.user_id = ${users.id} and sp.is_privileged = 1)`);
  else if (flt === "unlisted") {
    // Katalogda yo'q mutaxassislar: profili yo'q yoki admin yashirgan (isHidden)
    const unlisted = and(eq(users.role, "specialist"), sql`not exists (select 1 from specialists sp where sp.user_id = ${users.id} and sp.is_hidden = 0)`);
    if (unlisted) conds.push(unlisted);
  }
  const where = conds.length ? and(...conds) : undefined;

  const [rows, [{ n: matchTotal }]] = await Promise.all([
    db.query.users.findMany({
      where,
      orderBy: [desc(users.createdAt)],
      limit: 60,
      columns: { id: true, name: true, email: true, username: true, role: true, isBanned: true, bannedReason: true, avatarUrl: true, createdAt: true, lastLoginAt: true },
      with: { specialist: { columns: { slug: true, isPrivileged: true, isHidden: true } } },
    }),
    db.select({ n: sql<number>`count(*)` }).from(users).where(where),
  ]);

  return ok({
    /** Filtr/qidiruvga mos jami son (ko'rsatilganlardan ko'p bo'lishi mumkin) */
    matchTotal: Number(matchTotal),
    /** Eski nom bilan moslik: endi bu ham filtrga mos son (global emas) */
    total: Number(matchTotal),
    items: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      isBanned: u.isBanned,
      bannedReason: u.bannedReason,
      avatarUrl: u.avatarUrl,
      slug: u.specialist?.slug ?? null,
      isPrivileged: u.specialist?.isPrivileged ?? false,
      /** Katalogda ko'rinadimi: profil bor va admin yashirmagan */
      listed: Boolean(u.specialist && !u.specialist.isHidden),
      createdAt: u.createdAt.getTime(),
      lastLoginAt: u.lastLoginAt?.getTime() ?? null,
    })),
  });
});
