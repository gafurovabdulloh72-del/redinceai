import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, type Schedule, type Visibility } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { privacyUpdateSchema } from "@/lib/validators";
import { WEEKDAYS, type VisibilityFieldKey } from "@/lib/constants";
import { clampVisibilityLevel, resolveVisibility, tashkentNow, toMinutes } from "@/lib/privacy";
import { enforceLimit } from "@/lib/security/rate-limit";

async function ownSpecialist(userId: string) {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.userId, userId),
    columns: { id: true, slug: true, visibility: true, schedule: true, vacationUntil: true, blockedDates: true },
  });
  if (!sp) throw new ApiError(404, "Avval mutaxassis profilini yarating");
  return sp;
}

/** Joriy maxfiylik va ish vaqti sozlamalari (faqat egasi) */
export const GET = handler(async () => {
  const session = await requireSession();
  const sp = await ownSpecialist(session.sub);
  return ok({
    slug: sp.slug,
    visibility: resolveVisibility(sp.visibility),
    schedule: sp.schedule ?? null,
    vacationUntil: sp.vacationUntil ?? null,
    blockedDates: upcomingDates(sp.blockedDates ?? []),
  });
});

/** Band kunlar oynasi (F41): bugundan boshlab shuncha kun (kalendar 90 kunni ko'rsatadi, biroz zaxira bilan) */
const BLOCKED_WINDOW_DAYS = 120;

/** Haqiqiy sana (YYYY-MM-DD) — 2026-02-30 kabilar rad etiladi */
function isRealDate(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** O'tgan sanalarsiz, takrorsiz, tartiblangan */
function upcomingDates(list: string[]) {
  const today = tashkentNow().date;
  return [...new Set(list)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).sort();
}

/**
 * Maxfiylik (qaysi maydon kimga ko'rinadi), ish vaqti va ta'til sanasini yangilash.
 * - visibility: qisman — berilgan kalitlar mavjudlari ustiga yoziladi
 * - schedule: berilmasa tegilmaydi; null — jadval o'chiriladi
 * - vacationUntil: berilmasa tegilmaydi; ""/null — ta'til bekor
 * - blockedDates (F41): berilmasa tegilmaydi; o'tgan sanalar tashlab yuboriladi, 120 kundan uzoq — 422
 */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  const sp = await ownSpecialist(session.sub);
  const input = await parseBody(req, privacyUpdateSchema);
  // Per-user limit (E21) — tekshiruvdan keyin, 422 javoblar limitni yemasin
  await enforceLimit("privacy", session.sub);

  const patch: Partial<{ visibility: Visibility; schedule: Schedule | null; vacationUntil: string | null; blockedDates: string[]; updatedAt: Date }> = { updatedAt: new Date() };

  const nextVisibility: Visibility = { ...(sp.visibility ?? {}) };
  for (const [k, v] of Object.entries(input.visibility)) {
    // Platforma qoidasi: aloqa maydonlarida public/clients jimgina "orders"ga tushiriladi (xato qaytarilmaydi)
    if (v) (nextVisibility as Record<string, string>)[k] = clampVisibilityLevel(k as VisibilityFieldKey, v);
  }
  patch.visibility = nextVisibility;

  if (input.schedule !== undefined) {
    if (input.schedule === null) {
      patch.schedule = null;
    } else {
      const fields: Record<string, string> = {};
      for (const d of WEEKDAYS) {
        const day = input.schedule.days[d.key];
        if (day.enabled && toMinutes(day.from) >= toMinutes(day.to)) fields[`schedule.days.${d.key}`] = `${d.label}: tugash vaqti boshlanishdan keyin bo'lsin`;
      }
      if (Object.keys(fields).length) throw new ApiError(422, "Ish vaqtini tekshiring", fields);
      patch.schedule = { days: input.schedule.days, note: input.schedule.note?.trim() || "" };
    }
  }

  if (input.vacationUntil !== undefined) {
    const v = input.vacationUntil?.trim() || null;
    if (v) {
      const [y, m, d] = v.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new ApiError(422, "Sana noto'g'ri", { vacationUntil: "Sana noto'g'ri" });
      // O'tgan sana "ta'til yo'q" degani — saqlamaymiz (isOnVacation: bugun ham ta'til hisoblanadi)
      if (v < tashkentNow().date) throw new ApiError(422, "Sana o'tib ketgan", { vacationUntil: "Sana o'tib ketgan" });
      if (dt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) throw new ApiError(422, "Sana juda uzoq", { vacationUntil: "Ta'til 1 yildan oshmasin" });
    }
    patch.vacationUntil = v;
  }

  if (input.blockedDates !== undefined) {
    const bad = input.blockedDates.find((d) => !isRealDate(d));
    if (bad) throw new ApiError(422, "Sana noto'g'ri", { blockedDates: `Sana noto'g'ri: ${bad}` });
    const limit = tashkentNow(Date.now() + BLOCKED_WINDOW_DAYS * 24 * 60 * 60 * 1000).date;
    const next = upcomingDates(input.blockedDates);
    if (next.some((d) => d > limit)) throw new ApiError(422, "Sana juda uzoq", { blockedDates: `Band kunlarni ${BLOCKED_WINDOW_DAYS} kun ichida belgilang` });
    patch.blockedDates = next;
  }

  await db.update(specialists).set(patch).where(eq(specialists.id, sp.id));

  return ok({
    slug: sp.slug,
    visibility: resolveVisibility(patch.visibility),
    schedule: patch.schedule !== undefined ? patch.schedule : (sp.schedule ?? null),
    vacationUntil: patch.vacationUntil !== undefined ? patch.vacationUntil : (sp.vacationUntil ?? null),
    blockedDates: patch.blockedDates ?? upcomingDates(sp.blockedDates ?? []),
  });
});
