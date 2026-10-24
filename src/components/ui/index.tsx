import Link from "next/link";
import { BadgeCheck, Star, type LucideIcon } from "lucide-react";
import { cn, hashHue, initials } from "@/lib/utils";
import { AvatarImage } from "./AvatarImage";
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
/** 5 ta haqiqiy variant; `glass` → outline, `tint-soft` → ghost (eski nomlar moslik uchun, alohida uslub yo'q) */
type Variant = "primary" | "accent" | "ghost" | "outline" | "danger" | "glass" | "tint-soft";
type Size = "sm" | "md" | "lg" | "icon";

const OUTLINE = "border border-line-2 text-fg hover:border-fg hover:bg-fg/4";
const GHOST = "text-fg-2 hover:bg-fg/6 hover:text-fg";
const variantClass: Record<Variant, string> = {
  primary: "btn-ink font-semibold",
  accent: "btn-accent font-semibold",
  ghost: GHOST,
  outline: OUTLINE,
  danger: "bg-danger-strong text-white font-semibold hover:brightness-110",
  glass: cn(OUTLINE, "font-semibold"),
  "tint-soft": cn(GHOST, "font-semibold"),
};
const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[14px] gap-2",
  lg: "h-13 px-7 text-[15px] gap-2.5",
  icon: "h-11 w-11 p-0",
};

