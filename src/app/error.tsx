"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink, IconTile } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";

/** Sahifa darajasidagi xatolik — Studio uslubida, o'zbekcha, qayta urinish bilan */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const til = useLocale();
  useEffect(() => {
    console.error("[page-error]", error);
  }, [error]);

  return (
    <div className="container-x">
      <div className="card-outline relative mx-auto flex max-w-3xl flex-col items-center overflow-hidden !rounded-card-lg px-6 py-16 text-center sm:px-12 sm:py-20">
        <span className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-[90px]" />
        <IconTile icon={TriangleAlert} tone="soft" size="lg" className="relative mb-6" />
        <span className="eyebrow relative">{tr(til, SHELL.error.eyebrow)}</span>
        <h1 className="display-xl relative mt-5 text-[32px] text-fg sm:text-[44px]">
          {tr(til, SHELL.error.titleA)}
          <span className="accent-serif text-accent">{tr(til, SHELL.error.titleAccent)}</span>
          {tr(til, SHELL.error.titleB)}
        </h1>
        <p className="relative mt-4 max-w-md text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">{tr(til, SHELL.error.text)}</p>
        {error.digest && <p className="relative mt-2 text-[12px] text-fg-3">{tr(til, SHELL.error.code)}: {error.digest}</p>}
        <div className="relative mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button variant="accent" size="lg" onClick={reset} className="w-full sm:w-auto sm:min-w-[190px]">
            <RotateCcw size={16} /> {tr(til, SHELL.error.retry)}
          </Button>
          <ButtonLink href="/" variant="outline" size="lg" className="w-full sm:w-auto">
            {tr(til, SHELL.error.homeBtn)} <ArrowRight size={16} />
          </ButtonLink>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] text-fg-3">
          <Link href="/mutaxassislar" className="inline-flex min-h-10 items-center transition hover:text-fg">
            {tr(til, SHELL.error.specialistsList)}
          </Link>
          <Link href="/xarita" className="inline-flex min-h-10 items-center transition hover:text-fg">
            {tr(til, SHELL.error.interactiveMap)}
          </Link>
        </div>
      </div>
    </div>
  );
}
