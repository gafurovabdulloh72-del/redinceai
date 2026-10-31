/**
 * Reaksiya «stikerlari» — tizim emojisi (Android/Windows'da har xil ko'rinadi) o'rniga bir xil 3D rasm.
 * Rasmlar: Microsoft Fluent Emoji 3D (MIT) — `public/reactions/*.png`, 256×256.
 * Noma'lum emoji bo'lsa oddiy matn chiziladi (hech narsa yo'qolmaydi).
 */
const STICKERS: Record<string, string> = {
  "❤️": "heart",
  "❤": "heart",
  "🔥": "fire",
  "👏": "clap",
  "😂": "haha",
  "😮": "wow",
  "😢": "sad",
  "👍": "like",
  "🙏": "pray",
  "🙌": "raised",
  "🎉": "party",
};

/** Emoji belgisidan stiker fayli (yo'q bo'lsa null) */
export function stickerSrc(emoji: string): string | null {
  const k = STICKERS[emoji] ?? STICKERS[emoji.replace(/️/g, "")];
  return k ? `/reactions/${k}.png` : null;
}

export function EmojiSticker({ e, size = 20, className, label }: { e: string; size?: number; className?: string; label?: string }) {
  const src = stickerSrc(e);
  if (!src) {
    return (
      <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-label={label} aria-hidden={label ? undefined : true}>
        {e}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label ?? ""} aria-hidden={label ? undefined : true} width={size} height={size} draggable={false} decoding="async" className={className} style={{ width: size, height: size, display: "inline-block", verticalAlign: "middle", objectFit: "contain" }} />
  );
}

/** Bir nechta emojini yonma-yon (ustma-ust biroz kirib) — reaksiya yig'indisi uchun */
export function EmojiStack({ list, size = 16, className }: { list: string[]; size?: number; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center" }} aria-hidden>
      {list.map((e, i) => (
        <EmojiSticker key={`${e}${i}`} e={e} size={size} className={i > 0 ? "-ml-1" : undefined} />
      ))}
    </span>
  );
}
