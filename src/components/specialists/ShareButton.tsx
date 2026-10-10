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
  variant = "outline",
  iconOnly = false,
}: {
  title?: string;
  /** Berilmasa — window.location.href */
  url?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "ghost" | "tint-soft" | "outline";
  /** Faqat ikonka (CTA yonidagi kvadrat tugma) */
  iconOnly?: boolean;
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
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: title ?? document.title, url: href });
        setCopied(true);
        return;
      }
    } catch {
      /* foydalanuvchi bekor qildi — nusxalashga o'tamiz */
    }
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      /* clipboard mavjud emas */
    }
  };

  const sizeCls = size === "lg" ? "h-13 w-13" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      onClick={share}
      aria-live="polite"
      aria-label={iconOnly ? (copied ? "Havola nusxalandi" : "Ulashish") : undefined}
      title={iconOnly ? "Ulashish" : undefined}
      className={cn("transition-colors", iconOnly ? cn("shrink-0 !p-0", sizeCls) : "min-w-[128px]", copied && "!text-[#15803d] dark:!text-ios-green", className)}
    >
      {copied ? (
        <>
          <Check size={16} /> {!iconOnly && "Nusxalandi"}
        </>
      ) : (
        <>
          <Share2 size={16} /> {!iconOnly && "Ulashish"}
        </>
      )}
    </Button>
  );
}
