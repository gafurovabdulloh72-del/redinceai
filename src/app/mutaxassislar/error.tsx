"use client";

import { SectionError } from "@/components/layout/SectionError";

/** Shu bo'lim ichidagi xato qobiqni (yon panel/tablar) buzmaydi — faqat kontent o'rnida karta */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError {...props} title="Mutaxassislar ochilmadi" />;
}
