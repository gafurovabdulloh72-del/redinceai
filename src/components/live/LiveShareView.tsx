"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Lock, PlayCircle, RadioTower, Ticket } from "lucide-react";
import type { LiveShareInfo } from "@/lib/live/share";
import { AvatarImage } from "@/components/ui/AvatarImage";
import { ShareButton } from "@/components/specialists/ShareButton";
import { BuyButton } from "@/components/mentorship/PurchaseDialog";
import { LiveRoomOverlay } from "./LiveRoom";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Efir ulashish sahifasining ko'rinishi: kim/nima/holat + bitta asosiy harakat.
 * Kirgan va kirish huquqi bor ko'ruvchida efir oynasi AVTOMATIK ochiladi (havolani bosgan odam darhol efirga tushadi).
 */
export function LiveShareView({ info, loggedIn, shareUrl, ru }: { info: LiveShareInfo; loggedIn: boolean; shareUrl: string; ru: boolean }) {
  const t = (uz: string, r: string) => (ru ? r : uz);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);
  const live = info.status === "live";
  const enabled = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const canWatch = live && loggedIn && info.access && enabled;

  useEffect(() => {
    if (canWatch && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [canWatch]);

  // Efir tugashini kutayotgan sahifa: 30 s da bir holatni yangilaydi (tab ko'rinib turganda)
  useEffect(() => {
    if (!live || open) return;
    const timer = setInterval(() => document.visibilityState === "visible" && router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [live, open, router]);

  const loginHref = `/auth/kirish?next=${encodeURIComponent(`/efir/${info.id}`)}`;
  const priceLabel = `${info.price.toLocaleString("ru-RU")} ${t("so'm", "сум")}`;

  return (
    <div className="container-x py-6 sm:py-10">
      <div className="mx-auto max-w-[560px]">
        <a href={info.homeHref} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg">
          <ArrowLeft size={15} /> {info.group.name}
        </a>

        <section className={cn("card overflow-hidden", live && "border-danger/40")} aria-labelledby="efir-title">
          <div className="relative aspect-[16/9] w-full bg-black">
            {info.group.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.group.coverUrl} alt="" className="h-full w-full object-cover opacity-70" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/40">
                <RadioTower size={56} strokeWidth={1.4} />
              </div>
            )}
            <span
              className={cn(
                "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wider",
                live ? "bg-danger text-white" : "bg-black/60 text-white/85",
              )}
            >
              {live && <span className="h-1.5 w-1.5 animate-ping-soft rounded-full bg-white" />}
              {live ? t("Jonli", "В эфире") : t("Tugagan", "Завершён")}
            </span>
            {info.price > 0 && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-bold text-white">
                <Ticket size={12} /> {priceLabel}
              </span>
            )}
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              {info.host.avatarUrl ? (
                <AvatarImage src={info.host.avatarUrl} size={44} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-full bg-fg/8 text-[15px] font-bold text-fg-2">{info.host.name.slice(0, 1).toUpperCase()}</span>
              )}
              <div className="min-w-0">
                <h1 id="efir-title" className="truncate text-[18px] font-bold text-fg" data-no-auto>
                  {info.title}
                </h1>
                <p className="truncate text-[13px] text-fg-3">
                  <span data-no-auto>{info.host.name}</span>
                  {info.group.name.trim().toLowerCase() !== info.host.name.trim().toLowerCase() && <span data-no-auto> · {info.group.name}</span>}
                </p>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
              <CalendarClock size={14} />
              {live
                ? `${t("Boshlandi", "Начался")}: ${formatDateTime(info.startedAt, ru ? "ru" : "uz")}`
                : `${t("Bo'lib o'tdi", "Прошёл")}: ${formatDateTime(info.endedAt ?? info.startedAt, ru ? "ru" : "uz")}`}
            </p>

            {info.gated && live && (
              <p className="flex items-center gap-1.5 rounded-[10px] bg-fg/5 px-3 py-2 text-[12.5px] text-fg-2">
                <Lock size={13} /> {t("Kirishda kod yoki boshlovchi ruxsati so'raladi", "При входе потребуется код или одобрение ведущего")}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {live ? (
                !enabled ? (
                  <p className="text-[13px] text-fg-3">{t("Jonli efir hozircha sozlanmagan", "Прямые эфиры пока не настроены")}</p>
                ) : !loggedIn ? (
                  <a href={loginHref} className="btn-accent inline-flex h-11 flex-1 items-center justify-center px-5 text-[14px] font-semibold">
                    {t("Kirib, efirga qo'shilish", "Войти и присоединиться")}
                  </a>
                ) : !info.access ? (
                  <div className="flex-1">
                    <BuyButton type="ticket" id={info.id} loggedIn className="btn-accent inline-flex h-11 w-full items-center justify-center gap-1.5 px-5 text-[14px] font-semibold">
                      🎟 {t("Chipta", "Билет")} — {priceLabel}
                    </BuyButton>
                  </div>
                ) : (
                  <button type="button" onClick={() => setOpen(true)} className="btn-accent inline-flex h-11 flex-1 items-center justify-center gap-1.5 px-5 text-[14px] font-semibold">
                    <PlayCircle size={17} /> {info.isHost ? t("Efirga qaytish", "Вернуться в эфир") : t("Tomosha qilish", "Смотреть")}
                  </button>
                )
              ) : info.hasRecording ? (
                <a href={info.homeHref} className="btn-accent inline-flex h-11 flex-1 items-center justify-center gap-1.5 px-5 text-[14px] font-semibold">
                  <PlayCircle size={17} /> {t("Yozuvni ko'rish", "Смотреть запись")}
                </a>
              ) : (
                <a href={info.homeHref} className="btn-accent inline-flex h-11 flex-1 items-center justify-center px-5 text-[14px] font-semibold">
                  {t("Sahifaga o'tish", "Перейти на страницу")}
                </a>
              )}
              <ShareButton title={info.title} url={shareUrl} size="lg" variant="outline" iconOnly />
            </div>
          </div>
        </section>
      </div>

      {open && (
        <LiveRoomOverlay
          streamId={info.id}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
