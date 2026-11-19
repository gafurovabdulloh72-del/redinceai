import { ExternalLink, Send } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { splitLinks } from "@/lib/chat/text";

const t = (til: Locale, uz: string, ru: string) => (til === "ru" ? ru : uz);

/** @username → t.me havola (matnning o'zi o'zgarmaydi) */
function withMentions(text: string, key: string) {
  const parts = text.split(/(@[A-Za-z][A-Za-z0-9_]{3,31})/g);
  return parts.map((p, i) =>
    /^@[A-Za-z]/.test(p) ? (
      <a key={`${key}-${i}`} href={`https://t.me/${p.slice(1)}`} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-accent-text underline-offset-2 hover:underline">
        {p}
      </a>
    ) : (
      p
    ),
  );
}

/** Kanaldan olingan e'lon matni — ASL ko'rinishida, havola va @username'lar bosiladigan */
export function SourceText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg-2" data-no-auto>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-accent-text underline-offset-2 hover:underline">
            {part.text}
          </a>
        ) : (
          withMentions(part.text, String(i))
        ),
      )}
    </p>
  );
}

/** Manba qatori (sarlavha ostida): «Manba: Kanal nomi» */
export function SourceLine({ source, til }: { source: { name: string; channel: string; url: string }; til: Locale }) {
  return (
    <a href={`https://t.me/${source.channel}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#229ED9] text-white">
        <Send size={11} />
      </span>
      <span className="text-fg-3 font-normal">{t(til, "Manba:", "Источник:")}</span> <span data-no-auto>{source.name}</span>
    </a>
  );
}

/** Ariza o'rnida: e'lon kanaldan olingan — murojaat asl postdagi kontakt orqali */
export function SourceApplyCard({ source, til }: { source: { name: string; channel: string; url: string }; til: Locale }) {
  return (
    <div className="card m-flat p-5">
      <p className="text-[15px] font-semibold text-fg">{t(til, "Telegram kanalidan olingan e'lon", "Объявление из Telegram-канала")}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-3">
        {t(til, "Murojaat qilish uchun e'londagi kontaktdan foydalaning yoki asl postni oching.", "Чтобы откликнуться, используйте контакт из объявления или откройте исходный пост.")}
      </p>
      <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-ink press mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold">
        {t(til, "Asl e'lonni ochish", "Открыть исходный пост")} <ExternalLink size={15} />
      </a>
      <p className="mt-3 text-[12px] text-fg-4">
        {t(til, "Manba:", "Источник:")}{" "}
        <a href={`https://t.me/${source.channel}`} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-fg-2 hover:underline" data-no-auto>
          {source.name}
          {source.name.replace(/^@/, "").toLowerCase() !== source.channel.toLowerCase() && ` (@${source.channel})`}
        </a>
      </p>
    </div>
  );
}
