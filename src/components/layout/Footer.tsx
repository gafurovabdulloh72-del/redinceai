import Link from "next/link";
import { Instagram, Send } from "lucide-react";
import { SITE } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { Logo } from "./Logo";

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

/** v3 footer: karta emas — yuqorida hairline; 1-qator logo + havolalar + ijtimoiy ikonkalar, 2-qator huquqiy (barcha havolalar ≥36px bosish maydoni) */
export async function Footer() {
  const til = await getLocale();
  const small = "inline-flex min-h-9 items-center transition hover:text-fg";
  return (
    <footer className="container-x mt-12 border-t border-line pb-28 pt-8 sm:mt-16 md:pb-10" data-print-hide>
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <Logo />
        <nav aria-label={tr(til, SHELL.footer.linksAria)} className="flex flex-wrap gap-x-5 gap-y-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`${small} text-[13px] font-medium text-fg-2`}>
              {tr(til, l.label)}
            </Link>
          ))}
        </nav>
        {/* role="group": oddiy div'da aria-label ekran o'quvchiga yetib bormaydi */}
        <div className="flex items-center" role="group" aria-label={tr(til, SHELL.footer.socialAria)}>
          {SOCIAL.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noreferrer noopener" aria-label={SHELL.footer.newWindow[til](s.label)} className="flex h-10 w-10 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
              <s.icon size={16} />
            </a>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1 text-[12px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-wrap items-center gap-x-4">
          <span className="inline-flex min-h-9 items-center">
            © {new Date().getFullYear()} {SITE.name}. {tr(til, SHELL.footer.rights)}
          </span>
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href} className={small}>
              {tr(til, l.label)}
            </Link>
          ))}
        </span>
        <span className="inline-flex min-h-9 items-center">
          {tr(til, SHELL.footer.mapBorders)}&nbsp;
          <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-fg">
            geoBoundaries
          </a>
          , CC BY 4.0
        </span>
      </div>
    </footer>
  );
}
