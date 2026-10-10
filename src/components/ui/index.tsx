import Link from "next/link";
import { Star, type LucideIcon } from "lucide-react";
import { cn, hashHue, initials } from "@/lib/utils";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Button — iOS pill tugmalar                                          */
/* ------------------------------------------------------------------ */
type Variant = "primary" | "glass" | "ghost" | "outline" | "danger" | "tint-soft";
type Size = "sm" | "md" | "lg" | "icon";

const variantClass: Record<Variant, string> = {
  primary: "glass-tint font-semibold",
  glass: "glass glass-pill glass-hover text-fg font-semibold",
  "tint-soft": "bg-tint-soft text-tint font-semibold hover:brightness-110 active:scale-[0.97] transition",
  ghost: "text-fg-2 hover:bg-fg/6 hover:text-fg active:scale-[0.97] transition",
  outline: "border border-hairline text-fg-2 hover:border-tint/50 hover:text-tint active:scale-[0.97] transition",
  danger: "bg-ios-red text-white font-semibold shadow-[0_8px_24px_-8px_rgba(255,69,58,0.7)] hover:brightness-110 active:scale-[0.97] transition",
};
const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
  icon: "h-10 w-10 p-0",
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
export function Badge({
  children,
  tone = "neutral",
  className,
  style,
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "orange" | "pink" | "purple" | "glass";
  className?: string;
  style?: CSSProperties;
}) {
  const tones = {
    neutral: "bg-fg/6 text-fg-2",
    blue: "bg-ios-blue/14 text-ios-blue",
    green: "bg-ios-green/16 text-[#1f9d46] dark:text-ios-green",
    orange: "bg-ios-orange/18 text-[#b86a00] dark:text-ios-orange",
    pink: "bg-ios-pink/14 text-ios-pink",
    purple: "bg-ios-purple/16 text-[#8e3bbd] dark:text-ios-purple",
    glass: "glass-weak glass-pill text-fg-2 !shadow-none",
  };
  return (
    <span
      style={style}
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none", tones[tone], className)}
    >
      {children}
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
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const hue = hashHue(name);
  const ring = "ring-2 ring-white/70 dark:ring-white/15 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", ring, className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-label={name}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", ring, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        background: `linear-gradient(145deg, hsl(${hue} 80% 62%), hsl(${(hue + 45) % 360} 75% 48%))`,
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stars                                                               */
/* ------------------------------------------------------------------ */
export function Stars({ value, size = 14, showValue = true, count }: { value: number; size?: number; showValue?: boolean; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex gap-px">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} className={cn(i <= Math.round(value) ? "fill-ios-orange text-ios-orange" : "text-fg-4")} />
        ))}
      </span>
      {showValue && (
        <span className="text-xs font-semibold text-fg-2">
          {value > 0 ? value.toFixed(1) : "—"}
          {count != null && <span className="font-normal text-fg-3"> ({count})</span>}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Glass Card / Section                                                */
/* ------------------------------------------------------------------ */
export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={cn("glass", hover && "glass-hover", className)}>{children}</div>;
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
        {eyebrow && (
          <span className="glass-weak glass-pill mb-3 inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
            {eyebrow}
          </span>
        )}
        <h2 className="text-[28px] font-bold leading-[1.1] tracking-tight text-fg sm:text-4xl lg:text-[44px]">{title}</h2>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">{description}</p>}
      </div>
      {action}
    </div>
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
    <div className="glass-weak flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="glass mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] text-tint">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-fg">{title}</h3>
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

export function Stat({ value, label, accent }: { value: ReactNode; label: string; accent?: string }) {
  return (
    <div className="glass px-5 py-4">
      <div className="text-[28px] font-bold leading-none tracking-tight text-fg sm:text-[34px]" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-2 text-xs font-medium text-fg-3">{label}</div>
    </div>
  );
}

/** iOS uslubidagi inset guruh (Settings ro'yxati kabi) */
export function InsetGroup({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h3 className="mb-2 px-4 text-[13px] font-semibold uppercase tracking-wide text-fg-3">{title}</h3>}
      <div className="glass divide-y divide-hairline overflow-hidden">{children}</div>
    </section>
  );
}

export function InsetRow({ label, value, icon: Icon, href }: { label: string; value?: ReactNode; icon?: LucideIcon; href?: string }) {
  const inner = (
    <>
      {Icon && (
        <span className="glass-tint flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
          <Icon size={15} />
        </span>
      )}
      <span className="flex-1 text-[15px] text-fg">{label}</span>
      {value && <span className="text-[15px] text-fg-3">{value}</span>}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn(cls, "transition hover:bg-fg/4")}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
