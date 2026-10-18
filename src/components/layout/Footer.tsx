import Link from "next/link";
import { Instagram, Send } from "lucide-react";
import { SITE } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { Logo } from "./Logo";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

const LINKS: Array<{ href: string; label: Tr }> = [
  { href: "/xarita", label: SHELL.footer.map },
  { href: "/mutaxassislar", label: SHELL.footer.specialists },
  { href: "/ishlar", label: SHELL.footer.jobs },
  { href: "/jamoalar", label: SHELL.footer.groups },
  { href: "/vakansiyalar", label: SHELL.footer.vacancies },
  { href: "/narxlar", label: SHELL.footer.prices },
  { href: "/yordam", label: SHELL.footer.help },
  { href: "/haqida", label: SHELL.footer.about },
];
const LEGAL: Array<{ href: string; label: Tr }> = [
  { href: "/oferta", label: SHELL.footer.terms },
  { href: "/maxfiylik", label: SHELL.footer.privacy },
];
const SOCIAL = [
  { href: SITE.telegram, label: "Telegram", icon: Send },
  { href: SITE.instagram, label: "Instagram", icon: Instagram },
];

/** v3 footer: karta emas — yuqorida hairline, bir qatorda logo + havolalar + ijtimoiy ikonkalar, pastda huquqiy qator */
export async function Footer() {
  const til = await getLocale();
  return (
    <footer className="container-x mt-12 border-t border-line pb-28 pt-8 sm:mt-20 md:pb-10">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <p className="hidden max-w-xs text-[12.5px] leading-snug text-fg-3 lg:block">{tr(til, SHELL.footer.tagline)}</p>
        </div>
        <nav aria-label={tr(til, SHELL.footer.linksAria)} className="flex flex-wrap gap-x-5 gap-y-1.5">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-9 items-center text-[13px] font-medium text-fg-2 transition hover:text-fg">
              {tr(til, l.label)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1" aria-label={tr(til, SHELL.footer.socialAria)}>
          {SOCIAL.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noreferrer noopener" aria-label={SHELL.footer.newWindow[til](s.label)} className="flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
              <s.icon size={16} />
            </a>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-1.5 text-[12px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            © {new Date().getFullYear()} {SITE.name}. {tr(til, SHELL.footer.rights)}
          </span>
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-fg">
              {tr(til, l.label)}
            </Link>
          ))}
          <Link href="/auth/royxat?role=specialist" className="transition hover:text-fg">
            {tr(til, SHELL.footer.becomeSpecialist)}
          </Link>
        </span>
        <span>
          {tr(til, SHELL.footer.mapBorders)}{" "}
          <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
            geoBoundaries
          </a>
          , CC BY 4.0
        </span>
      </div>
      <ServiceWorkerRegister />
    </footer>
  );
}
