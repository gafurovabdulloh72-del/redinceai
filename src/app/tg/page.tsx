import type { Metadata } from "next";
import { TgAppGate } from "@/components/tg/TgAppGate";
import { telegramBotUsername } from "@/lib/telegram";

export const metadata: Metadata = { title: "Ilova", robots: { index: false, follow: false }, other: { "m-title": "Ilova" } };
export const dynamic = "force-dynamic";

/**
 * Telegram Mini App kirish nuqtasi: URL hash'idagi `tgWebAppData` → `/api/tg/auth` → sessiya → `?to=` sahifaga (SDK'siz).
 * Telegram tashqarisida ochilsa — botga havola. `data-auth-screen` — telefon qobig'i (panellar) yashirin, bitta ekran.
 */
export default async function TgAppPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const sp = await searchParams;
  const bot = telegramBotUsername();
  return (
    <div data-auth-screen className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <TgAppGate to={sp.to ?? "/"} botLink={bot ? `https://t.me/${bot}` : null} />
    </div>
  );
}
