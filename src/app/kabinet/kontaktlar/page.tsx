import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Contact, Instagram, Lock, Mail, Phone, Send, Users } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui";
import { ContactModeSwitch } from "@/components/contacts/ContactModeSwitch";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { contactPriceFor, listContactBuyers, listUnlockedContacts } from "@/lib/contacts/unlock";
import { getSettings } from "@/lib/payments/settings";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { getLocale } from "@/lib/i18n/server";
import { formatDate, formatPrice, formatUzPhone, normalizeUzPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Kontaktlar"]) };
}

const handle = (v: string) => v.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com)\//i, "").replace(/\/+$/, "");

/**
 * Kontaktlar (2026-10-31): mijoz (va boshqa mutaxassislar) — platformaga to'lab ochgan kontaktlari (to'liq, havolalar bilan);
 * mutaxassis — kontakt rejimi («sotilsin» / «faqat portfolio») va kontaktini kim sotib olgani.
 */
export default async function KontaktlarPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/kontaktlar"));
  const sp = user.role === "specialist" || user.role === "admin" ? await db.query.specialists.findFirst({ where: eq(specialists.userId, user.id), columns: { id: true, experience: true, contactMode: true, contactPrice: true } }) : null;
  const [unlocked, buyers, settings] = await Promise.all([listUnlockedContacts(user.id), sp ? listContactBuyers(sp.id) : Promise.resolve([]), getSettings()]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-fg max-sm:hidden">Kontaktlar</h1>

      {sp && (
        <section className="card m-flat p-4 sm:p-5" aria-labelledby="kontakt-rejim">
          <h2 id="kontakt-rejim" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Lock size={16} /> Kontaktim qanday ochiladi
          </h2>
          <p className="mt-1 text-[12.5px] leading-snug text-fg-3">Platforma qoidasi: aloqa ma&apos;lumotlaringiz hech kimga bepul ko&apos;rinmaydi. Narxni administrator belgilaydi (tajriba darajasi bo&apos;yicha yoki sizga maxsus).</p>
          <div className="mt-3">
            <ContactModeSwitch initial={sp.contactMode} price={contactPriceFor(sp, settings)} />
          </div>
        </section>
      )}

      {sp && (
        <section className="space-y-2" aria-labelledby="kontakt-buyers">
          <h2 id="kontakt-buyers" className="flex items-center gap-2 px-1 text-[15px] font-semibold text-fg">
            <Users size={16} /> Kontaktimni olganlar <span className="text-fg-3">({buyers.length})</span>
          </h2>
          {buyers.length === 0 ? (
            <EmptyState variant="compact" icon={Users} title="Hali hech kim olmagan" description="Mijoz kontaktingizni ochganda shu yerda ko'rinadi va sizga bildirishnoma keladi." />
          ) : (
            <ul className="card m-flat divide-y divide-line overflow-hidden">
              {buyers.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={b.buyer.name} src={b.buyer.avatarUrl} size={40} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{b.buyer.name}</span>
                    <span className="block text-[12px] text-fg-3">{formatDate(new Date(b.at))}{b.amount ? ` · ${formatPrice(b.amount)}` : ""}</span>
                  </span>
                  {b.buyer.username && (
                    <Link href={`/yozish/${b.buyer.username}`} className="inline-flex h-9 items-center rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg hover:border-fg">
                      Yozish
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="kontakt-mine">
        <h2 id="kontakt-mine" className="flex items-center gap-2 px-1 text-[15px] font-semibold text-fg">
          <Contact size={16} /> Ochgan kontaktlarim <span className="text-fg-3">({unlocked.length})</span>
        </h2>
        {unlocked.length === 0 ? (
          <EmptyState variant="compact" icon={Contact} title="Hali kontakt ochmagansiz" description="Mutaxassis profilida «Kontaktni ochish» tugmasini bosing — to'lovdan so'ng telefon, Telegram va boshqa aloqa vositalari shu yerda saqlanadi." action={<Link href="/mutaxassislar" className="btn-accent inline-flex h-10 items-center px-5 text-[13px] font-semibold">Mutaxassislar</Link>} />
        ) : (
          <ul className="card m-flat divide-y divide-line overflow-hidden">
            {unlocked.map((u) => {
              const s = u.specialist;
              const rows: Array<{ icon: typeof Phone; label: string; value: string; href: string; external?: boolean }> = [];
              if (s.phone) rows.push({ icon: Phone, label: "Telefon", value: formatUzPhone(s.phone), href: `tel:${normalizeUzPhone(s.phone) ?? s.phone.replace(/[^\d+]/g, "")}` });
              if (s.telegram) rows.push({ icon: Send, label: "Telegram", value: `@${handle(s.telegram)}`, href: `https://t.me/${handle(s.telegram)}`, external: true });
              if (s.instagram) rows.push({ icon: Instagram, label: "Instagram", value: `@${handle(s.instagram)}`, href: `https://instagram.com/${handle(s.instagram)}`, external: true });
              if (s.email) rows.push({ icon: Mail, label: "Email", value: s.email, href: `mailto:${s.email}` });
              return (
                <li key={u.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} src={s.avatarUrl} size={44} decorative />
                    <span className="min-w-0 flex-1">
                      <Link href={`/mutaxassislar/${s.slug}`} className="block truncate text-[14.5px] font-semibold text-fg hover:underline">
                        {s.name}
                      </Link>
                      <span className="block truncate text-[12.5px] text-fg-3">{CATEGORY_BY_SLUG[s.category]?.name ?? s.title}</span>
                    </span>
                    <span className="shrink-0 text-right text-[11.5px] text-fg-4">
                      {formatDate(new Date(u.paidAt))}
                      {u.amount > 0 && <span className="block tabular-nums">{formatPrice(u.amount)}</span>}
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="mt-2 text-[12.5px] text-fg-3">Mutaxassis hali aloqa ma&apos;lumotlarini to&apos;ldirmagan — sayt chati orqali yozing.</p>
                  ) : (
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {rows.map((r) => {
                        const Icon = r.icon;
                        return (
                          <li key={r.label}>
                            <a href={r.href} target={r.external ? "_blank" : undefined} rel={r.external ? "noreferrer noopener" : undefined} className="flex items-center gap-2.5 rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] transition hover:bg-fg/6">
                              <Icon size={14} className="shrink-0 text-fg-3" />
                              <span className="text-fg-3">{r.label}</span>
                              <span className="ml-auto truncate font-semibold text-fg" dir="ltr">{r.value}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
