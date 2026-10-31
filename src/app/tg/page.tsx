import type { Metadata } from "next";
import { TgAppGate } from "@/components/tg/TgAppGate";
import { isGoogleConfigured } from "@/lib/auth/google";
import { telegramBotUsername } from "@/lib/telegram";

export const metadata: Metadata = { title: "Ilova", robots: { index: false, follow: false }, other: { "m-title": "Ilova" } };
export const dynamic = "force-dynamic";

/**
 * Telegram Mini App kirish nuqtasi: URL hash'idagi `tgWebAppData` → `/api/tg/auth` → sessiya → `?to=` sahifaga (SDK'siz).
 * Hisob yo'q bo'lsa — «Kasb Egalari'da akkauntingiz bormi?»: Yo'q → savollar ketma-ket (ilovaning o'zida) → hisob;
 * Ha → akkauntni ulash (Google yoki email bilan saytga kirish, `?link=1` bilan qaytib chat ulanadi). Avtomatik hisob OCHILMAYDI.
 * Telegram tashqarisida ochilsa — botga havola. `data-auth-screen` — telefon qobig'i (panellar) yashirin, bitta ekran.
 */
export default async function TgAppPage({ searchParams }: { searchParams: Promise<{ to?: string; link?: string }> }) {
  const sp = await searchParams;
  const bot = telegramBotUsername();
  return (
    <div data-auth-screen className="flex min-h-dvh items-center justify-center bg-bg px-6 py-8">
      <TgAppGate to={sp.to ?? "/"} bot={bot} link={sp.link === "1"} googleEnabled={isGoogleConfigured()} />
    </div>
  );
}
