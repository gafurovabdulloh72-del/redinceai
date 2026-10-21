"use client";

import { Phone, PhoneOff, Video } from "lucide-react";
import { PeerAvatar } from "@/components/chat/DmPanels";

type Person = { name: string; avatarUrl: string | null };

/** Umumiy fon: to'q gradient + markazda katta avatar + ism */
function Stage({ person, caption, children }: { person: Person; caption: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[138] flex flex-col items-center justify-between bg-gradient-to-b from-[#161618] to-[#060607] px-6 py-16 text-white" role="dialog" aria-modal="true">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <span className="relative grid place-items-center">
          <span className="absolute h-36 w-36 animate-ping rounded-full bg-white/10" style={{ animationDuration: "1.8s" }} aria-hidden />
          <span className="relative overflow-hidden rounded-full ring-4 ring-white/15">
            <PeerAvatar name={person.name} avatarUrl={person.avatarUrl} size={128} />
          </span>
        </span>
        <div className="text-center">
          <p className="text-[22px] font-semibold leading-tight">{person.name}</p>
          <p className="mt-1.5 text-[14px] text-white/60">{caption}</p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center gap-14 pb-4">{children}</div>
    </div>
  );
}

/** Dumaloq amal tugmasi (qabul/rad/bekor) */
function CallAction({ label, tone, onClick, children }: { label: string; tone: "accept" | "end"; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex flex-col items-center gap-2">
      <span
        className={`grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition active:scale-95 ${
          tone === "accept" ? "bg-success hover:brightness-110" : "bg-accent hover:brightness-110"
        }`}
      >
        {children}
      </span>
      <span className="text-[12.5px] text-white/70">{label}</span>
    </button>
  );
}

/** Kiruvchi qo'ng'iroq — Qabul (yashil) / Rad (qizil). video=false → oddiy ovozli qo'ng'iroq */
export function IncomingCall({ caller, video = true, onAccept, onDecline }: { caller: Person; video?: boolean; onAccept: () => void; onDecline: () => void }) {
  return (
    <Stage person={caller} caption={video ? "Video qo'ng'iroq…" : "Ovozli qo'ng'iroq…"}>
      <CallAction label="Rad etish" tone="end" onClick={onDecline}>
        <PhoneOff size={26} />
      </CallAction>
      <CallAction label="Qabul qilish" tone="accept" onClick={onAccept}>
        {video ? <Video size={26} /> : <Phone size={26} />}
      </CallAction>
    </Stage>
  );
}

/** Chiquvchi qo'ng'iroq — "Chaqirilmoqda…" + Bekor (qizil) */
export function OutgoingCall({ peer, caption, video = true, onCancel }: { peer: Person; caption: string; video?: boolean; onCancel: () => void }) {
  return (
    <Stage person={peer} caption={caption === "Chaqirilmoqda…" && !video ? "Ovozli qo'ng'iroq · Chaqirilmoqda…" : caption}>
      <CallAction label="Bekor qilish" tone="end" onClick={onCancel}>
        <Phone size={26} className="rotate-[135deg]" />
      </CallAction>
    </Stage>
  );
}
