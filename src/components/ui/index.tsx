import Link from "next/link";
import { BadgeCheck, Star, type LucideIcon } from "lucide-react";
import { cn, hashHue, initials } from "@/lib/utils";
import { AvatarImage } from "./AvatarImage";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
type Variant = "primary" | "accent" | "glass" | "ghost" | "outline" | "danger" | "tint-soft";
type Size = "sm" | "md" | "lg" | "icon";

const variantClass: Record<Variant, string> = {
  primary: "btn-ink font-semibold",
  accent: "btn-accent font-semibold",
  glass: "card card-hover !rounded-full text-fg font-semibold",
  "tint-soft": "bg-accent-soft text-accent font-semibold hover:brightness-105 active:scale-[0.97] transition",
  ghost: "text-fg-2 hover:bg-fg/6 hover:text-fg active:scale-[0.97] transition",
  outline: "border border-line-2 text-fg hover:border-fg hover:bg-fg/4 active:scale-[0.97] transition",
  danger: "bg-danger text-white font-semibold hover:brightness-110 active:scale-[0.97] transition",
};
const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[14px] gap-2",
  lg: "h-13 px-7 text-[15px] gap-2.5",
  icon: "h-11 w-11 p-0",
};

const base =
  "inline-flex items-center justify-center rounded-full whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none";

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
export type BadgeTone =
  | "neutral"
  | "accent"
  | "ink"
  | "glass"
  | "success"
  | "warning"
  | "danger"
  | "info"
  /* eski nomlar — moslik uchun (semantik ohanglarga yo'naltirilgan) */
  | "blue"
  | "green"
  | "orange"
  | "pink"
  | "purple";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-fg/6 text-fg-2",
  accent: "bg-accent-soft text-accent",
  ink: "bg-ink text-ink-fg",
  glass: "border border-line bg-surface text-fg-2",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  blue: "bg-info-soft text-info",
  green: "bg-success-soft text-success",
  orange: "bg-warning-soft text-warning",
  pink: "bg-accent-soft text-accent",
  purple: "bg-accent-2-soft text-accent-2",
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
  const px = iconSize ?? (size === "sm" ? 15 : size === "lg" ? 24 : 20);
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
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  /** Yonida ism ko'rsatilgan bo'lsa — ekran o'quvchi uchun ikki marta o'qilmasin */
  decorative?: boolean;
}) {
  const hue = hashHue(name);
  return (
    <span
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold text-white ring-2 ring-surface shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.34),
        /* Bosh harflar foni — past to'yinganlik, palitraga mos */
        background: `linear-gradient(145deg, hsl(${hue} 38% 52%), hsl(${(hue + 40) % 360} 36% 40%))`,
      }}
    >
      {initials(name)}
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
        <span className="text-xs font-semibold text-fg-2" aria-hidden="true">
          {value > 0 ? value.toFixed(1) : "—"}
          {count != null && <span className="font-normal text-fg-3"> ({count})</span>}
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
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:mb-10",
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <span className={cn("eyebrow mb-4", align === "center" && "justify-center")}>{eyebrow}</span>}
        <h2 className="font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.03em] text-fg sm:text-[36px] lg:text-[44px]">{title}</h2>
        {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Sahifa sarlavhasi — bosh sahifadagi uslub: eyebrow + display-xl + (ixtiyoriy) accent-serif so'z.
 * Ro'yxat, kabinet, buyurtma va auth sahifalarida bir xil ishlatiladi.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  size = "md",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** md — kabinet/auth (34/44px), lg — ommaviy sahifalar (34/48/56px) */
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1
          className={cn(
            "display-xl text-fg",
            eyebrow ? "mt-5" : undefined,
            size === "lg" ? "text-[34px] sm:text-[48px] lg:text-[56px]" : "text-[32px] sm:text-[40px] lg:text-[44px]",
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-outline flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <IconTile icon={Icon} tone="soft" size="lg" className="mb-4" />}
      <h3 className="font-display text-[17px] font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-fg-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current", className)}
      aria-label="Yuklanmoqda"
    />
  );
}

export function Stat({ value, label, accent, icon: Icon }: { value: ReactNode; label: string; accent?: string; icon?: LucideIcon }) {
  return (
    <div className="card flex items-start justify-between gap-3 px-5 py-4">
      <div>
        <div className="font-display text-[28px] font-semibold leading-none tracking-tight text-fg sm:text-[34px]" style={accent ? { color: accent } : undefined}>
          {value}
        </div>
        <div className="mt-2 text-xs font-medium text-fg-3">{label}</div>
      </div>
      {Icon && <IconTile icon={Icon} tone="soft" size="sm" />}
    </div>
  );
}

/** Ro'yxat guruhi (sozlamalar ro'yxati kabi) */
export function InsetGroup({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h3 className="mb-2 px-4 text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{title}</h3>}
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
