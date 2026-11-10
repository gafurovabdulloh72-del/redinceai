"use client";

import { memo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { AlertCircle, Check, CheckCheck, Clock3, CornerUpLeft, Forward, MoreHorizontal, Pin, RotateCcw, Timer, Trash2 } from "lucide-react";
import { CallBubble } from "@/components/call/CallBubble";
import { haptic } from "@/components/motion/haptics";
import { DM_DELETED_TEXT } from "@/lib/chat/constants";
import { firstLink } from "@/lib/chat/text";
import { clock, fullStamp } from "@/lib/chat/time";
import type { Locale } from "@/lib/i18n";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn } from "@/lib/utils";
import type { Msg } from "./chat-types";
import type { LayerAnchor } from "./DmPanels";
import { AttachmentList, DayPill, LinkCard, Linkified, QuoteBlock, ReactionChips, useLongPress } from "./MessageParts";

export interface DmBubbleProps {
  m: Msg;
  locale: Locale;
  convId: string;
  peerName: string;
  /** Yangi kun boshlansa — kun yorlig'i («Bugun», «Kecha», sana); aks holda null */
  day: string | null;
  /** Shu xabar ustida «Yangi xabarlar» chizig'i */
  divider: boolean;
  /** Oldingi xabar ham shu tomondan (zich oraliq) */
  joined: boolean;
  /** Ketma-ket xabarlar guruhining oxirgisi — «dum» shu pufakchada */
  tail: boolean;
  /** Suhbatdosh o'qigan (✓✓) */
  read: boolean;
  pinned: boolean;
  menuOpen: boolean;
  /** Jonli kelgan xabar — kirish animatsiyasi bilan */
  fresh: boolean;
  onMenu: (m: Msg, anchor: LayerAnchor) => void;
  onReact: (m: Msg, emoji: string) => void;
  onJump: (id: string) => void;
  onReply: (m: Msg) => void;
  onRetry: (m: Msg) => void;
  onDrop: (m: Msg) => void;
}

const SWIPE_REPLY = 56;

/**
 * Shaxsiy suhbatdagi bitta xabar — Telegram pufakchasi (guruh chati bilan bir xil ko'rinish: `tg-bubble` / `tg-bubble-out`,
 * guruh oxirida «dum», vaqt va ✓ / ✓✓ pufakcha ichida o'ng pastda). `memo` — yozish maydoniga har harf kiritilganda yoki
 * polling kelganda o'zgarmagan xabarlar qayta chizilmaydi.
 *
 *  - menyu: sichqonchada hover'dagi «⋯» yoki o'ng tugma, sensorli ekranda BOSIB TURISH (menyu `Layer` — barmoq
 *    ko'tarilguncha bandlar bosilmaydi, QA A17); o'ngga surish — javob berish;
 *  - yuborilmagan xabar: sabab va «Qayta» / «O'chirish» pufakcha OSTIDA (marjon fon ustida qizil matn ko'rinmasdi);
 *  - «Xabar o'chirildi» belgisi ham menyuga ega (faqat «Men uchun o'chirish» — QA A22).
 */
