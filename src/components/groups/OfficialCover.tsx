/**
 * Rasmiy kanal uchun muqova o'rnini bosuvchi brend fon (muqova yuklanmagan bo'lsa):
 * v3: yassi ink fon + "K" belgisi va nom (qo'shimcha «Rasmiy kanal» yozuvi yo'q — ✓ belgisi nom yonida).
 */
export function OfficialCover({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: "#1a1a1c" }}>
      <div className={compact ? "relative flex items-center gap-2" : "relative flex items-center gap-3"}>
        <span className={`flex items-center justify-center rounded-[22%] bg-[#f6f4ee] font-display font-bold text-[#1a1a1c] ${compact ? "h-10 w-10 text-[20px]" : "h-16 w-16 text-[34px]"}`}>
          K<span className="-mt-3 ml-0.5 inline-block h-2 w-2 rounded-full bg-[#ff5a36]" />
        </span>
        {!compact && <span className="hidden font-display text-[22px] font-semibold leading-tight text-white sm:block">{name}</span>}
      </div>
    </div>
  );
}
