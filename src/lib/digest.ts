import "server-only";
import { and, count, eq, gt, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, postComments, postLikes, postViews, posts, profileViews, users } from "@/lib/db/schema";
import { unreadDmCount } from "@/lib/chat/dm";
import { notify } from "@/lib/notifications";
import { creatorOnboarding, ONBOARDING_DAYS, type OnboardingKey } from "@/lib/onboarding";

/**
 * Jamlama xabarnoma (kunlik / haftalik): oxirgi jamlamadan beri nima o'zgargani — yangi obunachilar, reaksiyalar, izohlar,
 * ko'rishlar, o'qilmagan xabarlar — bitta qisqa xabar bilan sayt ichi + Telegram + email (notify fan-out) orqali.
 *  · Foydalanuvchi tanlaydi: users.digest_freq (off | daily | weekly). Yangi ro'yxatdan o'tganlarga standart — weekly, eskilarga — off.
 *  · Hech narsa bo'lmasa XABAR YUBORILMAYDI (bo'sh xat spam bo'lmasin) — faqat yangi ijodkorga (ONBOARDING_DAYS) «keyingi qadam» eslatmasi boradi.
 *  · Cron (kunlik) chaqiradi: `runDigests()`. Bir foydalanuvchiga ikki marta yuborilmasin — `digest_last_at` CAS bilan band qilinadi.
 */
export type DigestFreq = "off" | "daily" | "weekly";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/**
 * Keyingi jamlama uchun minimal oraliq. Cron har kuni bir xil vaqtda emas (kechikish bo'lishi mumkin) — shuning uchun
 * kunlik uchun 20 soat, haftalik uchun 6,5 kun (aks holda 1 daqiqa kechikkan cron kunni o'tkazib yuboradi).
 */
const GAP_MS: Record<Exclude<DigestFreq, "off">, number> = { daily: 20 * HOUR_MS, weekly: 6.5 * DAY_MS };
/** Statistika oynasi uzunligi (oxirgi jamlama bo'lmasa shuncha orqaga qaraymiz) */
const WINDOW_MS: Record<Exclude<DigestFreq, "off">, number> = { daily: DAY_MS, weekly: 7 * DAY_MS };
/** Bitta cron ishida ko'pi bilan shuncha foydalanuvchi (qolganlari keyingi kunga; eng uzoq kutganlar birinchi) */
const BATCH = 150;
/** Parallel ishlov: bazaga bir vaqtda ortiqcha so'rov tushmasin */
const CONCURRENCY = 6;

export interface DigestStats {
  followers: number;
  reactions: number;
  comments: number;
  postViews: number;
  profileViews: number;
  unreadMessages: number;
}

export interface DigestMessage {
  title: string;
  body: string;
  href: string;
}

const NEXT_STEP_TEXT: Record<OnboardingKey, string> = {
  profile: "ijodkor profilingizni yarating",
  avatar: "profil rasmingizni yuklang",
  bio: "o'zingiz haqingizda yozing",
  portfolio: "birinchi portfolio ishingizni qo'shing",
  post: "birinchi postingizni joylang",
  community: "biror jamoaga qo'shiling",
  telegram: "Telegram'ni ulang — xabarlar telefoningizga keladi",
};

/** Berilgan vaqtdan beri hisoblar. Mutaxassis bo'lmasa profil ko'rishlari 0. */
export async function digestStats(userId: string, specialistId: string | null, since: Date): Promise<DigestStats> {
  const [fol, rea, com, pv, prof, dm] = await Promise.all([
    db.select({ n: count() }).from(follows).where(and(eq(follows.followingId, userId), gt(follows.createdAt, since))),
    // O'z postiga o'zi bergan reaksiya/izoh hisobga olinmaydi
    db
      .select({ n: count() })
      .from(postLikes)
      .innerJoin(posts, eq(posts.id, postLikes.postId))
      .where(and(eq(posts.authorId, userId), ne(postLikes.userId, userId), gt(postLikes.createdAt, since))),
    db
      .select({ n: count() })
      .from(postComments)
      .innerJoin(posts, eq(posts.id, postComments.postId))
      .where(and(eq(posts.authorId, userId), ne(postComments.authorId, userId), gt(postComments.createdAt, since))),
    db
      .select({ n: count() })
      .from(postViews)
      .innerJoin(posts, eq(posts.id, postViews.postId))
      .where(and(eq(posts.authorId, userId), gt(postViews.createdAt, since))),
    specialistId ? db.select({ n: count() }).from(profileViews).where(and(eq(profileViews.specialistId, specialistId), gt(profileViews.createdAt, since))) : Promise.resolve([{ n: 0 }]),
    unreadDmCount(userId).catch(() => 0),
  ]);
  return {
    followers: fol[0]?.n ?? 0,
    reactions: rea[0]?.n ?? 0,
    comments: com[0]?.n ?? 0,
    postViews: pv[0]?.n ?? 0,
    profileViews: prof[0]?.n ?? 0,
    unreadMessages: dm,
  };
}

/** Sonlar → «3 yangi obunachi · 12 reaksiya · …» (nol bo'lganlar tushiriladi); bo'sh bo'lsa null */
export function digestLine(s: DigestStats): string | null {
  const parts: string[] = [];
  if (s.followers) parts.push(`${s.followers} yangi obunachi`);
  if (s.reactions) parts.push(`${s.reactions} reaksiya`);
  if (s.comments) parts.push(`${s.comments} izoh`);
  if (s.postViews) parts.push(`${s.postViews} post ko'rish`);
  if (s.profileViews) parts.push(`${s.profileViews} profil ko'rish`);
  if (s.unreadMessages) parts.push(`${s.unreadMessages} o'qilmagan xabar`);
  return parts.length ? parts.join(" · ") : null;
}

