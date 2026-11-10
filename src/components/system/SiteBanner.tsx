import { cookies } from "next/headers";
import { activeBanner, getSiteNotice } from "@/lib/admin/site-notice";
import { tr } from "@/lib/i18n";
import { BANNER, MAINTENANCE } from "@/lib/i18n/dict/system";
import { getLocale } from "@/lib/i18n/server";
import { BANNER_COOKIE } from "./banner-keys";
import { SiteBannerFrame } from "./SiteBannerFrame";
import { SiteBannerView } from "./SiteBannerView";

/**
 * SAYT E'LONI CHIZIG'I (2026-11-10) — layout'da `<main>` ichida, kontentdan oldin (server komponent).
 *
 * Joylashuv: oqim ichida (fixed EMAS) — telefonda yuqori panel ostida, desktopda kontent ustunining tepasida;
 * navbar/yon panelni yopmaydi va kontent bilan birga aylanib ketadi. `main`ning tepa bo'shlig'i manfiy margin bilan
 * qoplanadi (chiziq chetga yopishib turadi), pastda esa o'sha bo'shliq qayta beriladi.
 * To'liq ekranli sahifalarda (kirish/ro'yxat — bitta ekran qoidasi, Reels) chizilmaydi; chop etishda ham.
 *
 * Ma'lumot: `getSiteNotice()` — xotira keshi (≤15 s), ya'ni layout har so'rovda bazaga bormaydi.
 * Texnik ishlar rejimi yoqilgan bo'lsa oddiy e'lon o'rniga OGOHLANTIRISH chizig'i (yopib bo'lmaydi).
 * Oddiy e'lon: «×» bilan yopiladi (versiya bo'yicha eslab qolinadi — SiteBannerFrame).
 */
const SHELL = "-mt-3 mb-3 md:-mt-8 md:mb-6 print:hidden [html:has([data-auth-screen])_&]:hidden [html:has([data-reels-screen])_&]:hidden";
/**
 * md+: o'ng tepada til/tema kapsulasi (fixed, tepadan 12px, balandligi ~40px) turadi. Chiziq 56px — kapsula uning
 * chegarasida «osilib» qolmay, to'liq ichida turadi; matn va «×» kapsula ostiga kirmasligi uchun o'ngdan joy qoldiriladi.
 */
const DESKTOP = "md:min-h-14 md:items-center";

export async function SiteBanner() {
  const notice = await getSiteNotice().catch(() => null);
  if (!notice) return null;
  const til = await getLocale();

  if (notice.maintenance.on) {
    const m = notice.maintenance;
    const text = (til === "ru" ? m.messageRu : m.messageUz) || tr(til, MAINTENANCE.notice);
    return (
      <div className={SHELL} role="status" aria-label={tr(til, MAINTENANCE.title)} data-site-notice="maintenance" data-print-hide>
        {/* lg:pr-* ham kerak: ko'rinishdagi `lg:px-8` keyinroq keladi va `md:pr-*`ni bosib qo'yadi */}
        <SiteBannerView tone="warn" maintenance title={tr(til, MAINTENANCE.title)} text={text} className={`md:pr-32 lg:pr-32 ${DESKTOP}`} />
      </div>
    );
  }

  const b = activeBanner(notice);
  if (!b) return null;
  // Tashrifchi shu versiyani yopgan — server chizmaydi (cookie nusxasi; asosiy xotira — localStorage)
  if ((await cookies()).get(BANNER_COOKIE)?.value === String(b.version)) return null;
  const text = til === "ru" && b.textRu ? b.textRu : b.textUz;
  return (
    <SiteBannerFrame version={b.version} dismissLabel={tr(til, BANNER.dismiss)} className={SHELL}>
      <div role="region" aria-label={tr(til, BANNER.label)} data-site-notice="banner">
        <SiteBannerView tone={b.tone} text={text} href={b.href} moreLabel={tr(til, BANNER.more)} className={`pr-12 sm:pr-12 md:pr-40 lg:pr-40 ${DESKTOP}`} />
      </div>
    </SiteBannerFrame>
  );
}
