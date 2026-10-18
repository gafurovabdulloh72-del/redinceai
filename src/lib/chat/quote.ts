import type { FileAttachment } from "@/lib/db/schema";

/** Iqtibos (javob berilgan xabar) — DM va guruh chati uchun umumiy qisqa DTO */
export interface QuoteView {
  id: string;
  /** Matn parchasi yoki media yorlig'i ("Ovozli xabar", "Rasm"...) */
  body: string;
  senderName: string;
  kind: "text" | "voice" | "image" | "video" | "file";
}

const isAudio = (a: FileAttachment) => a.type.startsWith("audio/") || /\.(?:weba|m4a|ogg)$/i.test(a.url);
const isVideo = (a: FileAttachment) => a.type.startsWith("video/") || /\.(?:mp4|webm|mov)$/i.test(a.url);
const isImage = (a: FileAttachment) => a.type.startsWith("image/") || /\.(?:jpe?g|png|webp|gif)$/i.test(a.url);

export function quoteKind(attachments: FileAttachment[]): QuoteView["kind"] {
  if (!attachments.length) return "text";
  if (attachments.some(isAudio)) return "voice";
  if (attachments.some(isVideo)) return "video";
  if (attachments.some(isImage)) return "image";
  return "file";
}

const LABEL: Record<Exclude<QuoteView["kind"], "text">, string> = { voice: "Ovozli xabar", image: "Rasm", video: "Video", file: "Fayl" };

export function toQuote(row: { id: string; body: string; attachments: FileAttachment[] }, senderName: string): QuoteView {
  const kind = quoteKind(row.attachments);
  const text = row.body.replace(/\s+/g, " ").trim();
  return { id: row.id, body: text ? (text.length > 140 ? `${text.slice(0, 139)}…` : text) : kind === "text" ? "" : LABEL[kind], senderName, kind };
}

/** Qarshi tomon/ a'zo shu oraliqda yozayotgan bo'lsa — "yozmoqda…" */
export const TYPING_WINDOW_MS = 6000;
