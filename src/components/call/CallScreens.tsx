"use client";

import { Phone, PhoneOff, Video } from "lucide-react";
import { CallAvatar, hueOf } from "./CallAvatar";
import { useScrollLock } from "@/components/motion/useScrollLock";

type Person = { name: string; avatarUrl: string | null };

/**
 * Jiringlash ekrani (iOS/Telegram uslubi) — telefon uchun birinchi:
 *  · butun ekran (dvh), xira avatar fon, safe-area hisobga olingan
 *  · markazda katta avatar + pulsatsiya, ism, holat
 *  · pastda katta (76px) dumaloq tugmalar — bosh barmoq zonasida
 */
function Stage({ person, kind, caption, children }: { person: Person; kind: string; caption: string; children: React.ReactNode }) {
  useScrollLock(true);
  const hue = hueOf(person.name);
  return (
    <div className="fixed inset-0 z-[138] flex h-dvh flex-col overflow-hidden bg-[#0a0a0c] text-white" role="dialog" aria-modal="true" aria-label={`${kind} — ${person.name}`}>
      {/* Fon: xira avatar yoki ismdan hosil bo'lgan gradient */}
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-3xl" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 50% 0%, hsl(${hue} 45% 28%) 0%, #0a0a0c 70%)` }} />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/75" />

      {/* Yuqori: qo'ng'iroq turi */}
      <div className="relative flex justify-center pt-[max(env(safe-area-inset-top),20px)]">
        <span className="rounded-full bg-white/12 px-3.5 py-1.5 text-[12.5px] font-medium tracking-wide text-white/85 backdrop-blur-xl">{kind}</span>
      </div>

      {/* Markaz: avatar + ism + holat */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-7 px-6">
        <span className="relative grid place-items-center">
          <span className="absolute h-[168px] w-[168px] animate-ping rounded-full bg-white/10 [animation-duration:2.2s]" aria-hidden="true" />
          <span className="absolute h-[200px] w-[200px] animate-ping rounded-full bg-white/[0.06] [animation-delay:0.7s] [animation-duration:2.2s]" aria-hidden="true" />
          <span className="relative block overflow-hidden rounded-full ring-[3px] ring-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]">
            <CallAvatar name={person.name} avatarUrl={person.avatarUrl} size={148} />
          </span>
        </span>
        <div className="max-w-full text-center">
          <p className="truncate font-sans text-[30px] font-semibold leading-tight tracking-[-0.01em]">{person.name}</p>
          <p className="mt-2 text-[16px] text-white/70" aria-live="polite">
            {caption}
          </p>
        </div>
      </div>

      {/* Pastki amallar — bosh barmoq zonasi */}
      <div className="relative flex items-start justify-center gap-20 px-6 pb-[max(env(safe-area-inset-bottom),36px)] pt-6">{children}</div>
    </div>
  );
}

/** Katta dumaloq amal tugmasi + tagida yozuv */
function Action({ label, tone, onClick, pulse, children }: { label: string; tone: "accept" | "end"; onClick: () => void; pulse?: boolean; children: React.ReactNode }) {
  const bg = tone === "accept" ? "bg-success" : "bg-danger";
  return (
    <button type="button" onClick={onClick} aria-label={label} className="group flex min-w-[88px] flex-col items-center gap-2.5 outline-none">
      <span className="relative grid place-items-center">
        {pulse && <span className={`absolute inset-0 animate-ping rounded-full ${bg} opacity-40 [animation-duration:1.6s]`} aria-hidden="true" />}
        <span className={`relative grid h-[76px] w-[76px] place-items-center rounded-full text-white shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] transition group-active:scale-90 group-focus-visible:ring-4 group-focus-visible:ring-white/50 ${bg}`}>
          {children}
        </span>
      </span>
      <span className="text-[13.5px] font-medium text-white/80">{label}</span>
    </button>
  );
}

/** Kiruvchi qo'ng'iroq — chapda Rad etish (qizil), o'ngda Qabul qilish (yashil). video=false → ovozli */
export function IncomingCall({ caller, video = true, onAccept, onDecline }: { caller: Person; video?: boolean; onAccept: () => void; onDecline: () => void }) {
  return (
    <Stage person={caller} kind={video ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq"} caption="sizga qo'ng'iroq qilmoqda…">
      <Action label="Rad etish" tone="end" onClick={onDecline}>
        <PhoneOff size={30} />
      </Action>
      <Action label="Qabul qilish" tone="accept" onClick={onAccept} pulse>
        {video ? <Video size={30} /> : <Phone size={30} />}
      </Action>
    </Stage>
  );
}

/** Chiquvchi qo'ng'iroq — "Chaqirilmoqda…" + Bekor qilish (qizil) */
export function OutgoingCall({ peer, caption, video = true, onCancel }: { peer: Person; caption: string; video?: boolean; onCancel: () => void }) {
  return (
    <Stage person={peer} kind={video ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq"} caption={caption}>
      <Action label="Bekor qilish" tone="end" onClick={onCancel}>
        <PhoneOff size={30} />
      </Action>
    </Stage>
  );
}
