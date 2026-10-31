"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogIn, ShieldCheck, Unlock } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { cn, formatPrice } from "@/lib/utils";

const PROVIDER_LABEL = { payme: "Payme", click: "Click", manual: "Karta o'tkazmasi" } as const;
type Provider = keyof typeof PROVIDER_LABEL;
type Quote = { specialistId: string; title: string; amount: number; unlocked: boolean; providers: Provider[] };

const T = {
  title: { uz: "Aloqa", ru: "Контакты" },
  hidden: { uz: "Telefon, Telegram, Instagram va email — to'lovdan so'ng ochiladi", ru: "Телефон, Telegram, Instagram и email откроются после оплаты" },
  note: { uz: "To'lov platformaga qilinadi, kontakt shu zahoti profilda ko'rinadi va kabinetingizda saqlanadi.", ru: "Оплата идёт платформе, контакт сразу появится в профиле и сохранится в кабинете." },
  open: { uz: "Kontaktni ochish", ru: "Открыть контакт" },
  free: { uz: "Bepul ochish", ru: "Открыть бесплатно" },
  login: { uz: "Kirish", ru: "Войти" },
  loginNote: { uz: "Kontaktni ochish uchun avval tizimga kiring", ru: "Чтобы открыть контакт, войдите в систему" },
  confirm: { uz: "Kontaktni ochish", ru: "Открыть контакт" },
  price: { uz: "Narx", ru: "Цена" },
  method: { uz: "To'lov usuli", ru: "Способ оплаты" },
  noMethods: { uz: "To'lov usullari hali ulanmagan — administrator bilan bog'laning.", ru: "Способы оплаты пока не подключены — свяжитесь с администратором." },
  pay: { uz: "To'lash", ru: "Оплатить" },
  done: { uz: "Kontakt ochildi 🎉", ru: "Контакт открыт 🎉" },
  err: { uz: "Xatolik", ru: "Ошибка" },
  what: { uz: "Nima ochiladi", ru: "Что откроется" },
};

/**
 * Mutaxassis kontaktini PLATFORMAGA to'lab ochish kartasi (profil, contactMode="paid", hali ochilmagan).
 * Narx serverdan keladi (daraja bo'yicha umumiy yoki maxsus). Mehmon → kirish; kirgan → to'lov oynasi (Payme/Click/o'tkazma).
 */
export function ContactUnlockCard({ specialistId, price, loggedIn, loginHref, className }: { specialistId: string; price: number; loggedIn: boolean; loginHref: string; className?: string }) {
  const til = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<Quote | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/kontakt/narx", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ specialistId }) });
      const j = (await r.json()) as { data?: Quote; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error || tr(til, T.err));
      if (j.data.unlocked) {
        setOpen(false);
        router.refresh();
        return;
      }
      setQ(j.data);
      setProvider((p) => p ?? j.data!.providers[0] ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr(til, T.err));
    }
  }, [specialistId, router, til]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function pay() {
    if (!q) return;
    setBusy(true);
    try {
      const r = await fetch("/api/kontakt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ specialistId, provider: provider ?? "manual" }) });
      const j = (await r.json()) as { data?: { free: boolean; redirectUrl?: string | null; statusPath?: string }; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error || tr(til, T.err));
      if (j.data.free) {
        showToast(tr(til, T.done), "success");
        setOpen(false);
        router.refresh();
        return;
      }
      if (j.data.redirectUrl) window.location.href = j.data.redirectUrl;
      else if (j.data.statusPath) router.push(j.data.statusPath);
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, T.err), "error");
      setBusy(false);
    }
  }

  const free = price <= 0;
  return (
    <section id="aloqa" className={className} aria-label={tr(til, T.title)}>
      <div className="mb-2 flex items-center justify-between px-4">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, T.title)}</h3>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-3">
          <Lock size={11} /> {free ? tr(til, T.free) : formatPrice(price)}
        </span>
      </div>
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-3 text-fg-2">
            <Lock size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-fg">{tr(til, T.hidden)}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-fg-3">{loggedIn ? tr(til, T.note) : tr(til, T.loginNote)}</p>
          </div>
        </div>
        {loggedIn ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-accent mt-4 inline-flex h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold">
            <Unlock size={15} /> {free ? tr(til, T.free) : `${tr(til, T.open)} — ${formatPrice(price)}`}
          </button>
        ) : (
          <Link href={loginHref} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line-2 text-[14px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4">
            <LogIn size={15} /> {tr(til, T.login)}
          </Link>
        )}
      </div>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={tr(til, T.confirm)} size="sm">
        {!q && !err && (
          <div className="grid h-32 place-items-center">
            <Loader2 className="animate-spin text-fg-3" />
          </div>
        )}
        {err && !q && <p className="py-6 text-center text-[14px] text-danger">{err}</p>}
        {q && (
          <div className="space-y-4">
            <p className="text-[15px] font-semibold text-fg">{q.title}</p>
            <ul className="space-y-1 text-[13px] text-fg-2">
              <li className="text-[12.5px] font-semibold text-fg-3">{tr(til, T.what)}</li>
              <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-success" /> {tr(til, T.hidden)}</li>
            </ul>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-bold text-fg">
              <span>{tr(til, T.price)}</span>
              <span className="tabular-nums">{q.amount <= 0 ? tr(til, T.free) : formatPrice(q.amount)}</span>
            </div>
            {q.amount > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-[12.5px] font-semibold text-fg-3">{tr(til, T.method)}</legend>
                {q.providers.length === 0 && <p className="text-[13px] text-danger">{tr(til, T.noMethods)}</p>}
                {q.providers.map((p) => (
                  <label key={p} className={cn("flex cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-[14px] font-semibold", provider === p ? "border-fg bg-fg/[0.03]" : "border-line")}>
                    <input type="radio" name="kontakt-prov" checked={provider === p} onChange={() => setProvider(p)} /> {PROVIDER_LABEL[p]}
                  </label>
                ))}
              </fieldset>
            )}
            <button type="button" disabled={busy || (q.amount > 0 && !provider)} onClick={() => void pay()} className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-50">
              {busy && <Loader2 size={16} className="animate-spin" />} {q.amount <= 0 ? tr(til, T.free) : `${tr(til, T.pay)} — ${formatPrice(q.amount)}`}
            </button>
            <p className="text-center text-[12px] text-fg-3">{tr(til, T.note)}</p>
          </div>
        )}
      </Sheet>
    </section>
  );
}
