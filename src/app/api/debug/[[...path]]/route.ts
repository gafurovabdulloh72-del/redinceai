/**
 * TUZOQ (yem) API yo'li — saytda bunday API YO'Q. Skanerlar «yashirin API» qidirib shu yerga keladi: urinish jurnalga
 * tushadi, 4 marta urinsa IP bloklanadi, javob — hazil JSON («Iltimos, buzib kirmang»). Haqiqiy kod bu yo'lni chaqirmaydi.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { GET, POST, PUT, DELETE, PATCH, HEAD } from "@/app/api/tuzoq/trap/route";
