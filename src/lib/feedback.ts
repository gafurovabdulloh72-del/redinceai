import "server-only";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { feedbacks, users, type Feedback } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { IMAGE_URL_RE } from "@/components/chat/attachments";
import { assertNotSpam } from "@/lib/security/spam-filter";
import { uid } from "@/lib/utils";

/**
 * FIKR BILDIRISH (2026-11-04): «Fikr bildirish» tugmasi (yon menyu «Yana» va kabinet menyusi) → Sheet forma →
 * `POST /api/fikr` (mehmon ham, qattiqroq limit bilan) → bazaga yoziladi, adminlarga bitta qisqa Telegram/sayt xabari.
 * Admin ro'yxati `/admin` «Tizim» tabida (`GET/PATCH /api/admin/fikrlar`).
 */
export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_TEXT_MAX = 2000;

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS).default("other"),
  text: z.string().trim().min(5, { error: "Kamida 5 ta belgi yozing" }).max(FEEDBACK_TEXT_MAX, { error: `Matn ${FEEDBACK_TEXT_MAX} belgidan oshmasin` }),
  page: z.string().trim().max(300).optional().default(""),
  /** Faqat o'z yuklamamiz (/api/upload natijasi) — tashqi URL rad etiladi (SSRF/oq ro'yxat) */
  screenshotUrl: z
    .string()
    .trim()
    .max(600)
    .optional()
    .nullable()
    .refine((v) => !v || IMAGE_URL_RE.test(v), { error: "Skrinshot faqat saytga yuklangan rasm bo'lishi mumkin" }),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export interface FeedbackRow extends Feedback {
  user: { id: string; name: string; email: string } | null;
}

/** Yozish: spam filtri, sahifa yo'li faqat nisbiy (`/…`), user-agent 300 belgigacha */
export async function createFeedback(input: FeedbackInput, userId: string | null, userAgent: string): Promise<Feedback> {
  await assertNotSpam(input.text, "text");
  const page = input.page && input.page.startsWith("/") ? input.page.slice(0, 300) : "";
  const id = uid();
  await db.insert(feedbacks).values({ id, userId, page, kind: input.kind, text: input.text, screenshotUrl: input.screenshotUrl || null, userAgent: userAgent.slice(0, 300) });
  const row = await db.query.feedbacks.findFirst({ where: eq(feedbacks.id, id) });
  if (!row) throw new ApiError(500, "Fikr saqlanmadi");
  return row;
}

/** Admin ro'yxati — yangisi birinchi, kursor `created_at` bo'yicha */
export async function listFeedback(status: "open" | "done" | "all", limit = 50, before?: number): Promise<FeedbackRow[]> {
  const conds = [];
  if (status !== "all") conds.push(eq(feedbacks.status, status));
  if (before) conds.push(lt(feedbacks.createdAt, new Date(before)));
  const rows = await db
    .select({ f: feedbacks, uid: users.id, uname: users.name, uemail: users.email })
    .from(feedbacks)
    .leftJoin(users, eq(users.id, feedbacks.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(feedbacks.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows.map((r) => ({ ...r.f, user: r.uid ? { id: r.uid, name: r.uname ?? "", email: r.uemail ?? "" } : null }));
}

export async function setFeedbackStatus(id: string, status: "open" | "done"): Promise<Feedback> {
  const [row] = await db.update(feedbacks).set({ status }).where(eq(feedbacks.id, id)).returning();
  if (!row) throw new ApiError(404, "Fikr topilmadi");
  return row;
}

export async function openFeedbackCount(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(feedbacks).where(eq(feedbacks.status, "open"));
  return Number(row?.n ?? 0);
}