export const DmBubble = memo(function DmBubble(p: DmBubbleProps) {
  const { m, locale } = p;
  const t = (k: ChatKey, v?: Record<string, string | number>) => chatT(locale, k, v);
  const press = useLongPress();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const dxRef = useRef(0);

  const live = !m.deleted && !m.pending;
  // Yuborilayotgan xabarda menyu yo'q; yuborilmagan va o'chirilgan belgida — bor (olib tashlash uchun)
  const menuable = m.pending !== "sending";
  const url = live && !m.call && m.body ? firstLink(m.body) : null;
  const edited = Boolean(m.editedAt) && !m.deleted;
  // Vaqt pufakcha ichida, matnning oxirgi qatori bilan bir chiziqda (matn oxirida shu kenglikda joy qoldiriladi)
  const inlineMeta = Boolean(m.body) && !m.deleted && !m.call && !url;
  const spacer = 40 + (m.mine ? 20 : 0) + (edited ? (locale === "ru" ? 62 : 78) : 0) + (m.expiresAt ? 15 : 0) + (p.pinned ? 14 : 0);

  const swipeHandlers = live
    ? {
        onTouchStart: (e: ReactTouchEvent) => {
          const t0 = e.touches[0];
          start.current = { x: t0.clientX, y: t0.clientY, locked: null };
        },
        onTouchMove: (e: ReactTouchEvent) => {
          const st = start.current;
          if (!st) return;
          const t0 = e.touches[0];
          const mx = t0.clientX - st.x;
          const my = t0.clientY - st.y;
          if (st.locked === null) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            st.locked = Math.abs(mx) > Math.abs(my) && mx > 0; // faqat o'ngga gorizontal
          }
          if (!st.locked) return;
          dxRef.current = Math.min(80, Math.max(0, mx * 0.7));
          setDx(dxRef.current);
        },
        onTouchEnd: () => {
          const st = start.current;
          start.current = null;
          if (st?.locked && dxRef.current >= SWIPE_REPLY) {
            haptic("light");
            p.onReply(m);
          }
          dxRef.current = 0;
          setDx(0);
        },
        onTouchCancel: () => {
          start.current = null;
          dxRef.current = 0;
          setDx(0);
        },
      }
    : {};

  const meta = (
    <span className={cn("flex items-center justify-end gap-1 text-[11px] tabular-nums", inlineMeta ? "absolute bottom-1 right-2.5" : "mt-0.5 px-1", m.mine ? "text-ink-fg/80" : "text-fg-4")}>
      {p.pinned && <Pin size={10} aria-label={t("pinned")} />}
      {m.expiresAt ? (
        <span className="inline-flex" title={`${t("ttlMsg")} · ${fullStamp(m.expiresAt, locale)}`}>
          <Timer size={11} aria-label={t("ttlMsg")} />
        </span>
      ) : null}
      {edited && <span title={m.editedAt ? fullStamp(m.editedAt, locale) : undefined}>{t("edited")}</span>}
      <time dateTime={new Date(m.at).toISOString()} title={fullStamp(m.at, locale)}>
        {clock(m.at)}
      </time>
      {m.mine &&
        !m.deleted &&
        (m.pending === "sending" ? (
          <Clock3 size={13} aria-label={t("sending")} />
        ) : m.pending === "failed" ? (
          <AlertCircle size={13} aria-label={t("failed")} />
        ) : p.read ? (
          <CheckCheck size={15} strokeWidth={2.4} className="text-white" aria-label={t("read")} />
        ) : (
          <Check size={15} strokeWidth={2.4} aria-label={t("sent")} />
        ))}
    </span>
  );

  return (
    <div data-msg-id={m.pending ? undefined : m.id} className={cn(p.fresh && "animate-msg-in", p.joined ? "mt-0.5" : "mt-2.5")}>
      {p.day && <DayPill label={p.day} tg />}
      {p.divider && (
        <div id={`divider-${m.id}`} className="my-2 flex items-center gap-2" role="separator" aria-label={t("newMessages")}>
          <span className="h-px flex-1 bg-accent/40" />
          <span className="tg-bubble rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-text shadow-sm">{t("newMessages")}</span>
          <span className="h-px flex-1 bg-accent/40" />
        </div>
      )}
      <div {...swipeHandlers} style={dx ? { transform: `translateX(${dx}px)`, transition: "none" } : undefined} className={cn("group relative flex items-end gap-1.5 transition-transform duration-200", m.mine ? "justify-end" : "justify-start")}>
        {dx > 0 && (
          <span aria-hidden className="pointer-events-none absolute -left-10 top-1/2 grid h-8 w-8 place-items-center rounded-full bg-fg/10 text-fg" style={{ opacity: Math.min(1, dx / SWIPE_REPLY), transform: `translateY(-50%) scale(${dx >= SWIPE_REPLY ? 1 : 0.8})` }}>
            <CornerUpLeft size={15} />
          </span>
        )}
        <div className={cn("flex min-w-0 max-w-[min(82%,520px)] flex-col", m.mine ? "items-end" : "items-start")}>
          <div
            id={`msg-${m.id}`}
            {...(menuable ? press((pt) => p.onMenu(m, pt)) : {})}
            onContextMenu={(e) => {
              if (!menuable) return;
              e.preventDefault();
              p.onMenu(m, { x: e.clientX, y: e.clientY });
            }}
            className={cn(
              "relative max-w-full rounded-[16px] px-2.5 pb-1.5 pt-1.5 shadow-sm transition-shadow [-webkit-touch-callout:none] [@media(hover:none)]:select-none",
              m.mine ? "tg-bubble-out text-ink-fg" : "tg-bubble text-fg",
              p.tail && (m.mine ? "tg-tail-out rounded-br-[4px]" : "tg-tail-in rounded-bl-[4px]"),
              (m.deleted || m.pending === "failed") && "opacity-75",
            )}
          >
            {m.forwardedFrom && !m.deleted && (
              <p className={cn("mb-0.5 flex min-w-0 items-center gap-1 px-1 text-[11.5px] font-semibold", m.mine ? "text-ink-fg/85" : "text-accent-text")}>
                <Forward size={11} className="shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {t("forwarded")}: <span data-no-auto>{m.forwardedFrom}</span>
                </span>
              </p>
            )}
            {m.replyTo && !m.deleted && <QuoteBlock q={m.replyTo} mine={m.mine} onJump={p.onJump} locale={locale} />}
            {m.deleted ? (
              <p className={cn("flex items-center gap-1.5 px-1 text-[13px] italic", m.mine ? "text-ink-fg/80" : "text-fg-3")}>
                <Trash2 size={12} aria-hidden="true" /> {DM_DELETED_TEXT[locale]}
              </p>
            ) : (
              <>
                <AttachmentList attachments={m.attachments} mine={m.mine} locale={locale} />
                {m.call ? (
                  <CallBubble call={m.call} mine={m.mine} conversationId={p.convId} peerName={p.peerName} />
                ) : (
                  m.body && (
                    <p className="whitespace-pre-wrap px-1 text-[14.5px] leading-[1.4] [overflow-wrap:anywhere]">
                      <Linkified text={m.body} mine={m.mine} />
                      {inlineMeta && <span aria-hidden className="inline-block h-px align-bottom" style={{ width: spacer }} />}
                    </p>
                  )
                )}
                {url && <LinkCard url={url} mine={m.mine} />}
              </>
            )}
            {meta}
          </div>
          {m.pending === "failed" && (
            <p className="mt-0.5 flex max-w-full flex-wrap items-center justify-end gap-x-1 px-1 text-[12px] font-medium text-danger-text" role="alert">
              <span className="inline-flex min-w-0 items-center gap-1 py-1 [overflow-wrap:anywhere]">
                <AlertCircle size={12} className="shrink-0" aria-hidden="true" /> {m.error || t("failed")}
              </span>
              <span className="inline-flex shrink-0 items-center">
                <button type="button" onClick={() => p.onRetry(m)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 font-semibold underline underline-offset-2 transition hover:bg-danger-soft lg:min-h-8">
                  <RotateCcw size={11} aria-hidden="true" /> {t("retry")}
                </button>
                <button type="button" onClick={() => p.onDrop(m)} className="inline-flex min-h-10 items-center rounded-full px-2.5 font-semibold underline underline-offset-2 transition hover:bg-danger-soft lg:min-h-8">
                  {t("remove")}
                </button>
              </span>
            </p>
          )}
          {live && <ReactionChips reactions={m.reactions ?? []} mine={m.mine} overlap={false} onToggle={(e) => p.onReact(m, e)} />}
        </div>

        {/* «⋯» — sichqonchada hover; sensorli ekranda menyu pufakchani bosib turish bilan ochiladi */}
        {menuable && (
          <button
            type="button"
            aria-label={t("msgMenu")}
            aria-haspopup="menu"
            aria-expanded={p.menuOpen}
            onClick={(e) => p.onMenu(m, e.currentTarget)}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg group-hover:opacity-100 [@media(hover:none)]:hidden",
              m.mine && "order-first",
              p.menuOpen ? "opacity-100" : "opacity-0",
            )}
          >
            <MoreHorizontal size={15} />
          </button>
        )}
      </div>
    </div>
  );
});
