import { BadgeCheck } from "lucide-react";

/**
 * Rasmiy kanal uchun muqova o'rnini bosuvchi brend fon (muqova yuklanmagan bo'lsa):
 * ink → coral gradient, nozik to'r va "K" belgisi — bo'sh kulrang maydon o'rniga.
 */
export function OfficialCover({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(115deg, #1a1a1c 0%, #2a211f 55%, #ff5a36 140%)" }}
    >
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />
      <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#ff5a36]/30 blur-3xl" />
      <div className={compact ? "relative flex items-center gap-2" : "relative flex items-center gap-3"}>
        <span className={`flex items-center justify-center rounded-[22%] bg-[#f6f4ee] font-display font-bold text-[#1a1a1c] ${compact ? "h-10 w-10 text-[20px]" : "h-16 w-16 text-[34px]"}`}>
          K<span className="-mt-3 ml-0.5 inline-block h-2 w-2 rounded-full bg-[#ff5a36]" />
        </span>
        {!compact && (
          <span className="hidden sm:block">
            <span className="block font-display text-[22px] font-semibold leading-tight text-white">{name}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-white/80">
              <BadgeCheck size={13} /> Rasmiy kanal
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
