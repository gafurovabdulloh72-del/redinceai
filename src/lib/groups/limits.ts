/**
 * Jamoalar — kiritish chegaralari. Klient komponentlari ham, server validatorlari ham shu yerdan oladi;
 * bu faylda server importlari (db, zod sxemalari) YO'Q — klient bundle'iga xavfsiz.
 */
export const GROUP_NAME_MIN = 3;
export const GROUP_NAME_MAX = 60;
export const GROUP_DESC_MAX = 600;
export const POST_BODY_MAX = 2000;
export const POST_MEDIA_MAX = 4;
export const COMMENT_MAX = 500;
export const GROUP_MSG_MAX = 2000;
/** Muqova nisbati — karta (3:1) va jamoa sahifasi hero'si bilan bir xil: kesilgan rasm aynan shunday ko'rinadi */
export const GROUP_COVER_ASPECT = 3;
