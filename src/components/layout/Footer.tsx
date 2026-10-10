import Link from "next/link";
import { ArrowUpRight, Send } from "lucide-react";
import { CATEGORIES, REGIONS, SITE } from "@/lib/constants";
import { Logo } from "./Logo";

const linkCls = "block py-1.5 transition hover:text-accent";

export function Footer() {
  return (
    <footer className="container-x mt-28 pb-28 md:pb-10">
      <div className="card-outline overflow-hidden !rounded-[32px]">
        {/* Katta CTA qatori */}
        <div className="flex flex-col gap-6 border-b border-line p-6 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Logo />
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-2">{SITE.description}</p>
          </div>
          <a
            href="https://t.me/redince"
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ink inline-flex h-12 items-center gap-2 self-start rounded-full px-6 text-[14px] font-semibold"
          >
            <Send size={15} /> Telegram kanal <ArrowUpRight size={15} />
            <span className="sr-only">(yangi oynada)</span>
          </a>
        </div>

        <div className="grid gap-10 p-6 sm:p-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h4 className="eyebrow mb-4">Yo'nalishlar</h4>
            <ul className="grid grid-cols-2 gap-x-4 text-[14px] text-fg-2">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/mutaxassislar?category=${c.slug}`} className={linkCls}>
                    {c.plural}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-5">
            <h4 className="eyebrow mb-4">Hududlar</h4>
            <ul className="grid grid-cols-2 gap-x-4 text-[14px] text-fg-2 sm:grid-cols-3">
              {REGIONS.map((r) => (
                <li key={r.slug}>
                  <Link href={`/mutaxassislar?region=${r.slug}`} className={linkCls}>
                    {r.short}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="eyebrow mb-4">Platforma</h4>
            <ul className="text-[14px] text-fg-2">
              <li><Link href="/mutaxassislar" className={linkCls}>Mutaxassislar</Link></li>
              <li><Link href="/#hududlar" className={linkCls}>Hududlar</Link></li>
              <li><Link href="/auth/royxat?role=specialist" className={linkCls}>Mutaxassis bo'lish</Link></li>
              <li><Link href="/kabinet" className={linkCls}>Kabinet</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-2 border-t border-line px-6 py-5 text-xs text-fg-3 sm:flex-row sm:items-center sm:px-10">
          <span>© {new Date().getFullYear()} {SITE.name}. Barcha huquqlar himoyalangan.</span>
          <span>{REGIONS.length} hudud · {CATEGORIES.length} yo'nalish · O'zbekiston</span>
        </div>
      </div>
    </footer>
  );
}
