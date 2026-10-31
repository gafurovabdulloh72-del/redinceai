import "server-only";
import { escapeTelegramHtml, telegramApi } from "@/lib/telegram";
import { siteUrl } from "@/lib/security/site";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { searchPeople } from "@/lib/telegram-bot/actions";
import { formatPrice } from "@/lib/utils";

/**
 * INLINE REJIM (2026-10-31): istalgan chatda `@bot montajchi` → ijodkor kartalari (article natijalar) — tanlangani
 * suhbatga havola va «Profilni ochish» tugmasi bilan yuboriladi. Bo'sh so'rov — eng yaxshi ijodkorlar.
 * BotFather'da /setinline yoqilgan bo'lishi va webhook `allowed_updates`da `inline_query` bo'lishi shart
 * (admin panel → «Webhookni yangilash»).
 */
export async function handleInlineQuery(iq: { id?: unknown; query?: unknown; offset?: unknown }): Promise<void> {
  const id = iq.id != null ? String(iq.id) : "";
  if (!id) return;
  const q = (typeof iq.query === "string" ? iq.query : "").trim().slice(0, 80);
  const s = siteUrl() ?? "";
  const stars = (r: number) => (r > 0 ? `⭐ ${r.toFixed(1)}` : "yangi");
  let results: unknown[] = [];
  try {
    const people = await searchPeople(q, 10);
    results = people.map((p) => {
      const cat = CATEGORY_BY_SLUG[p.category]?.name ?? p.category;
      const url = `${s}/mutaxassislar/${p.slug}`;
      const thumb = p.avatarUrl && /^https:\/\//.test(p.avatarUrl) ? p.avatarUrl : s.startsWith("https://") ? `${s}/icons/icon-192.png` : undefined;
      return {
        type: "article",
        id: p.slug.slice(0, 64),
        title: `${p.name}${p.isVerified ? " ✅" : ""}`,
        description: `${p.title || cat} · ${stars(p.rating)}${p.reviewCount ? ` (${p.reviewCount})` : ""}${p.contactPrice === null ? " · faqat portfolio" : p.contactPrice ? ` · kontakt ${formatPrice(p.contactPrice, { compact: true })}` : ""}`,
        ...(thumb ? { thumbnail_url: thumb, thumb_url: thumb } : {}),
        input_message_content: {
          message_text: `<b>${escapeTelegramHtml(p.name)}</b>${p.isVerified ? " ✅" : ""} — ${escapeTelegramHtml(p.title || cat)}\n${stars(p.rating)}${p.reviewCount ? ` (${p.reviewCount} sharh)` : ""} · Kasb Egalari\n${url}`,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        },
        reply_markup: { inline_keyboard: [[{ text: "Profilni ochish", url }]] },
      };
    });
  } catch (e) {
    console.error("[telegram:inline]", e);
  }
  await telegramApi("answerInlineQuery", {
    inline_query_id: id,
    results,
    cache_time: 60,
    is_personal: false,
    ...(results.length === 0 && s.startsWith("https://") ? { button: { text: `«${q || "ijodkor"}» — katalogda qidirish`, web_app: { url: `${s}/tg?to=${encodeURIComponent(`/qidiruv?q=${encodeURIComponent(q)}`)}` } } } : {}),
  });
}
