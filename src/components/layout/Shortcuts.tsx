"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { Kbd } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";

/** Matn kiritilayotgan joyda qisqartmalar ishlamaydi */
function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable || !!t.closest?.('[contenteditable="true"]');
}

const GO: Array<{ key: string; href: string; label: Tr }> = [
  { key: "h", href: "/", label: SHELL.shortcuts.goHome },
  { key: "q", href: "/qidiruv", label: SHELL.shortcuts.goSearch },
  { key: "l", href: "/lenta", label: SHELL.shortcuts.goLenta },
  { key: "j", href: "/jamoalar", label: SHELL.shortcuts.goGroups },
  { key: "x", href: "/kabinet/chat", label: SHELL.shortcuts.goMessages },
  { key: "b", href: "/kabinet/bildirishnomalar", label: SHELL.shortcuts.goNotifications },
  { key: "k", href: "/kabinet", label: SHELL.shortcuts.goCabinet },
];

/**
 * Global klaviatura qisqartmalari (root layout): `g` + harf — sahifaga o'tish, `c` — yaratish menyusi, `/` — qidiruv,
 * `?` — shu yordam oynasi. ⌘K — CommandPalette'ning o'zida. Modifikator (Ctrl/Alt/Meta) bilan bosilsa e'tiborsiz.
 */
export function Shortcuts() {
  const til = useLocale();
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const pending = useRef<{ t: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTyping(e.target)) return;
      const k = e.key;
      // Ikkinchi tugma (g dan keyin 1 s ichida)
      if (pending.current) {
        const live = Date.now() - pending.current.t < 1000;
        pending.current = null;
        if (live) {
          const hit = GO.find((g) => g.key === k.toLowerCase());
          if (hit) {
            e.preventDefault();
            router.push(hit.href);
            return;
          }
        }
      }
      if (k === "g" || k === "G") {
        pending.current = { t: Date.now() };
        return;
      }
      if (k === "?") {
        e.preventDefault();
        setHelp((v) => !v);
      } else if (k === "/") {
        e.preventDefault();
        window.dispatchEvent(new Event("open-search"));
      } else if (k === "c" || k === "C") {
        e.preventDefault();
        window.dispatchEvent(new Event("open-create"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Sheet open={help} onClose={() => setHelp(false)} title={tr(til, SHELL.shortcuts.title)}>
      <p className="text-[13px] leading-relaxed text-fg-3">{tr(til, SHELL.shortcuts.hint)}</p>
      <Section title={tr(til, SHELL.shortcuts.sectionActions)}>
        <Line keys={["⌘", "K"]} label={tr(til, SHELL.shortcuts.search)} />
        <Line keys={["/"]} label={tr(til, SHELL.shortcuts.search)} />
        <Line keys={["c"]} label={tr(til, SHELL.shortcuts.create)} />
        <Line keys={["?"]} label={tr(til, SHELL.shortcuts.help)} />
        <Line keys={["Esc"]} label={tr(til, SHELL.shortcuts.escape)} />
      </Section>
      <Section title={tr(til, SHELL.shortcuts.sectionGo)}>
        {GO.map((g) => (
          <Line key={g.key} keys={["g", g.key]} label={tr(til, g.label)} />
        ))}
      </Section>
      <div className="h-2" />
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{title}</h3>
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

function Line({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex min-h-10 items-center justify-between gap-4 py-1.5 text-[14px] text-fg">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
    </li>
  );
}
