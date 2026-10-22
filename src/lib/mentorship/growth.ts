import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { certificates, courses, enrollments, lessonCompletions, lessonComments, lessons, liveStreams, liveTickets, mentorSubs, mentors, posts, subscriptionInvoices } from "@/lib/db/schema";

/* ------------------------------ Belgilar ------------------------------ */
export type MentorBadge = { key: string; label: string; hint: string };

/** Mentor ishonch belgilari: hammasi haqiqiy ko'rsatkichdan hisoblanadi (qo'lda berilmaydi) */
export async function mentorBadges(m: { id: string; userId: string; channelId: string | null; studentsCount: number; rating: number; reviewsCount: number }): Promise<MentorBadge[]> {
  const out: MentorBadge[] = [];
  if (m.studentsCount >= 50) out.push({ key: "many", label: "Ko'p o'rgatgan", hint: `${m.studentsCount} talaba` });
  if (m.rating >= 4.7 && m.reviewsCount >= 5) out.push({ key: "rated", label: "Yuqori baho", hint: `${m.rating} · ${m.reviewsCount} sharh` });

  // Tez javob: ustozning so'nggi javoblari savoldan o'rtacha 24 soatdan tez
  const replies = await db.query.lessonComments.findMany({ where: and(eq(lessonComments.userId, m.userId), isNotNull(lessonComments.parentId)), orderBy: [desc(lessonComments.createdAt)], limit: 40, columns: { parentId: true, createdAt: true } });
  if (replies.length >= 3) {
    const parents = await db.query.lessonComments.findMany({ where: inArray(lessonComments.id, replies.map((r) => r.parentId as string)), columns: { id: true, createdAt: true } });
    const pm = new Map(parents.map((p) => [p.id, p.createdAt.getTime()]));
    const diffs = replies.map((r) => (pm.has(r.parentId as string) ? r.createdAt.getTime() - (pm.get(r.parentId as string) as number) : null)).filter((x): x is number => x !== null && x >= 0).sort((a, b) => a - b);
    if (diffs.length >= 3 && diffs[Math.floor(diffs.length / 2)] < 24 * 3600_000) out.push({ key: "fast", label: "Tez javob beradi", hint: "Savollarga odatda 24 soat ichida javob beradi" });
  }
  if (m.channelId) {
    const recent = await db.query.liveStreams.findFirst({ where: and(eq(liveStreams.groupId, m.channelId), gt(liveStreams.startedAt, new Date(Date.now() - 30 * 86_400_000))), columns: { id: true } });
    if (recent) out.push({ key: "live", label: "Faol efirchi", hint: "So'nggi 30 kunda jonli efir o'tkazgan" });
  }
  return out;
}

/* ------------------------- Jonli efirlar (katalog) ------------------------- */
export type LiveItem = { key: string; title: string; mentorName: string; mentorSlug: string | null; photoUrl: string | null; avatarUrl: string | null; live: boolean; startsAt: number; price: number };

/** Hozir jonli va bu hafta rejalashtirilgan ustoz efirlari */
export async function liveAndUpcoming(limit = 8): Promise<LiveItem[]> {
  const ms = await db.query.mentors.findMany({ where: and(eq(mentors.isApproved, true), isNotNull(mentors.channelId)), with: { user: { columns: { name: true, avatarUrl: true } } }, columns: { id: true, slug: true, channelId: true, photoUrl: true } });
  if (!ms.length) return [];
  const byChannel = new Map(ms.map((m) => [m.channelId as string, m]));
  const ids = [...byChannel.keys()];
  const now = Date.now();
  const [liveRows, eventRows] = await Promise.all([
    db.query.liveStreams.findMany({ where: and(inArray(liveStreams.groupId, ids), eq(liveStreams.status, "live"), gt(liveStreams.startedAt, new Date(now - 6 * 3600_000))) }),
    db.query.posts.findMany({ where: and(inArray(posts.groupId, ids), isNotNull(posts.eventAt), gt(posts.eventAt, new Date(now - 30 * 60_000)), sql`${posts.eventAt} < ${now + 7 * 86_400_000}`), orderBy: [asc(posts.eventAt)], limit: 30, columns: { id: true, groupId: true, body: true, eventAt: true } }),
  ]);
  const toItem = (gid: string, key: string, title: string, live: boolean, startsAt: number, price: number): LiveItem | null => {
    const m = byChannel.get(gid);
    return m ? { key, title, mentorName: m.user.name, mentorSlug: m.slug, photoUrl: m.photoUrl, avatarUrl: m.user.avatarUrl, live, startsAt, price } : null;
  };
  const items = [
    ...liveRows.map((l) => toItem(l.groupId, `l${l.id}`, l.title, true, l.startedAt.getTime(), l.priceSom)),
    ...eventRows.map((e) => toItem(e.groupId as string, `e${e.id}`, e.body.split("\n")[0]?.slice(0, 80) || "Jonli efir", false, (e.eventAt as Date).getTime(), 0)),
  ].filter((x): x is LiveItem => Boolean(x));
  return items.sort((a, b) => Number(b.live) - Number(a.live) || a.startsAt - b.startsAt).slice(0, limit);
}

