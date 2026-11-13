import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DESKTOP_CHALLENGE_RE, getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { LogoMark } from "@/components/layout/Logo";
import { DesktopLinkButton } from "@/components/auth/DesktopLinkButton";

export const metadata: Metadata = { title: "Ilovaga kirish", robots: { index: false, follow: false }, other: { "m-title": "Ilovaga kirish" } };
export const dynamic = "force-dynamic";

/**
 * Kompyuter ilovasi (Electron) Google bilan kirishni tizim brauzerida shu sahifadan boshlaydi: `?c=<challenge>&usul=google`.
 * Kirmagan bo'lsa — Google (yoki oddiy kirish) sahifasiga, keyin shu yerga qaytadi; kirgan bo'lsa — «Ilovaga qaytish»
 * tugmasi bir martalik kod olib `kasbegalari://auth?code=…` ni ochadi. Avtomatik ochilmaydi: foydalanuvchi qaysi hisob
 * bilan kirayotganini ko'rib, o'zi tasdiqlaydi.
 */
export default async function DesktopLinkPage({ searchParams }: { searchParams: Promise<{ c?: string; usul?: string }> }) {
  const sp = await searchParams;
  const til = await getLocale();
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const challenge = sp.c && DESKTOP_CHALLENGE_RE.test(sp.c) ? sp.c : null;
  const user = challenge ? await getCurrentUser() : null;
  if (challenge && !user) {
    const back = `/ilova/ulash?c=${challenge}`;
    redirect(sp.usul === "google" ? `/api/auth/google?next=${encodeURIComponent(back)}` : `/auth/kirish?next=${encodeURIComponent(back)}`);
  }
  return (
    <div data-auth-screen className="flex min-h-dvh items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-[380px] text-center">
        <LogoMark size={56} className="mx-auto" />
        {!challenge || !user ? (
          <>
            <h1 className="mt-5 text-[20px] font-bold text-fg">{t("Havola eskirgan", "Ссылка устарела")}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-3">
              {t("Kasb Egalari ilovasini oching va «Google bilan davom etish»ni qaytadan bosing.", "Откройте приложение Kasb Egalari и снова нажмите «Продолжить с Google».")}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-[20px] font-bold text-fg">{t("Kompyuter ilovasiga kirish", "Вход в приложение для компьютера")}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-3">
              {t("Ilovaga shu hisob bilan kirasiz:", "Вы войдёте в приложение с этим аккаунтом:")}
            </p>
            <p className="mt-3 rounded-[12px] border border-line px-4 py-3 text-[15px] font-semibold text-fg" data-no-auto>
              {user.name}
            </p>
            <DesktopLinkButton challenge={challenge} til={til} />
            <p className="mt-4 text-[12px] leading-relaxed text-fg-4">
              {t("Bu tugmani faqat o'zingiz ilovada kirishni boshlagan bo'lsangiz bosing.", "Нажимайте, только если вы сами начали вход в приложении.")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
