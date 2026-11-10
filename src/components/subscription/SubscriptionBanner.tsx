import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock3, EyeOff } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { SubscriptionStatusKey } from "@/lib/subscriptions/labels";

/** Shu kundan kam qolsa — banner chiqadi (trial/active) */
export const BANNER_DAYS = 7;

export interface SubscriptionBannerProps {
  status: SubscriptionStatusKey;
  /** Obuna/sinov tugash sanasi (subscriptionState().until) */
  until: Date | number;
  daysLeft: number;
  /** Imtiyozli muddat oxiri (ixtiyoriy — grace'da aniq sana ko'rsatish uchun) */
  graceUntil?: Date | number;
  /** Ha bo'lsa — CTA ko'rsatilmaydi (masalan, /kabinet/obuna sahifasining o'zida) */
  hideCta?: boolean;
  className?: string;
  /** Til (standart uz) — banner matnlari ikki tilda */
  til?: "uz" | "ru";
}

/** Banner ko'rsatilishi kerakmi: sinov/muhlat/tugagan yoki ≤ 7 kun qolgan; talab o'chiq (off) bo'lsa — yo'q */
export function shouldShowSubscriptionBanner(status: SubscriptionStatusKey, daysLeft: number): boolean {
  if (status === "off") return false;
  if (status === "grace" || status === "expired") return true;
  if (status === "trial") return true;
  return daysLeft <= BANNER_DAYS;
}

/**
 * Kabinetdagi obuna ogohlantirishi (server komponent — "use client" yo'q, holat props orqali keladi).
 * Holatni hisoblash — subscriptions/access.ts subscriptionState(); bu komponent faqat ko'rsatadi:
 *  trial (> 7 kun)         — ma'lumot (ko'k): "Bepul sinov: N kun qoldi"
 *  trial / active (≤ 7 kun) — sariq: "N kun qoldi"
 *  grace                    — sariq: "Muhlat: N kun ichida to'lang"
 *  expired                  — qizil: "Profil katalogdan yashirilgan"
 * Mount (kabinet/layout.tsx):
 *   const st = subscriptionState(user.specialist, settings);
 *   <SubscriptionBanner status={st.status} until={st.until} daysLeft={st.daysLeft} graceUntil={st.graceUntil} />
 */
export function SubscriptionBanner({ status, until, daysLeft, graceUntil, hideCta, className, til = "uz" }: SubscriptionBannerProps) {
  if (!shouldShowSubscriptionBanner(status, daysLeft)) return null;
  const expired = status === "expired";
  // Sinovning boshida (7 kundan ko'p qolgan) — shoshilinch emas: ma'lumot ohangi; qolganlari sariq/qizil
  const calm = status === "trial" && daysLeft > BANNER_DAYS;
  const Icon = expired ? EyeOff : status === "grace" ? AlertTriangle : Clock3;
  const ru = til === "ru";
  const days = ru ? `${daysLeft} дн.` : `${daysLeft} kun`;
  const date = (d: Date | number) => formatDate(d, ru ? "ru" : "uz");

  const title = ru
    ? status === "expired"
      ? "Подписка неактивна — профиль не виден в каталоге"
      : status === "grace"
        ? `Подписка закончилась — оплатите в течение ${days}`
        : status === "trial"
          ? daysLeft <= 0
            ? "Бесплатный пробный период заканчивается сегодня"
            : `Бесплатный пробный период: осталось ${days}`
          : daysLeft <= 0
            ? "Подписка заканчивается сегодня"
            : `До конца подписки осталось ${days}`
    : status === "expired"
      ? "Obuna faol emas — profilingiz katalogda ko'rinmaydi"
      : status === "grace"
        ? `Obuna tugadi — ${days} ichida to'lang`
        : status === "trial"
          ? daysLeft <= 0
            ? "Bepul sinov muddati bugun tugaydi"
            : `Bepul sinov muddati: ${days} qoldi`
          : daysLeft <= 0
            ? "Obuna bugun tugaydi"
            : `Obuna tugashiga ${days} qoldi`;

  const body = ru
    ? status === "expired"
      ? "Клиенты не найдут вас в списке и на карте, контакты закрыты, новые заказы и отклики приостановлены. Текущие заказы продолжаются."
      : status === "grace"
        ? `Льготный период ${graceUntil ? `до ${date(graceUntil)}` : "скоро закончится"} — затем профиль скроется из каталога и новые заказы остановятся.`
        : status === "trial"
          ? `Пробный период заканчивается ${date(until)}. Чтобы остаться в каталоге и на карте, активируйте подписку заранее — оставшиеся бесплатные дни не пропадут.`
          : `Подписка заканчивается ${date(until)}. Чтобы остаться в каталоге и на карте, продлите её заранее.`
    : status === "expired"
      ? "Mijozlar sizni ro'yxat va xaritada topa olmaydi, aloqa ma'lumotlaringiz yopiq, yangi buyurtma va takliflar to'xtatilgan. Mavjud buyurtmalar davom etadi."
      : status === "grace"
        ? `Imtiyozli muddat ${graceUntil ? `${date(graceUntil)} gacha` : "tugagach"} — keyin profil katalogdan yashiriladi va yangi buyurtmalar to'xtaydi.`
        : status === "trial"
          ? `Sinov ${date(until)} da tugaydi. Keyin ham katalog va xaritada qolish uchun obunani oldindan faollashtiring — qolgan bepul kunlar yo'qolmaydi.`
          : `Obuna ${date(until)} da tugaydi. Katalog va xaritada qolish uchun obunani oldindan uzaytiring.`;

  return (
    <div
      role={expired ? "alert" : "status"}
      // data-sub-banner: kabinet qobig'idagi ixcham eslatma (pill) shu to'liq banner bor sahifada takrorlanmaydi (globals.css)
      data-sub-banner
      data-no-auto
      className={cn(
        "mb-5 flex flex-col gap-3 rounded-[var(--r-md)] border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        expired ? "border-danger/30 bg-danger-soft" : calm ? "border-info/25 bg-info-soft" : "border-warning/30 bg-warning-soft",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon size={20} aria-hidden="true" className={cn("mt-0.5 shrink-0", expired ? "text-danger-text" : calm ? "text-info-text" : "text-warning-text")} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-2">{body}</p>
        </div>
      </div>
      {!hideCta && (
        <Link
          href="/kabinet/obuna#rejalar"
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-full px-4 text-[13px] font-semibold sm:self-auto",
            expired ? "btn-accent" : calm ? "border border-line-2 bg-surface text-fg hover:border-fg" : "btn-ink",
          )}
        >
          {status === "trial" ? (ru ? "Активировать подписку" : "Obunani faollashtirish") : ru ? "Продлить подписку" : "Obunani uzaytirish"} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
