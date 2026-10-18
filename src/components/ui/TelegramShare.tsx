import { Send } from "lucide-react";
import { SITE_URL } from "@/lib/site-url";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

/**
 * Telegram orqali ulashish (t.me/share/url) — server komponent: absolyut havola SITE_URL'dan, yorliq joriy tilda.
 * O'zbekistonda asosiy tarqatish kanali Telegram — alohida tugma "Ulashish" nusxalashidan tezroq.
 */
export async function TelegramShare({ path, text, className, iconOnly = true }: { path: string; text: string; className?: string; iconOnly?: boolean }) {
  const til = await getLocale();
  const label = tr(til, SHELL.common.shareTelegram);
  const href = `https://t.me/share/url?url=${encodeURIComponent(`${SITE_URL}${path}`)}&text=${encodeURIComponent(text)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-tip={label}
      className={cn(
        "press inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line-2 text-[14px] font-semibold text-fg-2 transition hover:border-[#229ED9] hover:text-[#229ED9]",
        iconOnly ? "w-11" : "px-4",
        className,
      )}
    >
      <Send size={16} />
      {!iconOnly && "Telegram"}
    </a>
  );
}
