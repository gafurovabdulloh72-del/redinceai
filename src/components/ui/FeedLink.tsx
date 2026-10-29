import { Rss } from "lucide-react";

/**
 * RSS lentasiga havola (2026-10-29). Lenta `<head>` dagi `alternate` orqali ham
 * topiladi, lekin ko'pchilik uni ko'rmaydi — ko'rinadigan chip bo'lsa, ish qidiruvchi
 * yoki o'quvchi lentani Telegram RSS boti / Feedly ga bir bosishda qo'shadi.
 */
export function FeedLink({ href, label = "RSS", title, className }: { href: string; label?: string; title?: string; className?: string }) {
  return (
    <a
      href={href}
      title={title ?? "RSS lentasi — yangilanishlarni kuzatish"}
      className={`chip inline-flex min-h-9 items-center gap-1.5 !px-3 text-[12.5px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg ${className ?? ""}`}
    >
      <Rss size={13} /> {label}
    </a>
  );
}
