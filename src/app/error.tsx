"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink, IconTile } from "@/components/ui";

/** Sahifa darajasidagi xatolik — Studio uslubida, o'zbekcha, qayta urinish bilan */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page-error]", error);
  }, [error]);

  return (
    <div className="container-x">
      <div className="card-outline relative mx-auto flex max-w-3xl flex-col items-center overflow-hidden !rounded-card-lg px-6 py-16 text-center sm:px-12 sm:py-20">
        <span className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-[90px]" />
        <IconTile icon={TriangleAlert} tone="soft" size="lg" className="relative mb-6" />
        <span className="eyebrow relative">Xatolik</span>
        <h1 className="display-xl relative mt-5 text-[32px] text-fg sm:text-[44px]">
          Nimadir <span className="accent-serif text-accent">xato</span> ketdi
        </h1>
        <p className="relative mt-4 max-w-md text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
          Sahifani yuklab bo'lmadi. Bu vaqtinchalik bo'lishi mumkin — qayta urinib ko'ring yoki bosh sahifaga qayting.
        </p>
        {error.digest && <p className="relative mt-2 text-[12px] text-fg-3">Kod: {error.digest}</p>}
        <div className="relative mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button variant="accent" size="lg" onClick={reset} className="w-full sm:w-auto sm:min-w-[190px]">
            <RotateCcw size={16} /> Qayta urinish
          </Button>
          <ButtonLink href="/" variant="outline" size="lg" className="w-full sm:w-auto">
            Bosh sahifaga <ArrowRight size={16} />
          </ButtonLink>
        </div>
        <Link href="/mutaxassislar" className="relative mt-6 inline-flex min-h-10 items-center text-[13px] text-fg-3 transition hover:text-fg">
          Mutaxassislar ro'yxatiga o'tish
        </Link>
      </div>
    </div>
  );
}
