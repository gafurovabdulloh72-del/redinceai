import Link from "next/link";
import { Instagram, Send, Youtube } from "lucide-react";
import { SITE } from "@/lib/constants";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/xarita", label: "Xarita" },
  { href: "/mutaxassislar", label: "Mutaxassislar" },
  { href: "/auth/royxat?role=specialist", label: "Mutaxassis bo'lish" },
  { href: "/kabinet", label: "Kabinet" },
];

const SOCIAL = [
  { href: "https://t.me/redince", label: "Telegram", icon: Send },
  { href: "https://instagram.com/redince", label: "Instagram", icon: Instagram },
  { href: "https://youtube.com/@redince", label: "YouTube", icon: Youtube },
];

/** Ixcham 2 qatorli footer: logo + havolalar + ijtimoiy tarmoqlar / huquq + manba eslatmasi */
export function Footer() {
  return (
    <footer className="container-x mt-24 pb-28 sm:mt-28 md:pb-10">
      <div className="card-outline overflow-hidden !rounded-card-lg">
        {/* 1-qator */}
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Logo />
            <p className="max-w-sm text-[13px] leading-snug text-fg-3">{SITE.tagline}. Videograf, montajor, dizayner — 14 ta hudud, bitta xarita.</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <nav aria-label="Footer havolalari" className="flex flex-wrap gap-x-5 gap-y-2">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="inline-flex min-h-8 items-center text-[13.5px] font-medium text-fg-2 transition hover:text-fg">
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1.5" aria-label="Ijtimoiy tarmoqlar">
              {SOCIAL.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${s.label} (yangi oynada)`}
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
          <span>
            © {new Date().getFullYear()} {SITE.name}. Barcha huquqlar himoyalangan.
          </span>
          <span className="text-fg-4">
            Xarita chegaralari —{" "}
            <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
              geoBoundaries
            </a>
            , CC BY 4.0
          </span>
        </div>
      </div>
    </footer>
  );
}
