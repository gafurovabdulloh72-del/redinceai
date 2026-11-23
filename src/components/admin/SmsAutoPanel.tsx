"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Smartphone, Zap } from "lucide-react";
import { adminApi, errText } from "@/components/admin/admin-api";
import { showToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatDateTime, formatPrice } from "@/lib/utils";

/**
 * Admin → Moliya: kartaga o'tkazmani bank SMS'i orqali AVTOMATIK tasdiqlash (lib/payments/sms-auto.ts).
 * Kalit faqat yaratilganda bir marta ko'rsatiladi (bazada xeshi). Ko'rsatma: iPhone Shortcuts va Android SMS-forwarder.
 */
interface State {
  enabled: boolean;
  hasKey: boolean;
  endpoint: string;
  recent: Array<{ id: string; invoiceId: string | null; amount: number; at: number }>;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-semibold text-fg-3">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[8px] bg-fg/[0.05] px-2.5 py-2 font-mono text-[12px] text-fg" title={value}>
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setDone(true);
              window.setTimeout(() => setDone(false), 1500);
            });
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 hover:text-fg"
        >
          {done ? <Check size={12} className="text-success" /> : <Copy size={12} />} {done ? "Nusxalandi" : "Nusxalash"}
        </button>
      </div>
    </div>
  );
}

export function SmsAutoPanel() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setS(await adminApi<State>("/api/admin/sms-tolov"));
    } catch (e) {
      showToast(errText(e, "Yuklab bo'lmadi"), "error");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "enable" | "disable" | "rotate") {
    if (action === "rotate" && s?.hasKey) {
      const yes = await confirm({ title: "Yangi kalit yaratilsinmi?", text: "Eski kalit darhol ishlamay qoladi — telefondagi avtomatizatsiyaga yangi kalitni qo'yishingiz kerak bo'ladi.", confirmLabel: "Yangi kalit" });
      if (!yes) return;
    }
    setBusy(true);
    try {
      const d = await adminApi<{ enabled: boolean; hasKey: boolean; key: string | null }>("/api/admin/sms-tolov", { method: "POST", json: { action } });
      if (d.key) setKey(d.key);
      await load();
      showToast(action === "rotate" ? "Kalit yaratildi — hozir nusxalab oling, keyin ko'rinmaydi" : action === "enable" ? "Avtomatik tasdiqlash yoqildi" : "O'chirildi", "success");
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <div className="card mt-4 h-24 skeleton" aria-busy="true" />;
  const active = s.enabled && s.hasKey;

  return (
    <div className="card mt-4 p-5 sm:p-6" id="sms-avto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Zap size={16} className={active ? "text-success" : "text-fg-3"} /> Kartaga o&apos;tkazmani avtomatik tasdiqlash
          </h3>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-fg-3">
            Har bir hisobga noyob summa beriladi (masalan 49 017 so&apos;m). Telefoningizga bank SMS&apos;i kelganda u saytga yuboriladi va sayt <b className="text-fg-2">faqat shu summaga aynan teng</b> ochiq hisobni tasdiqlaydi. Boshqa har qanday tushum va chiqimlar e&apos;tiborsiz qoladi, SMS matni hech qayerda saqlanmaydi.
          </p>
        </div>
        <span className={active ? "rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-semibold text-success-text" : "rounded-full bg-fg/[0.06] px-2.5 py-1 text-[12px] font-semibold text-fg-3"}>{active ? "Ishlayapti" : s.enabled ? "Kalit yo'q" : "O'chiq"}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void act("rotate")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} {s.hasKey ? "Yangi kalit yaratish" : "1. Kalit yaratish"}
        </button>
        {s.enabled ? (
          <button type="button" disabled={busy} onClick={() => void act("disable")} className="inline-flex h-9 items-center rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
            O&apos;chirish
          </button>
        ) : (
          <button type="button" disabled={busy || !s.hasKey} onClick={() => void act("enable")} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[12.5px] font-semibold text-ink-fg disabled:opacity-40">
            {s.hasKey ? "Yoqish" : "3. Yoqish"}
          </button>
        )}
      </div>

      {key && (
        <div className="mt-4 space-y-3 rounded-[14px] border border-warning/40 bg-warning-soft p-4">
          <p className="text-[12.5px] font-semibold text-warning-text">Kalitni hozir nusxalab oling — sahifa yangilangach qayta ko&apos;rsatilmaydi.</p>
          <CopyField label="Kalit (X-Sms-Key)" value={key} />
          <CopyField label="Manzil (Android uchun — kalit ichida)" value={`${s.endpoint}?key=${key}`} />
        </div>
      )}

      <details className="group mt-4 rounded-[14px] border border-line" open={!active}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
          <Smartphone size={15} /> 2. Telefonni sozlash
        </summary>
        <div className="space-y-4 border-t border-line px-4 py-4 text-[13px] leading-relaxed text-fg-2">
          <CopyField label="Manzil (URL)" value={s.endpoint} />
          <div>
            <p className="font-semibold text-fg">iPhone — «Shortcuts» (Команды) ilovasi</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>
                <b>Automation</b> → <b>+</b> → <b>Message</b> → «Sender»: bankingiz SMS nomi (masalan HUMO, UZCARD yoki bank nomi) → <b>Run Immediately</b> → Next.
              </li>
              <li>
                <b>New Blank Automation</b> → amal qo&apos;shing: <b>Get Contents of URL</b>.
              </li>
              <li>
                URL — yuqoridagi manzil. «Show More»: <b>Method: POST</b>; <b>Headers</b> → Key <code>X-Sms-Key</code>, Value — kalit; <b>Request Body: JSON</b> → Key <code>text</code>, Value — <b>Shortcut Input → Message</b> (SMS matni).
              </li>
              <li>Saqlang. Sinash uchun o&apos;zingizga kichik summa o&apos;tkazib ko&apos;ring — sayt uni e&apos;tiborsiz qoldiradi (mos hisob yo&apos;q), xato chiqmasa ulanish ishlayapti.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-fg">Android — «SMS to URL Forwarder» (yoki shunga o&apos;xshash) ilova</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Yangi qoida: jo&apos;natuvchi — bank SMS nomi.</li>
              <li>URL — kalit yaratilganda chiqqan «manzil (kalit ichida)», metod POST, tana: <code>{`{"text":"%text%"}`}</code> (ilovadagi SMS matni o&apos;zgaruvchisi).</li>
            </ol>
          </div>
          <p className="text-[12px] text-fg-3">
            Bankdan SMS-xabarnoma yoqilgan bo&apos;lishi kerak (Telegram bot xabarlari o&apos;qilmaydi). Kalitni hech kimga bermang — kalitga ega odam soxta «SMS» yubora oladi; shubha bo&apos;lsa «Yangi kalit yaratish».
          </p>
        </div>
      </details>

      <div className="mt-4">
        <p className="text-[13px] font-semibold text-fg">Avtomatik tasdiqlanganlar</p>
        {s.recent.length ? (
          <ul className="mt-2 divide-y divide-line rounded-[14px] border border-line">
            {s.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                <span className="font-semibold tabular-nums text-fg">{formatPrice(r.amount)}</span>
                <span className="truncate font-mono text-fg-3">{r.invoiceId}</span>
                <span className="shrink-0 text-fg-3">{formatDateTime(r.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12.5px] text-fg-3">Hali yo&apos;q.</p>
        )}
      </div>
    </div>
  );
}
