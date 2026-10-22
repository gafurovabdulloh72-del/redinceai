import { ApiError, requireSession } from "@/lib/api";
import { getMentorForUser } from "@/lib/mentorship/service";

/** Tasdiqlangan mentor (yoki admin — mentorId bilan uning nomidan) */
export async function requireMentor(mentorIdFor?: string | null) {
  const session = await requireSession();
  const m = await getMentorForUser(session.sub);
  if (m?.isApproved) return { session, mentor: m };
  if (session.role === "admin" && mentorIdFor) {
    const { db } = await import("@/lib/db");
    const { mentors } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const am = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorIdFor) });
    if (am) return { session, mentor: am };
  }
  throw new ApiError(403, "Avval mentor sifatida tasdiqlaning");
}
