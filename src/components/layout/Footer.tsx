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
  { href: "/buyurtma-berish", label: SHELL.footer.orderWizard },
  { href: "/ishlar", label: SHELL.footer.jobs },
  { href: "/narxlar", label: SHELL.footer.prices },
  { href: "/yordam", label: SHELL.footer.help },
  { href: "/haqida", label: SHELL.footer.about },
  { href: "/auth/royxat?role=specialist", label: SHELL.footer.becomeSpecialist },
];

/** Huquqiy hujjatlar — ikkinchi qatorda, mualliflik huquqi yonida */
const LEGAL: Array<{ href: string; label: Tr }> = [
  { href: "/oferta", label: SHELL.footer.terms },
  { href: "/maxfiylik", label: SHELL.footer.privacy },
];

const SOCIAL = [
  { href: SITE.telegram, label: "Telegram", icon: Send },
  { href: SITE.instagram, label: "Instagram", icon: Instagram },
];

/** Ixcham 2 qatorli footer: logo + havolalar + ijtimoiy tarmoqlar / huquq + manba eslatmasi */
export async function Footer() {
  const til = await getLocale();
  return (
    <footer className="container-x mt-24 pb-28 sm:mt-28 md:pb-10">
      <div className="card-outline overflow-hidden !rounded-card-lg">
        {/* 1-qator */}
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Logo />
            <p className="max-w-sm text-[13px] leading-snug text-fg-3">{tr(til, SHELL.footer.tagline)}</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <nav aria-label={tr(til, SHELL.footer.linksAria)} className="flex flex-wrap gap-x-5 gap-y-2">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="inline-flex min-h-10 items-center text-[13.5px] font-medium text-fg-2 transition hover:text-fg">
                  {tr(til, l.label)}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1.5" aria-label={tr(til, SHELL.footer.socialAria)}>
              {SOCIAL.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={SHELL.footer.newWindow[til](s.label)}
                  className="card flex h-10 w-10 items-center justify-center !rounded-full text-fg-2 transition hover:text-fg"
                >
                  <s.icon size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 2-qator */}
        <div className="flex flex-col items-start justify-between gap-1.5 border-t border-line px-5 py-4 text-[12px] text-fg-3 sm:flex-row sm:items-center sm:px-8">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              © {new Date().getFullYear()} {SITE.name}. {tr(til, SHELL.footer.rights)}
            </span>
            <span>{SHELL.footer.owner[til](SITE.owner)}</span>
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} className="-my-1.5 inline-flex min-h-10 items-center text-fg-3 underline-offset-2 transition hover:text-fg hover:underline">
                {tr(til, l.label)}
              </Link>
            ))}
          </span>
          <span className="text-fg-4">
            {tr(til, SHELL.footer.mapBorders)}{" "}
            <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer noopener" className="-my-1.5 -mx-1 inline-flex min-h-8 items-center px-1 underline-offset-2 hover:underline">
              geoBoundaries
            </a>
            , CC BY 4.0
          </span>
        </div>
      </div>
      {/* PWA: service worker faqat productionda ro'yxatdan o'tadi */}
      <ServiceWorkerRegister />
    </footer>
  );
}
