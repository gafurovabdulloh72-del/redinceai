import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Gift } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { launchGiftUntil } from "@/lib/subscriptions/launch-gift";

/**
 * Ishga tushirish aksiyasi e'loni (server komponent): aksiya faol bo'lsa — «1 yil Max bepul».
 * `mode="guest"` — ro'yxatdan o'tishga chaqiradi, `mode="owner"` — sovg'a olgan mutaxassisga holatni aytadi.
 */
export async function LaunchGiftBanner({ til, mode = "guest", giftedUntil }: { til: Locale; mode?: "guest" | "owner"; giftedUntil?: Date | null }) {
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const fmt = (d: Date) => formatDate(d, til === "ru" ? "ru" : "uz");
  if (mode === "owner") {
    if (!giftedUntil) return null;
    return (
      <div className="mt-6 flex items-center gap-3 rounded-[var(--r-md)] border border-accent/30 bg-accent-soft px-4 py-3">
        <Gift size={18} className="shrink-0 text-accent-text" />
        <p className="text-[13.5px] leading-snug text-fg">
          <b>{t("Sovg'a: Max tarifi bepul", "Подарок: тариф Max бесплатно")}</b> — {t(`${fmt(giftedUntil)} gacha. Hech narsa to'lash shart emas.`, `до ${fmt(giftedUntil)}. Ничего платить не нужно.`)}
        </p>
      </div>
    );
  }
  const until = await launchGiftUntil();
  if (until <= Date.now()) return null;
  return (
    <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-3 rounded-[var(--r-lg)] border border-accent/30 bg-accent-soft px-5 py-4 text-center sm:flex-row sm:text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white"><Gift size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-fg">{t("Ishga tushirish sovg'asi: 1 yil Max tarifi — bepul", "Подарок к запуску: тариф Max на 1 год — бесплатно")}</p>
        <p className="mt-0.5 text-[13px] text-fg-2">{t(`${fmt(new Date(until))} gacha mutaxassis sifatida ro'yxatdan o'tganlarning hammasiga.`, `Всем, кто зарегистрируется как специалист до ${fmt(new Date(until))}.`)}</p>
      </div>
      <Link href="/auth/royxat?role=specialist" className="btn-ink inline-flex h-10 shrink-0 items-center rounded-full px-5 text-[13.5px] font-semibold">
        {t("Ro'yxatdan o'tish", "Зарегистрироваться")}
      </Link>
    </div>
  );
}
