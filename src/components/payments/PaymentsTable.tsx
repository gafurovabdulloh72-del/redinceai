import Link from "next/link";
import { Receipt } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { PAYMENT_TONE, PROVIDER_LABEL, type PaymentState } from "@/components/payments/tones";
import { PAYMENT_STATE_LABEL, type PaymentProvider } from "@/lib/constants";
import { formatDateTime, formatPrice } from "@/lib/utils";

export interface PaymentRow {
  id: string;
  orderId: string;
  orderTitle: string;
  /** Qarshi tomon: mijoz uchun mutaxassis, mutaxassis uchun mijoz */
  counterpart: string;
  provider: PaymentProvider;
  state: PaymentState;
  amount: number;
  commissionPct: number;
  commissionAmount: number;
  netAmount: number;
  /** ms */
  createdAt: number;
  paidAt: number | null;
  releasedAt: number | null;
}

/**
 * To'lovlar tarixi: desktopda jadval, mobilda kartalar (ustun nomlari saqlanadi).
 * role=specialist — sof summa (komissiya ayrilgan) asosiy; role=client — to'langan summa.
 */
export function PaymentsTable({ rows, role, emptyText }: { rows: PaymentRow[]; role: "client" | "specialist"; emptyText?: string }) {
  if (rows.length === 0) {
    return <EmptyState icon={Receipt} title="Hali to'lovlar yo'q" description={emptyText ?? "To'lovlar shu yerda ko'rinadi."} />;
  }
  const main = (r: PaymentRow) => (role === "specialist" ? r.netAmount : r.amount);
  const sub = (r: PaymentRow) => (role === "specialist" ? `${formatPrice(r.amount)} − ${r.commissionPct}%` : r.provider === "manual" ? "O'tkazma" : PROVIDER_LABEL[r.provider]);

  return (
    <div className="card overflow-hidden">
      {/* Desktop */}
      <table className="hidden w-full text-left text-[14px] md:table">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
            <th className="px-5 py-3 font-bold">Buyurtma</th>
            <th className="px-3 py-3 font-bold">{role === "specialist" ? "Mijoz" : "Mutaxassis"}</th>
            <th className="px-3 py-3 font-bold">Usul</th>
            <th className="px-3 py-3 text-right font-bold">{role === "specialist" ? "Sizga" : "Summa"}</th>
            <th className="px-3 py-3 font-bold">Holat</th>
            <th className="px-5 py-3 text-right font-bold">Sana</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="transition hover:bg-fg/3">
              <td className="max-w-[260px] px-5 py-3">
                <Link href={`/kabinet/buyurtmalar?id=${r.orderId}`} className="block truncate font-semibold text-fg hover:text-accent">
                  {r.orderTitle}
                </Link>
                <span className="block font-mono text-[11px] text-fg-4">{r.id.slice(0, 8)}</span>
              </td>
              <td className="px-3 py-3 text-fg-2">{r.counterpart}</td>
              <td className="px-3 py-3 text-fg-2">{PROVIDER_LABEL[r.provider]}</td>
              <td className="px-3 py-3 text-right tabular-nums">
                <span className="block font-semibold text-fg">{formatPrice(main(r))}</span>
                {role === "specialist" && <span className="block text-[11px] text-fg-4">{sub(r)}</span>}
              </td>
              <td className="px-3 py-3">
                <Badge tone={PAYMENT_TONE[r.state]}>{PAYMENT_STATE_LABEL[r.state]}</Badge>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right text-[12px] text-fg-3">
                <time dateTime={new Date(r.releasedAt ?? r.paidAt ?? r.createdAt).toISOString()}>{formatDateTime(r.releasedAt ?? r.paidAt ?? r.createdAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobil */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/kabinet/buyurtmalar?id=${r.orderId}`} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
                {r.orderTitle}
              </Link>
              <Badge tone={PAYMENT_TONE[r.state]} className="shrink-0">
                {PAYMENT_STATE_LABEL[r.state]}
              </Badge>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
              <div>
                <dt className="text-fg-4">{role === "specialist" ? "Mijoz" : "Mutaxassis"}</dt>
                <dd className="truncate text-fg-2">{r.counterpart}</dd>
              </div>
              <div>
                <dt className="text-fg-4">Usul</dt>
                <dd className="text-fg-2">{PROVIDER_LABEL[r.provider]}</dd>
              </div>
              <div>
                <dt className="text-fg-4">{role === "specialist" ? "Sizga" : "Summa"}</dt>
                <dd className="font-semibold text-fg tabular-nums">
                  {formatPrice(main(r))}
                  {role === "specialist" && <span className="ml-1 font-normal text-fg-4">({sub(r)})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-fg-4">Sana</dt>
                <dd className="text-fg-2">{formatDateTime(r.releasedAt ?? r.paidAt ?? r.createdAt)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
