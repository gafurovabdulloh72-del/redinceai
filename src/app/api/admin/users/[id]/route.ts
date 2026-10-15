import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { bumpSessionVersion } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { ensureShortCode } from "@/lib/queries";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { slugify, uid } from "@/lib/utils";

const schema = z.object({
  isBanned: z.boolean().optional(),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  /** Imtiyozli shaxs (faqat mutaxassis profili bor foydalanuvchiga): obuna talab qilinmaydi */
  isPrivileged: z.boolean().optional(),
  /** Katalogda ko'rsatish: true — profili bo'lmasa minimal profil yaratiladi (imtiyozli), yashirilgan bo'lsa ochiladi; false — yashiriladi */
  listed: z.boolean().optional(),
});

/**
 * Admin: foydalanuvchini bloklash / blokdan chiqarish (F87). Bloklanganda barcha sessiyalari bekor qilinadi
 * (sessionVersion +1); kirish va ro'yxatda ko'rinish auth/listSpecialists tomonida isBanned bo'yicha tekshiriladi.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { isBanned, reason, isPrivileged, listed } = await parseBody(req, schema);

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, role: true, isBanned: true, name: true },
    with: { specialist: { columns: { id: true, slug: true, isPrivileged: true, isHidden: true } } },
  });
  if (!user) throw new ApiError(404, "Foydalanuvchi topilmadi");

  // Katalogda ko'rsatish / yashirish (admin qo'lda boshqaradi — profilini to'ldirmaganlar ham qo'shilsin)
  if (listed !== undefined) {
    if (user.role === "admin") throw new ApiError(400, "Administrator katalogga qo'shilmaydi");
    let slug = user.specialist?.slug ?? null;
    if (listed && !user.specialist) {
      // Minimal profil: foydalanuvchi keyin kabinetda to'ldiradi. Imtiyozli — obuna sababli yashirinib qolmasin
      const spId = uid();
      const base = slugify(user.name) || "mutaxassis";
      const taken = await db.query.specialists.findFirst({ where: and(eq(specialists.slug, base), ne(specialists.id, spId)), columns: { id: true } });
      slug = taken ? `${base}-${spId.slice(0, 6)}` : base;
      const region = REGIONS[0];
      await db.insert(specialists).values({
        id: spId,
        userId: user.id,
        slug,
        title: "Mutaxassis",
        category: CATEGORIES[0].slug,
        regionSlug: region.slug,
        city: region.capital,
        isPrivileged: true,
        isHidden: false,
      });
      await ensureShortCode(spId);
      if (user.role === "client") await db.update(users).set({ role: "specialist" }).where(eq(users.id, user.id));
      await audit(session.sub, "admin_profile_created", { targetType: "user", targetId: id, meta: { name: user.name, slug } }, req);
      await notify(
        id,
        "account",
        "Profilingiz katalogga qo'shildi",
        "Administratsiya sizni mutaxassislar katalogiga qo'shdi. Kabinetda yo'nalish, hudud, narx va portfolioni to'ldiring — mijozlar sizni topishi oson bo'ladi.",
        "/kabinet/profil",
      );
    } else if (user.specialist) {
      await db.update(specialists).set({ isHidden: !listed }).where(eq(specialists.id, user.specialist.id));
      await audit(session.sub, listed ? "admin_listed_on" : "admin_listed_off", { targetType: "user", targetId: id, meta: { name: user.name } }, req);
      if (!listed) await notify(id, "account", "Profilingiz katalogdan vaqtincha yashirildi", "Savollar bo'lsa qo'llab-quvvatlashga yozing.", "/kabinet/profil");
    } else {
      // listed=false va profil yo'q — qilinadigan ish yo'q
    }
    if (isBanned === undefined && isPrivileged === undefined) return ok({ id, listed, slug });
  }

  // Imtiyozli shaxs belgisi — obunadan ozod qiladi (faqat mutaxassis profiliga ta'sir qiladi)
  if (isPrivileged !== undefined) {
    if (!user.specialist) throw new ApiError(400, "Imtiyoz faqat mutaxassis profili bor foydalanuvchiga belgilanadi");
    await db.update(specialists).set({ isPrivileged }).where(eq(specialists.id, user.specialist.id));
    await audit(session.sub, isPrivileged ? "admin_privilege_on" : "admin_privilege_off", { targetType: "user", targetId: id, meta: { name: user.name } }, req);
    await notify(
      id,
      "account",
      isPrivileged ? "Sizga imtiyoz berildi" : "Imtiyoz bekor qilindi",
      isPrivileged ? "Administratsiya sizni imtiyozli shaxs sifatida belgiladi — obuna talab qilinmaydi, profilingiz doim ko'rinadi." : "Endi obuna odatdagi tartibda amal qiladi.",
      "/kabinet/obuna",
    );
    if (isBanned === undefined) return ok({ id, isPrivileged });
  }

  if (isBanned === undefined) throw new ApiError(400, "O'zgartiriladigan maydon berilmadi");
  if (id === session.sub) throw new ApiError(400, "O'zingizni bloklay olmaysiz");
  if (user.role === "admin") throw new ApiError(400, "Administratorni bloklab bo'lmaydi");
  if (isBanned && !reason?.trim()) throw new ApiError(422, "Bloklash sababini yozing", { reason: "Sabab majburiy" });

  const why = reason?.trim() || null;
  await db
    .update(users)
    .set({ isBanned, bannedReason: isBanned ? why : null })
    .where(eq(users.id, id));
  if (isBanned) await bumpSessionVersion(id);

  await audit(session.sub, isBanned ? "admin_ban" : "admin_unban", { targetType: "user", targetId: id, meta: { reason: why ?? undefined, name: user.name } }, req);
  await notify(
    id,
    "account",
    isBanned ? "Hisobingiz bloklandi" : "Hisobingiz blokdan chiqarildi",
    isBanned ? `Sabab: ${why}. Savollar bo'lsa qo'llab-quvvatlash bilan bog'laning.` : "Platformadan yana to'liq foydalanishingiz mumkin.",
    "/kabinet",
  );
  return ok({ id, isBanned, bannedReason: isBanned ? why : null });
});
