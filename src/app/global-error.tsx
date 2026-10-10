"use client";

import "./globals.css";

/**
 * Ildiz layout ham ishlamay qolgan holat uchun. Tokenlar globals.css'dan,
 * shriftlar bu yerda bo'lmasligi mumkin — tizim shriftlari ishlatiladi.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <main className="container-x flex min-h-dvh items-center justify-center py-16">
          <div className="card-outline w-full max-w-xl !rounded-[32px] px-6 py-14 text-center sm:px-12">
            <span className="eyebrow">Xatolik</span>
            <h1 className="display-xl mt-5 text-[32px] sm:text-[40px]">Xatolik yuz berdi</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-2">Ilovani yuklab bo'lmadi. Qayta urinib ko'ring — bo'lmasa, biroz kutib sahifani yangilang.</p>
            {error.digest && <p className="mt-2 text-[12px] text-fg-4">Kod: {error.digest}</p>}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="btn-accent inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-semibold">
                Qayta urinish
              </button>
              <a href="/" className="inline-flex h-12 items-center justify-center rounded-full border border-line-2 px-7 text-[15px] font-semibold text-fg">
                Bosh sahifaga
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
