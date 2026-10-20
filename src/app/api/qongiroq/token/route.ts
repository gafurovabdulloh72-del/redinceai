import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { isCallEnabled, mintCallToken, dmRoom, groupRoom, LIVEKIT_WS_URL } from "@/lib/rtc/livekit";
import { loadConversationFor } from "@/lib/chat/dm";
import { loadGroupByAnySlug, assertActiveMember } from "@/lib/groups/service";
import { assertCanDm } from "@/lib/privacy/blocks";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dm"), id: z.string().min(1) }),
  z.object({ kind: z.literal("group"), id: z.string().min(1) }),
]);

/**
 * Video qo'ng'iroq uchun LiveKit kirish tokeni.
 * POST { kind: "dm", id: <conversationId> }  — faqat suhbat ishtirokchisi (va blok yo'q)
 * POST { kind: "group", id: <slug> }         — faqat jamoaning faol a'zosi
 *
 * Qo'ng'iroq sozlanmagan bo'lsa (LIVEKIT_* env yo'q) → 503 (klient tugmani ko'rsatmaydi).
 * Token egalik tekshiruvidan KEYIN beriladi — begona xonaga token olib bo'lmaydi (IDOR himoyasi).
 */
export const POST = handler(async (req) => {
  if (!isCallEnabled()) throw new ApiError(503, "Video qo'ng'iroq hozircha o'chirilgan");
  const session = await requireSession();
  const input = await parseBody(req, bodySchema);

  let room: string;
  if (input.kind === "dm") {
    const conv = await loadConversationFor(session.sub, input.id);
    if (!conv) throw new ApiError(404, "Suhbat topilmadi");
    // Bloklangan bo'lsa qo'ng'iroq ham mumkin emas. Suhbat allaqachon mavjud (existing=true) —
    // faqat blok tekshiriladi, dmPolicy qayta cheklamaydi (shuning uchun dmPolicy ahamiyatsiz).
    await assertCanDm(session.sub, { id: conv.peer.id, dmPolicy: "all" }, true);
    room = dmRoom(conv.conv.id);
  } else {
    const group = await loadGroupByAnySlug(input.id);
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertActiveMember(group, { id: session.sub, role: session.role });
    room = groupRoom(group.slug);
  }

  const token = await mintCallToken({ identity: session.sub, name: session.name ?? "Mehmon", room });
  return ok({ url: LIVEKIT_WS_URL, token, room });
});