interface DigestUser {
  id: string;
  role: string;
  digestFreq: DigestFreq;
  digestLastAt: Date | null;
  createdAt: Date;
  avatarUrl: string | null;
  telegramChatId: string | null;
  specialist: Parameters<typeof creatorOnboarding>[0]["specialist"];
}

/** Bitta foydalanuvchi uchun jamlama matni; yuboriladigan narsa bo'lmasa null */
export async function buildDigest(u: DigestUser, now: number): Promise<DigestMessage | null> {
  if (u.digestFreq === "off") return null;
  const window = WINDOW_MS[u.digestFreq];
  // Oyna boshi: oxirgi jamlama, lekin ko'pi bilan 1,3 oyna orqaga (uzoq to'xtashdan keyin eski voqealar to'planib ketmasin)
  const since = new Date(Math.max(u.digestLastAt?.getTime() ?? u.createdAt.getTime(), now - window * 1.3));
  const stats = await digestStats(u.id, u.specialist?.id ?? null, since);
  const line = digestLine(stats);

  // Yangi ijodkorga «keyingi qadam» — faqat birinchi 45 kunda va tugallanmagan bo'lsa
  let step: { key: OnboardingKey; href: string } | null = null;
  if ((u.specialist || u.role === "specialist") && now - u.createdAt.getTime() < ONBOARDING_DAYS * DAY_MS) {
    const ob = await creatorOnboarding(u).catch(() => null);
    if (ob?.next) step = { key: ob.next.key, href: ob.next.href };
  }
  if (!line && !step) return null;

  const label = u.digestFreq === "daily" ? "Kunlik jamlama" : "Haftalik jamlama";
  const bits: string[] = [];
  if (line) bits.push(line + ".");
  if (step) bits.push(`${line ? "Keyingi qadam" : "Profilingizni to'ldiring"}: ${NEXT_STEP_TEXT[step.key]}.`);
  return { title: line ? `${label}: ${u.digestFreq === "daily" ? "kecha" : "o'tgan hafta"} nima bo'ldi` : `${label}: boshlanish uchun bitta qadam`, body: bits.join(" "), href: line ? "/kabinet" : (step?.href ?? "/kabinet") };
}

export interface DigestRun {
  due: number;
  sent: number;
  skipped: number;
  errors: string[];
}

/** Hozir jamlama yuborilishi kerak bo'lgan shartlar (SQL): oxirgi jamlama (yoki ro'yxatdan o'tish) + oraliq o'tgan */
function dueCondition(now: number) {
  const base = sql`coalesce(${users.digestLastAt}, ${users.createdAt})`;
  return and(
    eq(users.isBanned, false),
    or(
      and(eq(users.digestFreq, "daily"), lt(base, now - GAP_MS.daily)),
      and(eq(users.digestFreq, "weekly"), lt(base, now - GAP_MS.weekly)),
    ),
  );
}

/**
 * Cron: navbatdagi foydalanuvchilarga jamlama yuborish. `dry` — faqat nechta kerakligini sanaydi.
 * Har foydalanuvchi uchun avval `digest_last_at` band qilinadi (CAS) — parallel cron ishlari ikki marta yubormaydi;
 * yuborilmasa ham (bo'sh) oyna oldinga suriladi.
 */
export async function runDigests(now = Date.now(), opts: { dry?: boolean } = {}): Promise<DigestRun> {
  const out: DigestRun = { due: 0, sent: 0, skipped: 0, errors: [] };
  const cond = dueCondition(now);
  if (opts.dry) {
    const [r] = await db.select({ n: count() }).from(users).where(cond);
    out.due = r?.n ?? 0;
    return out;
  }
  const rows = await db.query.users.findMany({
    where: cond,
    columns: { id: true, role: true, digestFreq: true, digestLastAt: true, createdAt: true, avatarUrl: true, telegramChatId: true },
    with: { specialist: true },
    orderBy: sql`coalesce(${users.digestLastAt}, ${users.createdAt}) asc`,
    limit: BATCH,
  });
  out.due = rows.length;

  const one = async (u: (typeof rows)[number]) => {
    try {
      const gap = GAP_MS[u.digestFreq === "daily" ? "daily" : "weekly"];
      // CAS: shu oraliq hali o'tgan bo'lsa band qilamiz; boshqa ish allaqachon band qilgan bo'lsa — o'tkazib yuboramiz
      const claim = await db
        .update(users)
        .set({ digestLastAt: new Date(now) })
        .where(and(eq(users.id, u.id), sql`coalesce(${users.digestLastAt}, ${users.createdAt}) < ${now - gap}`));
      if (!claim.rowsAffected) return;
      const msg = await buildDigest({ ...u, digestFreq: u.digestFreq }, now);
      if (!msg) {
        out.skipped += 1;
        return;
      }
      await notify(u.id, "digest", msg.title, msg.body, msg.href);
      out.sent += 1;
    } catch (e) {
      out.errors.push(`digest ${u.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  for (let i = 0; i < rows.length; i += CONCURRENCY) await Promise.all(rows.slice(i, i + CONCURRENCY).map(one));
  return out;
}
