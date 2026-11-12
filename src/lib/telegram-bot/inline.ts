import "server-only";
import { escapeTelegramHtml, telegramApi } from "@/lib/telegram";
import { siteUrl } from "@/lib/security/site";
import { categoryLabel } from "@/lib/telegram-bot/labels-ru";
import { searchPeople } from "@/lib/telegram-bot/actions";
import { formatPrice } from "@/lib/utils";
import { botLang, L, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * INLINE REJIM (2026-10-31): istalgan chatda `@bot montajchi` → ijodkor kartalari (article natijalar) — tanlangani
 * suhbatga havola va «Profilni ochish» tugmasi bilan yuboriladi. Bo'sh so'rov — eng yaxshi ijodkorlar.
 * BotFather'da /setinline yoqilgan bo'lishi va webhook `allowed_updates`da `inline_query` bo'lishi shart
 * (admin panel → «Webhookni yangilash»).
 * Natijalar TILGA bog'liq (uz/ru) — `is_personal: true`: aks holda Telegram bir tildagi javobni boshqa tildagi
 * foydalanuvchiga keshdan berardi. `lang` — chaqiruvchi hisob tilini (`users.lang`) hisobga olib beradi.
 */
/**
 * TEZLIK (2026-11-12): Telegram har terilgan harf uchun yangi so'rov yuboradi, har biri esa bazaga bir necha marta borardi
 * (qidiruv + katalog + kontakt narxlari) — natijalar sekin chiqardi. Endi qidiruv natijasi shu server nusxasining
 * xotirasida 2 daqiqa saqlanadi (bir xil so'z — darhol), qidiruv webhook'dagi tekshiruvlar bilan PARALLEL boshlanadi
 * (`prefetchInline`), Telegram esa javobni har foydalanuvchi uchun 5 daqiqa keshlaydi.
 */
const SEARCH_TTL_MS = 120_000;
const SEARCH_MAX = 300;
const searchCache = new Map<string, { at: number; people: Promise<Awaited<ReturnType<typeof searchPeople>>> }>();

const normQuery = (raw: unknown) => (typeof raw === "string" ? raw : "").trim().slice(0, 80);

/** Keshdan yoki yangi qidiruv (bir vaqtda kelgan bir xil so'rovlar bitta qidiruvni kutadi) */
export function cachedPeople(rawQuery: unknown) {
  const q = normQuery(rawQuery);
  const key = q.toLowerCase().replace(/\s+/g, " ");
  const now = Date.now();
  const hit = searchCache.get(key);
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.people;
  const people = searchPeople(q, 10).catch((e) => {
    searchCache.delete(key); // xato keshlanmaydi
    throw e;
  });
  if (searchCache.size >= SEARCH_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(key, { at: now, people });
  return people;
}

/** Webhook tekshiruvlari (chegara, hisob, obuna) ketayotganda qidiruvni oldindan boshlab qo'yish */
export function prefetchInline(rawQuery: unknown): void {
  void cachedPeople(rawQuery).catch(() => undefined);
}

export async function handleInlineQuery(iq: { id?: unknown; query?: unknown; offset?: unknown; from?: { language_code?: string } }, langOverride?: BotLang): Promise<void> {
  const id = iq.id != null ? String(iq.id) : "";
  if (!id) return;
  const q = normQuery(iq.query);
  const s = siteUrl() ?? "";
  const lang = langOverride ?? botLang(iq.from?.language_code);
  const stars = (r: number) => (r > 0 ? `⭐ ${r.toFixed(1)}` : L(lang, "yangi", "новый"));
  let results: unknown[] = [];
  try {
    const people = await cachedPeople(q);
    results = people.map((p) => {
      const cat = categoryLabel(p.category, lang);
      const url = `${s}/mutaxassislar/${p.slug}`;
      const thumb = p.avatarUrl && /^https:\/\//.test(p.avatarUrl) ? p.avatarUrl : s.startsWith("https://") ? `${s}/icons/icon-192.png` : undefined;
      return {
        type: "article",
        id: p.slug.slice(0, 64),
        title: `${p.name}${p.isVerified ? " ✅" : ""}`,
        description: `${p.title || cat} · ${stars(p.rating)}${p.reviewCount ? ` (${p.reviewCount})` : ""}${p.contactPrice === null ? L(lang, " · faqat portfolio", " · только портфолио") : p.contactPrice ? ` · ${L(lang, "kontakt", "контакт")} ${formatPrice(p.contactPrice, { compact: true })}` : ""}`,
        ...(thumb ? { thumbnail_url: thumb, thumb_url: thumb } : {}),
        input_message_content: {
          message_text: `<b>${escapeTelegramHtml(p.name)}</b>${p.isVerified ? " ✅" : ""} — ${escapeTelegramHtml(p.title || cat)}\n${stars(p.rating)}${p.reviewCount ? ` (${p.reviewCount} ${L(lang, "sharh", "отз.")})` : ""} · Kasb Egalari\n${url}`,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        },
        reply_markup: { inline_keyboard: [[{ text: L(lang, "Profilni ochish", "Открыть профиль"), url }]] },
      };
    });
  } catch (e) {
    console.error("[telegram:inline]", e);
  }
  await telegramApi("answerInlineQuery", {
    inline_query_id: id,
    results,
    cache_time: 300,
    is_personal: true,
    ...(results.length === 0 && s.startsWith("https://") ? { button: { text: L(lang, `«${q || "ijodkor"}» — katalogda qidirish`, `«${q || "специалист"}» — искать в каталоге`), web_app: { url: `${s}/tg?to=${encodeURIComponent(`/qidiruv?q=${encodeURIComponent(q)}`)}` } } } : {}),
  });
}
