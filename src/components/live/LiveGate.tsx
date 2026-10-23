"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, LogIn, ShieldAlert, Hourglass } from "lucide-react";

export type Gate = "code" | "waiting" | "denied";

/**
 * Efirga kirish darvozasi (Zoom naqshi):
 *  - `code`    — efir kodi so'raladi
 *  - `waiting` — kutish xonasi: boshlovchi ruxsatini kutadi (har 4 s qayta tekshiradi)
 *  - `denied`  — boshlovchi rad etdi
 * `onRetry(passcode)` tokenni qayta so'raydi; muvaffaqiyatli bo'lsa ota komponent xonani ko'rsatadi.
 */
export function LiveGate({ gate, title, busy, onRetry, onClose }: { gate: Gate; title: string; busy: boolean; onRetry: (passcode?: string) => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [dots, setDots] = useState(0);
  const retry = useRef(onRetry);
  retry.current = onRetry;

  // Kutish xonasida har 4 s holatni tekshiramiz
  useEffect(() => {
    if (gate !== "waiting") return;
    const t = window.setInterval(() => retry.current(), 4000);
    const d = window.setInterval(() => setDots((n) => (n + 1) % 4), 600);
    return () => {
      window.clearInterval(t);
      window.clearInterval(d);
    };
  }, [gate]);

  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-[380px] text-center">
        {gate === "code" ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10">
              <KeyRound size={24} />
            </span>
            <h2 className="mt-4 text-[18px] font-bold">Efir kodi</h2>
            <p className="mt-1 text-[13.5px] text-white/60">«{title}» efiri kod bilan himoyalangan. Boshlovchi bergan kodni kiriting.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) onRetry(code.trim());
              }}
              className="mt-5 flex gap-2"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12))}
                placeholder="Kod"
                aria-label="Efir kodi"
                autoFocus
                inputMode="text"
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-center text-[15px] font-semibold tracking-[0.2em] text-white outline-none placeholder:tracking-normal placeholder:text-white/40 focus:bg-white/15"
              />
              <button type="submit" disabled={busy || !code.trim()} className="btn-accent inline-flex h-11 shrink-0 items-center gap-1.5 px-4 text-[14px] disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} Kirish
              </button>
            </form>
          </>
        ) : gate === "waiting" ? (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10">
              <Hourglass size={24} className="text-[#ffcf40]" />
            </span>
            <h2 className="mt-4 text-[18px] font-bold">Kutish xonasidasiz</h2>
            <p className="mt-1 text-[13.5px] text-white/60">
              Boshlovchi sizni efirga qo&apos;shishini kutamiz{".".repeat(dots)}
            </p>
            <p className="mt-3 text-[12.5px] text-white/40">Sahifani yopmang — ruxsat berilishi bilan efir o&apos;zi ochiladi.</p>
          </>
        ) : (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger/20">
              <ShieldAlert size={24} className="text-danger" />
            </span>
            <h2 className="mt-4 text-[18px] font-bold">Efirga qo&apos;shilmadingiz</h2>
            <p className="mt-1 text-[13.5px] text-white/60">Boshlovchi so&apos;rovingizni rad etdi.</p>
          </>
        )}
        <button type="button" onClick={onClose} className="mt-6 h-10 rounded-full bg-white/10 px-5 text-[13.5px] font-semibold hover:bg-white/20">
          Yopish
        </button>
      </div>
    </div>
  );
}
