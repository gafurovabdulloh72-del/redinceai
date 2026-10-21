"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** /kabinet/menyu faqat telefon sahifasi (ro'yxat KabinetNav'da). Keng ekranda yon panel bor — umumiy sahifaga o'tkazamiz. */
export function MenuRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) router.replace("/kabinet");
  }, [router]);
  return null;
}
