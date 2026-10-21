"use client";

import { ArrowDownLeft, ArrowUpRight, Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { callLabel, humanDuration, type CallInfo } from "@/lib/call/format";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * Chatdagi qo'ng'iroq yozuvi (Telegram uslubi):
 *   [ikonka]  Chiquvchi video qo'ng'iroq
 *             ↗ 14:02 – 14:05 · 3 daq 25 s
 *             [ Qayta chaqirish ]
 * Javobsiz/rad etilgan — qizil. Qayta chaqirish `kasb:call-start` hodisasi orqali (CallCenter tinglaydi).
 */
export function CallBubble({ call, mine, conversationId, peerName }: { call: CallInfo; mine: boolean; conversationId: string; peerName: string }) {
  const l = callLabel(call, mine);
  const Dir = l.outgoing ? ArrowUpRight : ArrowDownLeft;
  const Icon = call.video ? Video : Phone;
  const answered = call.status === "ended";

  const redial = () => {
    window.dispatchEvent(new CustomEvent("kasb:call-start", { detail: { conversationId, name: peerName, video: call.video } }));
  };

  return (
    <div className="flex min-w-[210px] flex-col gap-2.5 py-0.5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full",
            l.bad ? "bg-danger/15 text-danger" : mine ? "bg-white/15 text-ink-fg" : "bg-success/15 text-success",
          )}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className={cn("text-[14.5px] font-semibold leading-tight", l.bad && "text-danger")}>{l.title}</p>
          <p className={cn("mt-1 flex flex-wrap items-center gap-x-1 text-[12px] leading-snug", mine ? "text-ink-fg/65" : "text-fg-3")}>
            <Dir size={13} className={cn("shrink-0", l.bad ? "text-danger" : answered ? "text-success" : "")} aria-hidden="true" />
            {answered ? (
              <>
                <span className="tabular-nums">
                  {clock(call.startedAt)} – {clock(call.endedAt)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium tabular-nums">{humanDuration(call.durationSec)}</span>
              </>
            ) : (
              <span className="tabular-nums">{clock(call.startedAt)}</span>
            )}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={redial}
        className={cn(
          "flex h-10 items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold transition active:scale-[0.98]",
          mine ? "bg-white/12 text-ink-fg hover:bg-white/18" : "bg-fg/6 text-fg hover:bg-fg/10",
        )}
      >
        <Icon size={15} aria-hidden="true" />
        Qayta chaqirish
      </button>
    </div>
  );
}
