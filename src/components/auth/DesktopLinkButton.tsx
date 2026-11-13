"use client";

import { useState } from "react";
import { Loader2, MonitorSmartphone } from "lucide-react";

/** «Ilovaga qaytish»: bir martalik kod olib `kasbegalari://` havolasini ochadi (ilova o'zi sessiyaga almashtiradi) */
export function DesktopLinkButton({ challenge, til }: { challenge: string; til: "uz" | "ru" }) {
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [href, setHref] = useState<string | null>(null);

  async function go() {
    setState("busy");
    try {
      const r = await fetch("/api/auth/ilova", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: { url: string } } | null;
      if (!r.ok || !j?.data?.url) throw new Error();
      setHref(j.data.url);
      setState("sent");
      window.location.href = j.data.url;
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={() => void go()} disabled={state === "busy"} className="btn-ink press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-60">
        {state === "busy" ? <Loader2 size={17} className="animate-spin" /> : <MonitorSmartphone size={17} />}
        {t("Ilovaga qaytish", "Вернуться в приложение")}
      </button>
      {state === "sent" && href && (
        <p className="mt-3 text-[13px] text-fg-3">
          {t("Ilova ochilmadimi?", "Приложение не открылось?")}{" "}
          <a href={href} className="font-semibold text-fg underline">
            {t("Qayta urinish", "Попробовать снова")}
          </a>
          <br />
          {t("Endi bu tabni yopishingiz mumkin.", "Теперь эту вкладку можно закрыть.")}
        </p>
      )}
      {state === "error" && <p className="mt-3 text-[13px] text-danger-text">{t("Xatolik. Ilovada qaytadan boshlang.", "Ошибка. Начните заново в приложении.")}</p>}
    </div>
  );
}
