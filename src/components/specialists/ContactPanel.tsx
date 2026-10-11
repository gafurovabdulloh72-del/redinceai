import Link from "next/link";
import { Globe, Instagram, Lock, LogIn, Mail, Phone, Send, Youtube, type LucideIcon } from "lucide-react";
import { LOCK_LABEL, type Locked, type LockReason } from "@/lib/privacy";
import { cn, formatUzPhone, normalizeUzPhone } from "@/lib/utils";

export interface ContactValues {
  telegram: string | null;
  instagram: string | null;
  youtube: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
}

interface Row {
  key: keyof ContactValues;
  label: string;
  icon: LucideIcon;
  value?: string;
  href?: string;
  external?: boolean;
  lock?: LockReason;
}

function handle(v: string) {
  return v
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com)\//i, "")
    .replace(/\/+$/, "");
}

function prettyUrl(v: string) {
  try {
    const u = new URL(v);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return v;
  }
}

/** Ko'rsatish mumkin bo'lgan va yopiq (locked) aloqa qatorlarini tuzadi */
export function buildContactRows(c: ContactValues, locked: Locked): Row[] {
  const rows: Row[] = [];
  const push = (key: keyof ContactValues, label: string, icon: LucideIcon, present: (v: string) => Omit<Row, "key" | "label" | "icon">) => {
    const v = c[key];
    if (v) rows.push({ key, label, icon, ...present(v) });
    else if (locked[key]) rows.push({ key, label, icon, lock: locked[key] });
  };
  // Ko'rsatishda "+998 90 123 45 67", tel: havolada kanonik raqam (eski yozuvlar ham bir xil ko'rinadi)
  push("phone", "Telefon", Phone, (v) => ({ value: formatUzPhone(v), href: `tel:${normalizeUzPhone(v) ?? v.replace(/[^\d+]/g, "")}` }));
  push("telegram", "Telegram", Send, (v) => ({ value: `@${handle(v)}`, href: `https://t.me/${handle(v)}`, external: true }));
  push("instagram", "Instagram", Instagram, (v) => ({ value: `@${handle(v)}`, href: `https://instagram.com/${handle(v)}`, external: true }));
  push("youtube", "YouTube", Youtube, (v) => ({ value: prettyUrl(v), href: v, external: true }));
  push("website", "Veb-sayt", Globe, (v) => ({ value: prettyUrl(v), href: v, external: true }));
  push("email", "Email", Mail, (v) => ({ value: v, href: `mailto:${v}` }));
  return rows;
}

/**
 * "Aloqa" paneli. Yopiq maydonlar qiymatsiz, qulf belgisi va sabab bilan chiqadi:
 * "Faqat ro'yxatdan o'tganlarga ko'rinadi — Kirish" yoki "Buyurtma qabul qilingach ko'rinadi".
 */
export function ContactPanel({
  contacts,
  locked,
  loginHref,
  orderHref,
  className,
}: {
  contacts: ContactValues;
  locked: Locked;
  loginHref: string;
  /** Buyurtma sahifasi (null — ko'rsatilmaydi, masalan, egasi uchun) */
  orderHref?: string | null;
  className?: string;
}) {
  const rows = buildContactRows(contacts, locked);
  if (rows.length === 0) return null;
  const lockedCount = rows.filter((r) => r.lock).length;

  return (
    <section className={className} aria-label="Aloqa">
      <div className="mb-2 flex items-center justify-between px-4">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Aloqa</h3>
        {lockedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-3">
            <Lock size={11} /> {lockedCount} ta yopiq
          </span>
        )}
      </div>
      <ul className="card divide-y divide-line overflow-hidden">
        {rows.map((r) => {
          const Icon = r.icon;
          if (r.lock) {
            return (
              <li key={r.key} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-3 text-fg-3">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-fg-2">{r.label}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] leading-snug text-fg-3">
                    <Lock size={11} className="shrink-0" /> {LOCK_LABEL[r.lock]}
                  </p>
                </div>
                {r.lock === "login" ? (
                  <Link href={loginHref} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4">
                    <LogIn size={13} /> Kirish
                  </Link>
                ) : orderHref ? (
                  <Link href={orderHref} className="inline-flex h-9 shrink-0 items-center rounded-full bg-accent-soft px-3.5 text-[12px] font-semibold text-accent transition hover:brightness-105">
                    Buyurtma
                  </Link>
                ) : null}
              </li>
            );
          }
          return (
            <li key={r.key}>
              <a
                href={r.href}
                target={r.external ? "_blank" : undefined}
                rel={r.external ? "noreferrer noopener" : undefined}
                className={cn("flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-fg/4")}
              >
                <span className="btn-ink flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]">
                  <Icon size={16} />
                </span>
                <span className="flex-1 text-[14px] font-semibold text-fg">
                  {r.label}
                  {r.external && <span className="sr-only"> (yangi oynada)</span>}
                </span>
                <span className="max-w-[55%] truncate text-[14px] text-fg-3" dir="ltr">
                  {r.value}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