/* ------------------------------ Tahlil ------------------------------ */
export async function mentorAnalytics(mentorId: string, channelId: string | null) {
  const cs = await db.query.courses.findMany({ where: eq(courses.mentorId, mentorId), orderBy: [desc(courses.createdAt)] });
  const ids = cs.map((c) => c.id);
  const [enr, comps, certs, lessonRows, paid] = await Promise.all([
    ids.length ? db.query.enrollments.findMany({ where: inArray(enrollments.courseId, ids), columns: { courseId: true, progressPct: true } }) : [],
    ids.length ? db.select({ lessonId: lessonCompletions.lessonId, n: sql<number>`count(*)` }).from(lessonCompletions).where(inArray(lessonCompletions.courseId, ids)).groupBy(lessonCompletions.lessonId) : [],
    ids.length ? db.select({ courseId: certificates.courseId, n: sql<number>`count(*)` }).from(certificates).where(inArray(certificates.courseId, ids)).groupBy(certificates.courseId) : [],
    ids.length ? db.query.lessons.findMany({ where: inArray(lessons.courseId, ids), orderBy: [asc(lessons.position)], columns: { id: true, courseId: true, title: true, position: true } }) : [],
    db
      .select({ item: sql<string>`json_extract(${subscriptionInvoices.meta}, '$.itemId')`, type: sql<string>`json_extract(${subscriptionInvoices.meta}, '$.type')`, n: sql<number>`count(*)`, sum: sql<number>`coalesce(sum(${subscriptionInvoices.amount}),0)` })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.state, "paid"), sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'purchase'`, sql`json_extract(${subscriptionInvoices.meta}, '$.mentorId') = ${mentorId}`))
      .groupBy(sql`json_extract(${subscriptionInvoices.meta}, '$.itemId')`, sql`json_extract(${subscriptionInvoices.meta}, '$.type')`),
  ]);
  const compMap = new Map(comps.map((c) => [c.lessonId, Number(c.n)]));
  const certMap = new Map(certs.map((c) => [c.courseId, Number(c.n)]));
  const courseStats = cs.map((c) => {
    const e = enr.filter((x) => x.courseId === c.id);
    const done = e.filter((x) => x.progressPct >= 100).length;
    const rev = paid.find((p) => p.type === "course" && p.item === c.id);
    return {
      id: c.id,
      title: c.title,
      published: c.isPublished,
      views: c.viewsCount,
      students: e.length,
      avgProgress: e.length ? Math.round(e.reduce((a, x) => a + x.progressPct, 0) / e.length) : 0,
      completed: done,
      certificates: certMap.get(c.id) ?? 0,
      revenue: Number(rev?.sum ?? 0),
      sales: Number(rev?.n ?? 0),
      conversion: c.viewsCount > 0 ? Math.round((e.length / c.viewsCount) * 1000) / 10 : 0,
      lessons: lessonRows.filter((l) => l.courseId === c.id).map((l) => ({ id: l.id, title: l.title, completed: compMap.get(l.id) ?? 0, pct: e.length ? Math.round(((compMap.get(l.id) ?? 0) / e.length) * 100) : 0 })),
    };
  });
  // Efirlar
  let live = { count: 0, avgPeak: 0, maxPeak: 0, tickets: 0, ticketRevenue: 0 };
  if (channelId) {
    const ls = await db.query.liveStreams.findMany({ where: and(eq(liveStreams.groupId, channelId), eq(liveStreams.status, "ended")), columns: { id: true, peakViewers: true } });
    const t = ls.length ? await db.select({ n: sql<number>`count(*)` }).from(liveTickets).where(inArray(liveTickets.streamId, ls.map((l) => l.id))) : [{ n: 0 }];
    const tr = paid.filter((p) => p.type === "ticket");
    live = { count: ls.length, avgPeak: ls.length ? Math.round(ls.reduce((a, l) => a + l.peakViewers, 0) / ls.length) : 0, maxPeak: ls.reduce((a, l) => Math.max(a, l.peakViewers), 0), tickets: Number(t[0]?.n ?? 0), ticketRevenue: tr.reduce((a, p) => a + Number(p.sum), 0) };
  }
  const subs = await db.select({ n: sql<number>`count(*)` }).from(mentorSubs).where(and(eq(mentorSubs.mentorId, mentorId), gt(mentorSubs.until, new Date())));
  return { courses: courseStats, live, activeSubs: Number(subs[0]?.n ?? 0), subRevenue: paid.filter((p) => p.type === "sub").reduce((a, p) => a + Number(p.sum), 0), consultRevenue: paid.filter((p) => p.type === "consult").reduce((a, p) => a + Number(p.sum), 0) };
}

export async function recordCourseView(courseId: string): Promise<void> {
  await db.update(courses).set({ viewsCount: sql`${courses.viewsCount} + 1` }).where(eq(courses.id, courseId));
}
