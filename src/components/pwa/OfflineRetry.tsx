"use client";

import { useEffect, useState } from "react";
import { RotateCw, Wifi } from "lucide-react";

/**
 * Oflayn sahifa: aloqa tiklanganda (online hodisasi) avtomatik qaytadi — oldingi sahifaga (tarix bo'lsa) yoki bosh sahifaga.
 * Tugma JS'siz ham ishlaydi (GET forma); bu komponent faqat qo'shimcha: holat matni + avtomatik urinish.
 */
export function OfflineRetry() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const back = () => {
      setOnline(true);
      window.setTimeout(() => {
        if (window.history.length > 1) window.history.back();
        else window.location.replace("/");
      }, 900);
    };
    const gone = () => setOnline(false);
    window.addEventListener("online", back);
    window.addEventListener("offline", gone);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", gone);
    };
  }, []);

  return (
    <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto">
      <form method="get" className="w-full sm:w-auto">
        <button type="submit" className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold sm:w-auto">
          <RotateCw size={17} /> Qayta urinish
        </button>
      </form>
      <p role="status" aria-live="polite" className="inline-flex min-h-5 items-center gap-1.5 text-[12.5px] text-fg-3">
        {online === true ? (
          <>
            <Wifi size={13} className="text-success" /> Aloqa tiklandi — qaytilmoqda…
          </>
        ) : online === false ? (
          "Aloqa tiklanishi bilan avtomatik qaytamiz."
        ) : null}
      </p>
    </div>
  );
}
