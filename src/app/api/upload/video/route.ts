import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
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
      // Egalik tekshiruvi (assertOwnUploads) audit jurnalidan o'qiydi — yozuvni token berishda qoldiramiz
      await audit(session.sub, "upload", { targetType: "file", targetId: uploadName(pathname), meta: { mime: "video", storage: "blob-client" } }, req);
      return {
        allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
        maximumSizeInBytes: MAX_VIDEO_BYTES,
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({ userId: session.sub }),
      };
    },
    // Vercel ishlab chiqarishda yuklash tugagach webhook chaqiradi — qo'shimcha ish shart emas
    onUploadCompleted: async () => {},
  });

  // @vercel/blob klienti javobni o'z formatida kutadi — ok() o'ramisiz qaytariladi
  return NextResponse.json(json, { headers: { "cache-control": "private, no-store" } });
});