/* Barcha tugmalar: pill, bosilganda 0.97 ga qisqaradi; fokus halqasi — global :focus-visible qoidasidan (dublikat yo'q) */
const base =
  "inline-flex items-center justify-center rounded-full whitespace-nowrap select-none transition-[transform,filter,background-color,border-color,opacity] duration-200 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(base, variantClass[variant], sizeClass[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}) {
  return (
    <Link href={href} className={cn(base, variantClass[variant], sizeClass[size], className)} {...rest}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / Chip                                                        */
/* ------------------------------------------------------------------ */
/** 6 ta ohang: neytral (standart), aksent, siyoh, 3 ta semantik + info. Eski nomlar (blue/green/orange/pink/purple/glass) moslik uchun — neytral yoki semantikka yo'naltirilgan */
export type BadgeTone = "neutral" | "accent" | "ink" | "success" | "warning" | "danger" | "info" | "glass" | "blue" | "green" | "orange" | "pink" | "purple";

const NEUTRAL = "bg-fg/6 text-fg-2";
const badgeTones: Record<BadgeTone, string> = {
  neutral: NEUTRAL,
  accent: "bg-accent-soft text-accent-text",
  ink: "bg-ink text-ink-fg",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
  glass: "border border-line bg-surface text-fg-2",
  blue: "bg-info-soft text-info-text",
  green: "bg-success-soft text-success-text",
  orange: "bg-warning-soft text-warning-text",
  pink: NEUTRAL,
  purple: NEUTRAL,
};

export function Badge({
  children,
  tone = "neutral",
  className,
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none", badgeTones[tone], className)}
    >
      {children}
    </span>
  );
}

/** Tasdiqlangan profil belgisi — butun ilovada bitta rang (accent; qora fonda "ink") */
export function VerifiedBadge({
  size = 16,
  className,
  label = "Tasdiqlangan profil",
  tone = "accent",
}: {
  size?: number;
  className?: string;
  label?: string;
  tone?: "accent" | "ink";
}) {
  return (
    <BadgeCheck
      size={size}
      className={cn("shrink-0", tone === "ink" ? "fill-ink text-ink-fg" : "fill-accent text-white", className)}
      aria-label={label}
      role="img"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Icon tile — ikonka plitkasi (kabinet statlari, bo'lim sarlavhalari) */
/* ------------------------------------------------------------------ */
export function IconTile({
  icon: Icon,
  tone = "ink",
  size = "md",
  className,
  iconSize,
}: {
  icon: LucideIcon;
  tone?: "ink" | "soft" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  iconSize?: number;
}) {
  const toneClass = tone === "soft" ? "icon-tile-soft" : tone === "outline" ? "icon-tile-outline" : "icon-tile";
  const sizeCls = size === "sm" ? "icon-tile-sm" : size === "lg" ? "icon-tile-lg" : undefined;
  const px = iconSize ?? (size === "sm" ? 16 : size === "lg" ? 24 : 20);
  return (
    <span className={cn(toneClass, sizeCls, className)} aria-hidden="true">
      <Icon size={px} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */
export function Avatar({
  name,
  src,
  size = 40,
  className,
  decorative = false,
  singleInitial = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  /** Yonida ism ko'rsatilgan bo'lsa — ekran o'quvchi uchun ikki marta o'qilmasin */
  decorative?: boolean;
  /** Ustma-ust (stack) kichik avatarlar: bitta harf — qo'shni avatar ikkinchi harfni kesmasin */
  singleInitial?: boolean;
}) {
  const hue = hashHue(name);
  return (
    <span
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold text-white ring-2 ring-surface", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.34),
        /* Bosh harflar foni — past to'yinganlik, palitraga mos */
        background: `linear-gradient(145deg, hsl(${hue} 38% 52%), hsl(${(hue + 40) % 360} 36% 40%))`,
      }}
    >
      {singleInitial ? initials(name).slice(0, 1) : initials(name)}
      {/* Rasm yuklanmasa chizilmaydi — ostidagi bosh harflar ko'rinadi */}
      {src && <AvatarImage src={src} size={size} />}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stars                                                               */
/* ------------------------------------------------------------------ */
export function Stars({ value, size = 14, showValue = true, count }: { value: number; size?: number; showValue?: boolean; count?: number }) {
  const label = value > 0 ? `Reyting: 5 dan ${value.toFixed(1)}${count != null ? `, ${count} ta sharh` : ""}` : "Hali baholanmagan";
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={label}>
      <span className="inline-flex gap-px" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} className={cn(i <= Math.round(value) ? "fill-accent-3 text-accent-3" : "text-fg-4")} />
        ))}
      </span>
      {showValue && (
        <span className={cn("whitespace-nowrap text-xs", value > 0 ? "font-semibold text-fg-2" : "font-medium text-fg-3")} aria-hidden="true">
          {value > 0 ? value.toFixed(1) : "Hali yo'q"}
          {value > 0 && count != null && <span className="font-normal text-fg-3"> ({count})</span>}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card / Section                                                      */
/* ------------------------------------------------------------------ */
export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={cn("card", hover && "card-hover", className)}>{children}</div>;
}

/**
 * Sarlavha bloki (PageHeader va SectionHeading bir xil tuzilma): eyebrow (ixtiyoriy, tinch) → sarlavha chapda,
 * tavsif/amal o'ngda (lg+), ikkalasi birinchi matn qatori bazaviy chizig'iga tekislangan (`items-baseline`).
 */
function HeadingBlock({
  as: Tag,
  titleClass,
  eyebrow,
  title,
  description,
  action,
  descClass,
}: {
  as: "h1" | "h2";
  titleClass: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  descClass: string;
}) {
  // v6: ustki yozuv (eyebrow) ko'rsatilmaydi; sarlavha chapda, amal o'ngda (bir qator), tavsif sarlavha ostida
  void eyebrow;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
        <Tag className={cn(titleClass, "text-fg")}>{title}</Tag>
        {description && <p className={cn("mt-1.5 max-w-xl leading-relaxed text-fg-3", descClass)}>{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
}) {
  if (align === "center") {
    return (
      <div className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
        {eyebrow && <span className="eyebrow justify-center">{eyebrow}</span>}
        <h2 className="display-lg mx-auto max-w-3xl text-fg">{title}</h2>
        {description && <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-fg-2">{description}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    );
  }
  return (
    <div className="mb-6 sm:mb-8">
      <HeadingBlock as="h2" titleClass="display-lg" eyebrow={eyebrow} title={title} description={description} action={action} descClass="text-[15px]" />
    </div>
  );
}

/** Sahifa sarlavhasi (h1): ro'yxat, kabinet, buyurtma va auth sahifalarida bir xil. `size` moslik uchun qoldirilgan — o'lcham display-xl klampidan */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col", className)}>
      {/* Telefonda sarlavha va tavsif yashirin: yuqori panel sahifa nomini ko'rsatadi (ilova hissi), ekran matnga ketmaydi */}
      <HeadingBlock as="h1" titleClass="display-xl max-sm:hidden" eyebrow={eyebrow} title={title} description={description} action={action} descClass="text-[14.5px] max-sm:hidden sm:text-[15px]" />
    </header>
  );
}

/**
 * Bo'sh holat. Variantlar: `card` (standart — kontur karta, katta plitka), `compact` (kichikroq, ro'yxat ichida),
 * `inline` (chegarasiz, bir qator — filtr natijasi yo'q, kichik bloklar).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "card" | "compact" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3 py-4 text-left", className)} role="status">
        {Icon && <Icon size={18} className="shrink-0 text-fg-3" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-fg">{title}</p>
          {description && <p className="text-[13px] text-fg-3">{description}</p>}
        </div>
        {action}
      </div>
    );
  }
  const compact = variant === "compact";
  return (
    <div data-reveal="scale" className={cn("card-outline flex flex-col items-center justify-center text-center", compact ? "px-5 py-8" : "px-6 py-14", className)}>
      {Icon && <IconTile icon={Icon} tone="soft" size={compact ? "md" : "lg"} className={compact ? "mb-3" : "mb-4"} />}
      <h3 className={cn("font-display font-semibold text-fg", compact ? "text-[15px]" : "text-[17px]")}>{title}</h3>
      {description && <p className={cn("mt-1.5 max-w-sm text-fg-3", compact ? "text-[13px]" : "text-sm")}>{description}</p>}
      {action && <div className={compact ? "mt-4" : "mt-5"}>{action}</div>}
    </div>
  );
}

/** Yuklanish belgisi — role="status" (ekran o'quvchi e'lon qiladi); `label` — ru sahifalar uchun matnni bering */
export function Spinner({ className, label = "Yuklanmoqda" }: { className?: string; label?: string }) {
  return <span role="status" aria-label={label} className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current", className)} />;
}

/* ------------------------------------------------------------------ */
/* Skeleton / Kbd / Tooltip                                            */
/* ------------------------------------------------------------------ */
/** Skelet plitka: `.skeleton` tinch pulsatsiya; `lines` — matn qatorlari (oxirgisi qisqa). Yuklangan kontentga `.skeleton-swap` bering */
export function Skeleton({ className, lines, ...rest }: HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  if (lines && lines > 1) {
    return (
      <div className={cn("grid gap-2", className)} aria-hidden="true" {...rest}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn("skeleton h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  }
  return <div className={cn("skeleton", className)} aria-hidden="true" {...rest} />;
}

/** Klaviatura tugmasi: <Kbd>⌘</Kbd><Kbd>K</Kbd> */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

/**
 * Tooltip (CSS-only, 350 ms kechikish, faqat ko'rsatkichli qurilmalarda): bola elementga data-tip beradi.
 * Ekran o'quvchi uchun bola o'zida aria-label/matn bo'lishi kerak — tooltip faqat vizual.
 *   <Tooltip text="Ulashish"><button aria-label="Ulashish">…</button></Tooltip>
 */
export function Tooltip({ text, pos = "top", children, className }: { text: string; pos?: "top" | "bottom" | "right"; children: ReactNode; className?: string }) {
  return (
    <span data-tip={text} data-tip-pos={pos === "top" ? undefined : pos} className={cn("inline-flex", className)}>
      {children}
    </span>
  );
}

/** Ro'yxat guruhi (sozlamalar ro'yxati kabi) — sarlavha eyebrow uslubida */
export function InsetGroup({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h3 className="eyebrow mb-2 px-4">{title}</h3>}
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

export function InsetRow({ label, value, icon: Icon, href }: { label: string; value?: ReactNode; icon?: LucideIcon; href?: string }) {
  const external = !!href && /^https?:\/\//i.test(href);
  const inner = (
    <>
      {Icon && <IconTile icon={Icon} size="sm" />}
      <span className="flex-1 text-[15px] text-fg">
        {label}
        {external && <span className="sr-only"> (yangi oynada)</span>}
      </span>
      {value && <span className="text-[15px] text-fg-3">{value}</span>}
    </>
  );
  const cls = "flex min-h-12 items-center gap-3 px-4 py-3";
  return href ? (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined} className={cn(cls, "transition hover:bg-fg/4")}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
