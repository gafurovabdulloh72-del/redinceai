import type { Metadata } from "next";
import { TgAppGate } from "@/components/tg/TgAppGate";
import { telegramBotUsername } from "@/lib/telegram";

export const metadata: Metadata = { title: "Ilova", robots: { index: false, follow: false }, other: { "m-title": "Ilova" } };
export const dynamic = "force-dynamic";

/**
 * Telegram Mini App kirish nuqtasi: URL hash'idagi `tgWebAppData` → `/api/tg/auth` → sessiya → `?to=` sahifaga (SDK'siz).
 * Hisob yo'q bo'lsa — «Botda ro'yxatdan o'tish» / «Hisobim bor» ekrani (avtomatik hisob ochilmaydi).
 * `?link=1` — saytdagi hisob bilan kirilgach, shu Telegram chat hisobga ulanadi.
 * Telegram tashqarisida ochilsa — botga havola. `data-auth-screen` — telefon qobig'i (panellar) yashirin, bitta ekran.
 */
export default async function TgAppPage({ searchParams }: { searchParams: Promise<{ to?: string; link?: string }> }) {
  const sp = await searchParams;
  const bot = telegramBotUsername();
  return (
    <div data-auth-screen className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <TgAppGate to={sp.to ?? "/"} bot={bot} link={sp.link === "1"} />
    </div>
  );
}
