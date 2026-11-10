import Link from "next/link";
import { ArrowRight, CircleCheck, Info, TriangleAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * E'lon chizig'ining KO'RINISHI (holatsiz, hook'siz) — server (`SiteBanner`) ham, admin oldindan ko'rishi ham shu
 * bitta komponentni chizadi, shuning uchun admin ko'rgan narsa tashrifchi ko'radigan bilan aynan bir xil.
 * Ohanglar — globals.css semantik tokenlari (xom rang yo'q): info / warn / success; `maintenance` — texnik ishlar.
 */
export type BannerViewTone = "info" | "warn" | "success";

const TONE: Record<BannerViewTone, { box: string; icon: string }> = {
  info: { box: "border-info/25 bg-info-soft", icon: "text-info-text" },
  warn: { box: "border-warning/35 bg-warning-soft", icon: "text-warning-text" },
  success: { box: "border-success/30 bg-success-soft", icon: "text-success-text" },
};
const ICON = { info: Info, warn: TriangleAlert, success: CircleCheck } as const;

export function SiteBannerView({
  tone,
  text,
  href,
  moreLabel,
  maintenance = false,
  title,
  className,
}: {
  tone: BannerViewTone;
  text: string;
  /** Ichki yo'l (/…) yoki https havola — serverda tekshirilgan (safeBannerHref) */
  href?: string | null;
  moreLabel?: string;
  /** Texnik ishlar chizig'i: kalit ikonka + qalin sarlavha */
  maintenance?: boolean;
  title?: string;
  className?: string;
}) {
  const Icon = maintenance ? Wrench : ICON[tone];
  const t = TONE[tone];
  const external = Boolean(href && /^https:\/\//i.test(href));
  const linkCls = "ml-1.5 inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-fg underline decoration-fg/30 underline-offset-2 transition-colors hover:decoration-fg";
  return (
    <div className={cn("flex items-start gap-2.5 border-b px-4 py-2.5 text-[13px] leading-snug text-fg sm:px-6 lg:px-8", t.box, className)}>
      <Icon size={16} className={cn("mt-px shrink-0", t.icon)} aria-hidden="true" />
      {/* data-no-auto: matnni admin ikki tilda o'zi yozgan — avtomatik tarjima qatlami tegmasin */}
      <p className="min-w-0 flex-1 break-words" data-no-auto>
        {title && <strong className="mr-1.5 font-semibold">{title}.</strong>}
        {text}
        {href &&
          moreLabel &&
          (external ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {moreLabel} <ArrowRight size={13} aria-hidden="true" />
            </a>
          ) : (
            <Link href={href} className={linkCls}>
              {moreLabel} <ArrowRight size={13} aria-hidden="true" />
            </Link>
          ))}
      </p>
    </div>
  );
}
