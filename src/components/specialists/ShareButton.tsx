"use client";

import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Joriy sahifa havolasini nusxalaydi (clipboard), bo'lmasa tizim "share" oynasini ochadi.
 * Nusxalangandan so'ng 2 soniya "Nusxalandi" holatini ko'rsatadi.
 */
export function ShareButton({
  title,
  url,
  className,
  size = "md",
  variant = "glass",
}: {
  title?: string;
  /** Berilmasa — window.location.href */
  url?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "ghost" | "tint-soft" | "outline";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const href = url ?? window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      return;
    } catch {
      /* clipboard mavjud emas — share'ga o'tamiz */
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: title ?? document.title, url: href });
        setCopied(true);
      }
    } catch {
      /* foydalanuvchi bekor qildi */
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={share}
      aria-live="polite"
      className={cn("min-w-[128px] transition-colors", copied && "!text-ios-green", className)}
    >
      {copied ? (
        <>
          <Check size={16} /> Nusxalandi
        </>
      ) : (
        <>
          <Share2 size={16} /> Ulashish
        </>
      )}
    </Button>
  );
}
