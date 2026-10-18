import type { CSSProperties } from "react";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { cn, hashHue } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";

/**
 * Rasmsiz muqova o'rniga: yo'nalishga xos, deterministik naqsh (chiziq / nuqta / to'r / to'lqin)
 * yuza ohanglarida + markazda yo'nalish ikonkasi plitkasi. Sun'iy rang-barang gradient emas, ikkala rejimga mos
 * (faqat CSS o'zgaruvchilar va color-mix). Server komponent — hook yo'q, id yo'q (CSS gradient naqshlar).
 *
 * Ishlatish: ota element `relative` + o'lchamli bo'lsin; <CoverPattern category={sp.category} seed={sp.slug} />
 * seed bir yo'nalishdagi kartalarni bir-biridan ajratadi (naqsh siljishi va yorug'lik dog'i joyi).
 */

type Pattern = (ink: string) => { image: string; size: string };

const PATTERNS: Record<string, Pattern> = {
  // Videograf — diagonal "kadr" chiziqlari
  videograf: (ink) => ({ image: `repeating-linear-gradient(135deg, ${ink} 0 1.5px, transparent 1.5px 14px)`, size: "auto" }),
  // Montajor — taymlayn (turli kenglikdagi vertikal bo'laklar)
  montajor: (ink) => ({
    image: `repeating-linear-gradient(90deg, ${ink} 0 2px, transparent 2px 9px, ${ink} 9px 10px, transparent 10px 24px)`,
    size: "auto",
  }),
  // Grafik dizayner — nuqtali to'r
  dizayner: (ink) => ({ image: `radial-gradient(${ink} 1.6px, transparent 1.9px)`, size: "16px 16px" }),
  // Motion — konsentrik to'lqinlar
  "motion-dizayner": (ink) => ({ image: `repeating-radial-gradient(circle at 18% 120%, ${ink} 0 1.5px, transparent 1.5px 15px)`, size: "auto" }),
  // Fotograf — diafragma halqalari
  fotograf: (ink) => ({ image: `repeating-radial-gradient(circle at 78% 24%, ${ink} 0 1.5px, transparent 1.5px 12px)`, size: "auto" }),
  // 3D — izometrik to'r
  "3d-artist": (ink) => ({
    image: `repeating-linear-gradient(30deg, ${ink} 0 1px, transparent 1px 18px), repeating-linear-gradient(150deg, ${ink} 0 1px, transparent 1px 18px)`,
    size: "auto",
  }),
  // UI/UX — maket to'ri (8pt grid)
  "ui-ux": (ink) => ({
    image: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
    size: "20px 20px",
  }),
  // Ovoz — to'lqin shakli (gorizontal chiziqlar, markazga yaqin zichroq)
  ovoz: (ink) => ({
    image: `repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 7px), linear-gradient(90deg, transparent, ${ink} 50%, transparent)`,
    size: "auto",
  }),
};

export function CoverPattern({
  category,
  seed,
  className,
  showIcon = true,
  iconSize = 24,
}: {
  category: string;
  seed?: string;
  className?: string;
  showIcon?: boolean;
  iconSize?: 20 | 24;
}) {
  const cat = CATEGORY_BY_SLUG[category];
  const h = hashHue(seed || category);
  // v3: monoxrom — naqsh matn rangining 9% ohangida, yuza neytral (rangli tint/glow yo'q)
  const ink = "color-mix(in oklab, var(--fg) 9%, transparent)";
  const p = (PATTERNS[category] ?? PATTERNS.videograf)(ink);

  const base: CSSProperties = { background: "var(--surface-3)" };
  const pattern: CSSProperties = {
    backgroundImage: p.image,
    backgroundSize: p.size,
    backgroundPosition: `${h % 20}px ${(h >> 2) % 20}px`,
    // Ikonka atrofi toza, chetlarga qarab naqsh to'liq
    maskImage: "radial-gradient(ellipse at 50% 50%, transparent 0 16%, #000 62%)",
    WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, transparent 0 16%, #000 62%)",
  };

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} style={base} aria-hidden="true">
      <div className="absolute inset-0" style={pattern} />
      {showIcon && cat && (
        <span
          className={cn(
            "icon-tile-outline absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[var(--shadow-1)]",
            iconSize === 24 ? "icon-tile-lg" : undefined,
          )}
          style={{ color: "var(--fg-2)" }}
        >
          <CategoryIcon icon={cat.icon} size={iconSize} />
        </span>
      )}
    </div>
  );
}
