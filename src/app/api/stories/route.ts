import { useMusic } from "@/lib/music/service";
import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertOwnUploads, attachmentSchema } from "@/app/api/orders/_lib/attachments";
import { optionalViewer } from "@/app/api/groups/_lib";
import { musicSchema } from "@/lib/groups/validators";
import { STORY_BACKGROUNDS, STORY_CAPTION_MAX } from "@/lib/social/limits";
import { enforceLimit } from "@/lib/security/rate-limit";
import { createStory, storyRail } from "@/lib/stories/service";

/** GET: story qatori (faol story'lari bor mualliflar, ko'rilmaganlar oldinda) */
export const GET = handler(async () => {
  const viewer = await optionalViewer();
  return ok({ items: await storyRail(viewer) });
});

const schema = z.object({
  media: attachmentSchema.nullable().optional(),
  caption: z.string().trim().max(STORY_CAPTION_MAX, `Matn ko'pi bilan ${STORY_CAPTION_MAX} belgi`).optional().default(""),
  bg: z.enum(Object.keys(STORY_BACKGROUNDS) as [string, ...string[]]).nullable().optional(),
  music: musicSchema.nullable().optional(),
});

/** POST: yangi story (ijodkor yoki admin). Limit: oddiy — 7 kunda 4 ta, premium — cheksiz */
export const POST = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, schema);
  const media = input.media ?? null;
  if (media && !/^(image|video)\//.test(media.type)) throw new ApiError(422, "Story uchun faqat rasm yoki video", { media: "Rasm yoki video tanlang" });
  if (!media && !input.caption) throw new ApiError(422, "Rasm, video yoki matn kerak", { caption: "Bo'sh story" });
  await enforceLimit("posts", session.sub);
  await assertOwnUploads(session.sub, media ? [media.url] : [], [], "media");
  if (input.music) await useMusic(session.sub, input.music);
  const res = await createStory(session.sub, { media, caption: input.caption, bg: input.bg ?? null, music: input.music ?? null });
  return ok(res, { status: 201 });
});
