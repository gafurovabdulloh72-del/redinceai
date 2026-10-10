"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.dataset.theme as Theme) || "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => setTheme(readTheme()), []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("redince-theme", next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Yorug' rejim" : "Qorong'u rejim"}
      className={cn(
        "glass glass-pill glass-hover flex h-10 w-10 items-center justify-center text-fg-2 hover:text-fg",
        className,
      )}
    >
      <span className="relative h-4.5 w-4.5">
        <Sun
          size={18}
          className={cn("absolute inset-0 transition-all duration-500", theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")}
        />
        <Moon
          size={18}
          className={cn("absolute inset-0 transition-all duration-500", theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")}
        />
      </span>
    </button>
  );
}

/** <head> ichida chaqiriladi: birinchi render'dan oldin rejimni o'rnatadi (flash bo'lmasligi uchun) */
export const THEME_INIT_SCRIPT = `
(function(){try{var t=localStorage.getItem('redince-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();
`.trim();
