"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function readTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || "light";
}

/** <html data-theme> o'zgarishini kuzatamiz — holat DOM bilan doim sinxron, hidratsiyada xato yo'q */
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** Tanlangan rejim fonini brauzer manzil paneliga ham beradi (<meta name="theme-color">) */
function syncThemeColorMeta() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (!bg) return;
  let metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  if (metas.length === 0) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    document.head.appendChild(m);
    metas = [m];
  }
  for (const m of metas) {
    // media (prefers-color-scheme) endi mos kelmaydi — rejim qo'lda tanlangan
    m.removeAttribute("media");
    m.setAttribute("content", bg);
  }
}

/** Tema almashtirgich — mobil va desktopda bir xil (yuqori panelda), 40px bosish maydoni */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  // Rejim o'zgarganda (shu jumladan boshqa toggle orqali) manzil paneli rangi ham mos bo'ladi
  useEffect(() => {
    syncThemeColorMeta();
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("redince-theme", next);
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={theme === "dark"}
      /* Barqaror nom + holat aria-checked orqali: nom va holat bir-biriga zid bo'lmasin */
      aria-label="Tungi rejim"
      title="Tungi rejim"
      className={cn("card card-hover flex h-10 w-10 shrink-0 items-center justify-center !rounded-full text-fg-2 hover:text-fg", className)}
    >
      <span className="relative h-[18px] w-[18px]">
        <Sun size={18} className={cn("absolute inset-0 transition-all duration-500", theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
        <Moon size={18} className={cn("absolute inset-0 transition-all duration-500", theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
      </span>
    </button>
  );
}

/** <head> ichida chaqiriladi: birinchi render'dan oldin rejimni o'rnatadi (flash bo'lmasligi uchun) */
export const THEME_INIT_SCRIPT = `
(function(){try{var t=localStorage.getItem('redince-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();
`.trim();
