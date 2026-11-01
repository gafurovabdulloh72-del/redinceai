import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { askQuestion, listQuestions, QUESTION_BODY_MAX, QUESTION_TITLE_MAX } from "@/lib/qa/service";

/** GET — savollar ro'yxati (?tab=open|answered&cat=&q=&cursor=) */
export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const tab = sp.get("tab");
  const cursor = Number(sp.get("cursor"));
  const data = await listQuestions({
    tab: tab === "open" || tab === "answered" ? tab : "all",
    category: sp.get("cat") ?? undefined,
    q: (sp.get("q") ?? "").trim().slice(0, 80) || undefined,
    cursor: Number.isFinite(cursor) && cursor > 0 ? cursor : undefined,
  });
  return ok(data);
});

const schema = z.object({
  title: z.string().trim().min(10, "Savol kamida 10 ta belgi bo'lsin").max(QUESTION_TITLE_MAX),
  body: z.string().trim().max(QUESTION_BODY_MAX).optional().default(""),
  category: z.string().trim().max(30).optional().or(z.literal("")),
});

/** POST — yangi savol (kirgan foydalanuvchi) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  return ok(await askQuestion(session.sub, { title: input.title, body: input.body, category: input.category || null }), { status: 201 });
});