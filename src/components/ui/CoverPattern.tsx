import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";

/**
 * Rasmsiz muqova o'rniga: yo'nalishga xos, deterministik naqsh (chiziq / nuqta / to'r / to'lqin)
 * yuza ohanglarida + markazda yo'nalish ikonkasi plitkasi. Sun'iy rang-barang gradient emas, ikkala rejimga mos
 * (faqat CSS o'zgaruvchilar va color-mix). Server komponent — hook yo'q, id yo'q (CSS gradient naqshlar).
 *
 * Ishlatish: ota element `relative` + o'lchamli bo'lsin; <CoverPattern category={sp.category} seed={sp.slug} />
 * seed bir yo'nalishdagi kartalarni bir-biridan ajratadi (naqsh siljishi va yorug'lik dog'i joyi).
 */

/** v6 «Sokin»: naqsh yo'q — tekis neytral yuza va markazda och yo'nalish ikonkasi */
export function CoverPattern({
  category,
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
  return (
    <div className={cn("absolute inset-0 grid place-items-center overflow-hidden bg-surface-2", className)} aria-hidden="true">
      {showIcon && cat && (
        <span className="text-fg-4">
          <CategoryIcon icon={cat.icon} size={iconSize + 4} />
        </span>
      )}
    </div>
  );
}
