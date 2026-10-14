import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { ApiError, handler, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { MAX_VIDEO_BYTES, uploadName } from "@/components/chat/attachments";

/**
 * Video yuklash — brauzerdan to'g'ridan-to'g'ri Vercel Blob'ga (client upload).
 * Server tanasi Vercel'da 4.5 MB bilan cheklangani uchun video /api/upload orqali o'tmaydi:
 * bu route faqat qisqa muddatli yuklash tokenini beradi (sessiya + kvota + yo'l tekshirilib),
 * faylning o'zi esa brauzer → Blob'ga boradi (50 MB gacha; MP4, WebM, MOV).
 * BLOB_READ_WRITE_TOKEN bo'lmasa (dev) klient oddiy /api/upload'ga qaytadi.
 *
 * Xavfsizlik (pentest E95):
 *  - allowOverwrite:false — mavjud faylning ustiga yozib bo'lmaydi (birovning videosini buzish yo'q)
 *  - Yo'l oldindan band bo'lsa (shu nom bo'yicha "upload" yozuvi bor) — rad etiladi, shuning uchun
 *    hujumchi birovning yo'li uchun token so'rab, egalik yozuvini o'ziga yoza olmaydi
 *  - addRandomSuffix:false — nom allaqachon UUID (122 bit), taxmin qilib bo'lmaydi
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) throw new ApiError(400, "JSON noto'g'ri");

  const json = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      await enforceLimit("upload", session.sub);
      if (!/^uploads\/[\w-]{10,64}\.(?:mp4|webm|mov)$/i.test(pathname)) throw new ApiError(400, "Fayl yo'li noto'g'ri");
      const name = uploadName(pathname);
      // Bu nom allaqachon kimdir tomonidan yuklangan bo'lsa — qayta egalik qilib bo'lmaydi (IDOR/soxta egalik oldi)
      const taken = await db.query.auditLogs.findFirst({
        where: and(eq(auditLogs.action, "upload"), eq(auditLogs.targetId, name)),
        columns: { id: true },
      });
      if (taken) throw new ApiError(409, "Fayl yo'li band — sahifani yangilab, qayta urinib ko'ring");
      // Egalik yozuvi (assertOwnUploads shundan o'qiydi) — nom band qilinadi
      await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { mime: "video", storage: "blob-client" } }, req);
      return {
        allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
        maximumSizeInBytes: MAX_VIDEO_BYTES,
        addRandomSuffix: false,
        allowOverwrite: false,
        tokenPayload: JSON.stringify({ userId: session.sub }),
      };
    },
    // Vercel ishlab chiqarishda yuklash tugagach webhook chaqiradi — qo'shimcha ish shart emas
    onUploadCompleted: async () => {},
  });

  // @vercel/blob klienti javobni o'z formatida kutadi — ok() o'ramisiz qaytariladi
  return NextResponse.json(json, { headers: { "cache-control": "private, no-store" } });
});
