import Link from "next/link";
import { tr, type Locale } from "@/lib/i18n";
import { PROFIL_X } from "@/lib/i18n/dict/profile";

export const REVIEW_SORTS = ["yangi", "yuqori", "past", "foydali"] as const;
export type ReviewSortKey = (typeof REVIEW_SORTS)[number];
export function parseReviewSort(v: unknown): ReviewSortKey {
  return typeof v === "string" && (REVIEW_SORTS as readonly string[]).includes(v) ? (v as ReviewSortKey) : "yangi";
}

/** Sharhlar saralash segmenti (`?sharh=`): havolalar — JS'siz ham ishlaydi, `#sharhlar`ga qaytadi */
export function ReviewSort({ current, basePath, til, className }: { current: ReviewSortKey; basePath: string; til: Locale; className?: string }) {
  return (
    <div className={className}>
      <div className="segment" role="group" aria-label={tr(til, PROFIL_X.reviewSortAria)}>
        {REVIEW_SORTS.map((k) => (
          <Link key={k} href={k === "yangi" ? `${basePath}#sharhlar` : `${basePath}?sharh=${k}#sharhlar`} className="segment-item !px-3 text-[12.5px]" data-active={k === current} aria-current={k === current ? "true" : undefined} scroll={false}>
            {tr(til, PROFIL_X.reviewSort[k])}
          </Link>
        ))}
      </div>
    </div>
  );
}
