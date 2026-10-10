import Link from "next/link";
import { Send } from "lucide-react";
import { CATEGORIES, REGIONS, SITE } from "@/lib/constants";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="container-x mt-24 pb-28 md:pb-10">
      <div className="glass p-6 sm:p-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Logo />
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-fg-2">{SITE.description}</p>
            <a
              href="https://t.me/redince"
              target="_blank"
              rel="noreferrer"
              className="glass-weak glass-pill mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-tint"
            >
              <Send size={15} /> Telegram kanal
            </a>
          </div>

          <div className="md:col-span-3">
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-fg-3">Yo'nalishlar</h4>
            <ul className="space-y-2.5 text-[15px] text-fg-2">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/mutaxassislar?category=${c.slug}`} className="transition hover:text-tint">
                    {c.plural}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-fg-3">Hududlar</h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[15px] text-fg-2">
              {REGIONS.map((r) => (
                <li key={r.slug}>
                  <Link href={`/mutaxassislar?region=${r.slug}`} className="transition hover:text-tint">
                    {r.short}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-fg-3">Platforma</h4>
            <ul className="space-y-2.5 text-[15px] text-fg-2">
              <li><Link href="/xarita" className="transition hover:text-tint">Xarita</Link></li>
              <li><Link href="/mutaxassislar" className="transition hover:text-tint">Mutaxassislar</Link></li>
              <li><Link href="/auth/royxat?role=specialist" className="transition hover:text-tint">Mutaxassis bo'lish</Link></li>
              <li><Link href="/kabinet" className="transition hover:text-tint">Kabinet</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-hairline pt-5 text-xs text-fg-3 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} {SITE.name}. Barcha huquqlar himoyalangan.</span>
          <span>Xarita ma'lumotlari: geoBoundaries (CC BY 4.0)</span>
        </div>
      </div>
    </footer>
  );
}
