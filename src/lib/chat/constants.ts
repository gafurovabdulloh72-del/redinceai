/**
 * Chat (DM) uchun klientga xavfsiz konstantalar — server moduli (`dm.ts`) import qilinmaydi.
 */

/** Xabar matni uzunligi */
export const DM_BODY_MAX = 2000;
/** Tahrirlash oynasi — yuborilgandan keyin 15 daqiqa */
export const DM_EDIT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 soat; o'chirish esa doim mumkin
/** Reaksiyalar to'plami (bitta foydalanuvchi = bitta reaksiya, qayta bosilsa olib tashlanadi) */
export const DM_REACTIONS = ["❤️", "👍", "🔥", "😂", "😮", "🙏"] as const;
export type DmReaction = (typeof DM_REACTIONS)[number];
/** Hamma uchun o'chirilgan xabar o'rinbosari */
export const DM_DELETED_TEXT = { uz: "Xabar o'chirildi", ru: "Сообщение удалено" } as const;
/** Suhbat ichidagi qidiruv — kamida shuncha belgi */
export const DM_SEARCH_MIN = 2;

/** Reaksiya yig'indisi (klient DTO) */
export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Havola prevyusi (klient DTO) */
export interface LinkPreviewView {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  site: string;
}
