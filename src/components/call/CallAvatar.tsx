"use client";

/** Ismdan barqaror rang (avatar rasmi yo'q bo'lganda) */
export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** Qo'ng'iroq avatari: rasm bo'lsa rasm, bo'lmasa ismdan gradient + bosh harf */
export function CallAvatar({ name, avatarUrl, size }: { name: string; avatarUrl?: string | null; size: number }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const hue = hueOf(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(145deg, hsl(${hue} 50% 38%), hsl(${(hue + 40) % 360} 45% 24%))` }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
