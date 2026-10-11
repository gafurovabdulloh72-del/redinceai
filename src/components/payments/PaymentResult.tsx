"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Hourglass, RotateCcw, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { ButtonLink, Spinner } from "@/components/ui";
import type { PaymentDto } from "@/lib/payments/dto";
import { PAYMENT_STATE_LABEL } from "@/lib/constants";
import { PROVIDER_LABEL } from "@/components/payments/tones";
import { cn, formatPrice } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

const POLL_MS = 3000;
const MAX_POLLS = 60; // ~3 daqiqa

/** To'lov natijasi: provayderdan qaytganda holatni so'rab turadi (created/pending → paid/cancelled) */
export function PaymentResult({ paymentId, initial }: { paymentId: string; initial: PaymentDto | null }) {
  const [p, setP] = useState<PaymentDto | null>(initial);
  const [error, setError] = useState<string | null>(initial ? null : "To'lov topilmadi");
  const [polls, setPolls] = useState(0);
  const timer = useRef<number | null>(null);

  const open = p?.state === "created" || p?.state === "pending";
  const manualPending = p?.provider === "manual" && p?.state === "pending";

  useEffect(() => {
    if (!open || polls >= MAX_POLLS || manualPending) return;
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiResponse<PaymentDto> | null;
        if (json && json.ok) setP(json.data);
        else if (json && !json.ok) setError(json.error);
      } catch {
        /* keyingi urinish */
      } finally {
        setPolls((n) => n + 1);
      }
    }, POLL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [open, polls, paymentId, manualPending]);

  if (!p) {
    return (
      <div className="card-elevated p-6 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertCircle size={30} />
        </span>
        <h2 className="mt-5 font-display text-[24px] font-semibold text-fg">{error ?? "To'lov topilmadi"}</h2>
        <ButtonLink href="/kabinet/buyurtmalar" className="mt-6">
          Buyurtmalarim <ArrowRight size={16} />
        </ButtonLink>
      </div>
    );
  }

  const view = (() => {
    switch (p.state) {
      case "paid":
        return { icon: ShieldCheck, tone: "bg-success-soft text-success", title: "To'lov qabul qilindi", text: `${formatPrice(p.amount)} eskrouda saqlanmoqda. Mutaxassis ishni yakunlagach «Ishni qabul qilish»ni bosasiz — shunda pul unga o'tadi.` };
      case "released":
        return { icon: CheckCircle2, tone: "bg-success-soft text-success", title: "Buyurtma yakunlangan", text: "Pul mutaxassisga o'tkazilgan. Rahmat!" };
      case "refunded":
        return { icon: RotateCcw, tone: "bg-fg/6 text-fg-2", title: "Pul qaytarildi", text: `${formatPrice(p.amount)} sizga qaytarildi.` };
      case "cancelled":
        return { icon: XCircle, tone: "bg-danger-soft text-danger", title: "To'lov amalga oshmadi", text: "To'lov bekor qilindi yoki muddati o'tdi. Buyurtma sahifasidagi «To'lash» tugmasi orqali qayta to'lashingiz mumkin." };
      case "pending":
        return manualPending
          ? { icon: Hourglass, tone: "bg-warning-soft text-warning", title: "Tasdiq kutilmoqda", text: "O'tkazmangiz haqida xabar oldik. Administrator tekshirgach buyurtma «To'langan (eskrou)» holatiga o'tadi va bildirishnoma keladi." }
          : { icon: Hourglass, tone: "bg-warning-soft text-warning", title: "To'lov tekshirilmoqda", text: `${PROVIDER_LABEL[p.provider]} tasdig'ini kutmoqdamiz. Bu odatda bir necha soniya davom etadi.` };
      default:
        return polls >= MAX_POLLS
          ? { icon: Hourglass, tone: "bg-warning-soft text-warning", title: "Tasdiq hali kelmadi", text: "To'lovni yakunlagan bo'lsangiz, bir ozdan keyin «Buyurtmalar»da holat yangilanadi. Aks holda qayta urinib ko'ring." }
          : { icon: Wallet, tone: "bg-fg/6 text-fg-2", title: "To'lov kutilmoqda", text: `${PROVIDER_LABEL[p.provider]} sahifasida to'lovni yakunlang — holat shu yerda avtomatik yangilanadi.` };
    }
  })();

  const Icon = view.icon;

  return (
    <div className="card-elevated relative overflow-hidden p-6 text-center sm:p-10">
      <span className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full", view.tone)}>
        <Icon size={32} />
      </span>
      <h2 className="mt-5 font-display text-[26px] font-semibold tracking-tight text-fg sm:text-[30px]">{view.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-fg-2">{view.text}</p>

      <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-left text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-fg-4">Buyurtma</dt>
          <dd className="truncate font-medium text-fg">{p.orderTitle}</dd>
        </div>
        <div>
          <dt className="text-fg-4">Summa</dt>
          <dd className="font-medium text-fg tabular-nums">{formatPrice(p.amount)}</dd>
        </div>
        <div>
          <dt className="text-fg-4">Holat</dt>
          <dd className="font-medium text-fg">{PAYMENT_STATE_LABEL[p.state]}</dd>
        </div>
      </dl>

      {open && !manualPending && polls < MAX_POLLS && (
        <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-fg-3" aria-live="polite">
          <Spinner className="h-3.5 w-3.5" /> Holat yangilanmoqda…
        </p>
      )}

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href={`/kabinet/buyurtmalar?id=${p.orderId}`} variant={p.state === "paid" || p.state === "released" ? "accent" : "primary"} size="lg">
          Buyurtmani ko'rish <ArrowRight size={18} />
        </ButtonLink>
        {/* Bekor qilingan to'lov checkout'ga qaytmaydi (/tolov/[id] uni natijaga yo'naltiradi) — qayta to'lash buyurtma kartasidan */}
        {p.state === "created" && (
          <ButtonLink href={`/tolov/${p.id}`} variant="outline" size="lg">
            <RotateCcw size={16} /> Qayta urinish
          </ButtonLink>
        )}
        {(p.state === "paid" || p.state === "released") && (
          <ButtonLink href="/kabinet/tolovlar" variant="outline" size="lg">
            To'lovlarim
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
