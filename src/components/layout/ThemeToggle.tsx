"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";
import { AppearancePanel, useAppearance } from "./Appearance";

/**
 * «Ko'rinish» tugmasi (mobil yuqori panel): joriy rejim ikonkasi (avto/quyosh/oy); bosilganda tema (avto/yorug'/qorong'u),
 * shrift o'lchami va harakat sozlamalari varag'i ochiladi. Holat <html data-*> dan (useAppearance) — hidratsiyada xato yo'q.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const til = useLocale();
  const a = useAppearance();
  const [open, setOpen] = useState(false);
  const Icon = a.mode === "auto" ? Monitor : a.resolved === "dark" ? Moon : Sun;
  const label = tr(til, SHELL.appearance.title);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        data-tip={label}
        data-tip-pos="bottom"
        className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg", className)}
      >
        <span key={Icon.displayName} className="animate-swap inline-flex">
          <Icon size={18} />
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} size="sm">
        <AppearancePanel className="pb-2" />
      </Sheet>
    </>
  );
}

/**
 * <head> ichida chaqiriladi: birinchi render'dan oldin tema (auto → tizim), shrift o'lchami va harakat rejimini o'rnatadi
 * (flash bo'lmasligi uchun). Kalitlar: redince-theme (light|dark; yo'q = auto), redince-font (s|l), redince-motion (reduce).
 */
export const THEME_INIT_SCRIPT = `
(function(){try{var d=document.documentElement,s=localStorage,t=s.getItem('redince-theme');if(t!=='light'&&t!=='dark'){t='auto'}d.dataset.theme=t==='auto'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;d.dataset.themeMode=t;var f=s.getItem('redince-font');if(f==='s'||f==='l'){d.dataset.font=f}if(s.getItem('redince-motion')==='reduce'){d.dataset.motion='reduce'}}catch(e){document.documentElement.dataset.theme='light'}})();
`.trim();
