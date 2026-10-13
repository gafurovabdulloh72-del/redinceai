import { getCurrentUser } from "@/lib/auth";
import { TERMS_VERSION } from "@/lib/constants";
import { TermsBannerClient } from "./TermsBannerClient";

/**
 * Kirgan foydalanuvchi joriy TERMS_VERSION'ni qabul qilmagan bo'lsa — bloklamaydigan banner (F84).
 * Server komponenti: kabinet layout'ida `<TermsBanner />` deb qo'yiladi (getCurrentUser — so'rov bo'yicha keshlangan).
 */
export async function TermsBanner() {
  const user = await getCurrentUser();
  if (!user || user.termsVersion === TERMS_VERSION) return null;
  return <TermsBannerClient version={TERMS_VERSION} firstTime={!user.termsVersion} />;
}
