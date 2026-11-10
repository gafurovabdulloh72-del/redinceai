"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Save, Trash2, Wrench } from "lucide-react";
import { adminApi, errText } from "@/components/admin/admin-api";
import { SiteBannerView, type BannerViewTone } from "@/components/system/SiteBannerView";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { BANNER, MAINTENANCE } from "@/lib/i18n/dict/system";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Admin «Tizim» tabi: «SAYT E'LONI» (tepadagi chiziq: matn uz/ru, ohang, havola, muddat, oldindan ko'rish) va
 * «TEXNIK ISHLAR REJIMI» (faqat o'qish: admin bo'lmaganlar hech narsa yoza olmaydi; tasdiq bilan yoqiladi).
 * API: GET/PUT/DELETE /api/admin/sayt-elon, GET/PUT /api/admin/texnik-ishlar. Har o'zgarish audit jurnaliga yoziladi.
 * O'zgarish saytda ≤15 soniyada ko'rinadi (server keshi).
 */
interface Banner {
  textUz: string;
  textRu: string;
  tone: BannerViewTone;
  href: string | null;
  until: number | null;
  version: number;
}
interface Maintenance {
  on: boolean;
  messageUz: string;
  messageRu: string;
  since: number | null;
}

const TEXT_MAX = 240;
const MSG_MAX = 300;
const TONES: Array<[BannerViewTone, string]> = [
  ["info", "Ma'lumot"],
  ["warn", "Ogohlantirish"],
  ["success", "Yaxshi xabar"],
];
/** Standart ogohlantirish matni — tashrifchi ko'radigan lug'atdan (bitta manba) */
const DEFAULT_NOTICE_UZ = MAINTENANCE.notice.uz;

/** ms → <input type="datetime-local"> qiymati (brauzerning mahalliy vaqti) */
function toLocalInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function AdminSiteNotice() {
  const confirm = useConfirm();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ---------- E'lon ---------- */
  const [banner, setBanner] = useState<Banner | null>(null);
  const [textUz, setTextUz] = useState("");
  const [textRu, setTextRu] = useState("");
  const [tone, setTone] = useState<BannerViewTone>("info");
  const [href, setHref] = useState("");
  const [until, setUntil] = useState("");
  const [previewLang, setPreviewLang] = useState<"uz" | "ru">("uz");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  /* ---------- Texnik ishlar ---------- */
  const [maint, setMaint] = useState<Maintenance>({ on: false, messageUz: "", messageRu: "", since: null });
  const [msgUz, setMsgUz] = useState("");
  const [msgRu, setMsgRu] = useState("");
  const [savingMaint, setSavingMaint] = useState(false);

  const fillBanner = (b: Banner | null) => {
    setBanner(b);
    setTextUz(b?.textUz ?? "");
    setTextRu(b?.textRu ?? "");
    setTone(b?.tone ?? "info");
    setHref(b?.href ?? "");
    setUntil(toLocalInput(b?.until ?? null));
  };
  const fillMaint = (m: Maintenance) => {
    setMaint(m);
    setMsgUz(m.messageUz);
    setMsgRu(m.messageRu);
  };

  const load = useCallback(async () => {
    try {
      const d = await adminApi<{ banner: Banner | null; maintenance: Maintenance }>("/api/admin/sayt-elon");
      fillBanner(d.banner);
      fillMaint(d.maintenance);
      setLoadError(null);
    } catch (e) {
      setLoadError(errText(e, "Sozlamalarni yuklab bo'lmadi"));
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveBanner() {
    setSavingBanner(true);
    setBannerError(null);
    try {
      const d = await adminApi<{ banner: Banner }>("/api/admin/sayt-elon", { method: "PUT", json: { textUz: textUz.trim(), textRu: textRu.trim(), tone, href: href.trim(), until: fromLocalInput(until) } });
      fillBanner(d.banner);
      showToast("E'lon saqlandi — saytda 15 soniya ichida ko'rinadi");
    } catch (e) {
      setBannerError(errText(e, "Saqlab bo'lmadi"));
    } finally {
      setSavingBanner(false);
    }
  }

  async function removeBanner() {
    if (!(await confirm({ title: "E'lonni olib tashlaysizmi?", text: "Chiziq saytdan yo'qoladi. Matn saqlanmaydi.", confirmLabel: "Olib tashlash", danger: true }))) return;
    setSavingBanner(true);
    try {
      await adminApi("/api/admin/sayt-elon", { method: "DELETE" });
      fillBanner(null);
      setBannerError(null);
      showToast("E'lon olib tashlandi");
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setSavingBanner(false);
    }
  }

  async function putMaint(body: Partial<Pick<Maintenance, "on" | "messageUz" | "messageRu">>, okText: string) {
    setSavingMaint(true);
    try {
      fillMaint(await adminApi<Maintenance>("/api/admin/texnik-ishlar", { method: "PUT", json: body }));
      showToast(okText);
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setSavingMaint(false);
    }
  }

  async function toggleMaint() {
    if (maint.on) return putMaint({ on: false }, "Texnik ishlar rejimi o'chirildi — sayt to'liq ishlayapti");
    const ok = await confirm({
      title: "Texnik ishlar rejimini yoqasizmi?",
      text: "Adminlardan boshqa hech kim post, xabar, buyurtma yoza olmaydi va to'lov boshlay olmaydi (o'qish ishlayveradi). Sayt tepasida ogohlantirish chiqadi. Ish tugagach o'chirishni unutmang.",
      confirmLabel: "Yoqish",
      danger: true,
    });
    if (ok) await putMaint({ on: true, messageUz: msgUz.trim(), messageRu: msgRu.trim() }, "Texnik ishlar rejimi yoqildi");
  }

  if (!loaded) {
    return (
      <div className="grid gap-4 @container" aria-busy="true">
        <div className="h-64 skeleton !rounded-[var(--r-md)]" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p role="alert" className="text-[13px] font-medium text-danger-text">
          {loadError}
        </p>
        <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
          Qayta urinish
        </button>
      </div>
    );
  }

  const now = Date.now();
  const expired = Boolean(banner?.until && banner.until <= now);
  const dirty = !banner || banner.textUz !== textUz.trim() || banner.textRu !== textRu.trim() || banner.tone !== tone || (banner.href ?? "") !== href.trim() || toLocalInput(banner.until) !== until;
  const previewText = (previewLang === "ru" && textRu.trim() ? textRu.trim() : textUz.trim()) || "E'lon matni shu yerda ko'rinadi";
  const maintDirty = msgUz.trim() !== maint.messageUz || msgRu.trim() !== maint.messageRu;

  return (
    <div className="@container">
      <div className="grid gap-4 @4xl:grid-cols-2">
        {/* ------------------------------ Sayt e'loni ------------------------------ */}
        <section className="card skeleton-swap flex flex-col overflow-hidden" aria-labelledby="h-elon-karta">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 id="h-elon-karta" className="flex items-center gap-2 font-display text-[16px] font-semibold text-fg">
              <Megaphone size={16} aria-hidden="true" /> Sayt e&apos;loni
            </h3>
            <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold", !banner ? "bg-fg/6 text-fg-3" : expired ? "bg-warning-soft text-warning-text" : "bg-success-soft text-success-text")}>
              {!banner ? "E'lon yo'q" : expired ? "Muddati o'tgan" : banner.until ? `Ko'rsatilmoqda · ${formatDateTime(banner.until)} gacha` : "Ko'rsatilmoqda"}
            </span>
          </header>

          <div className="flex flex-1 flex-col gap-3.5 p-4">
            <div>
              <label htmlFor="elon-uz" className="field-label flex items-center justify-between">
                Matn (o&apos;zbekcha) <span className="font-normal tabular-nums text-fg-4">{textUz.length}/{TEXT_MAX}</span>
              </label>
              <textarea id="elon-uz" value={textUz} onChange={(e) => setTextUz(e.target.value)} maxLength={TEXT_MAX} rows={2} placeholder="Masalan: 15-noyabr kuni 02:00–04:00 da texnik ishlar bo'ladi" className="field w-full resize-y py-2 text-[13.5px] leading-relaxed" />
            </div>
            <div>
              <label htmlFor="elon-ru" className="field-label flex items-center justify-between">
                Matn (ruscha) <span className="font-normal tabular-nums text-fg-4">{textRu.length}/{TEXT_MAX}</span>
              </label>
              <textarea id="elon-ru" value={textRu} onChange={(e) => setTextRu(e.target.value)} maxLength={TEXT_MAX} rows={2} lang="ru" placeholder="Например: 15 ноября с 02:00 до 04:00 — технические работы" className="field w-full resize-y py-2 text-[13.5px] leading-relaxed" data-no-auto />
              {!textRu.trim() && textUz.trim() && <p className="mt-1 text-[12px] text-fg-4">Bo&apos;sh qolsa, rus tilidagi tashrifchiga ham o&apos;zbekcha matn ko&apos;rsatiladi.</p>}
            </div>

            <div>
              <span className="field-label" id="elon-ohang">
                Ohang
              </span>
              <div className="segment flex w-full" role="radiogroup" aria-labelledby="elon-ohang">
                {TONES.map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={tone === v} data-active={tone === v} onClick={() => setTone(v)} className="segment-item min-w-0 flex-1 truncate !px-2">
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3.5 @md:grid-cols-2">
              <div>
                <label htmlFor="elon-havola" className="field-label">
                  Havola (ixtiyoriy)
                </label>
                <input id="elon-havola" value={href} onChange={(e) => setHref(e.target.value)} maxLength={300} placeholder="/narxlar yoki https://…" className="field w-full text-[13.5px]" inputMode="url" autoComplete="off" spellCheck={false} />
              </div>
              <div>
                <label htmlFor="elon-muddat" className="field-label">
                  Muddat (ixtiyoriy)
                </label>
                <input id="elon-muddat" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} min={toLocalInput(now)} className="field w-full text-[13.5px]" />
              </div>
            </div>
            <p className="-mt-1.5 text-[12px] text-fg-4">Havola berilsa, matn oxirida «Batafsil» chiqadi. Muddat bo&apos;sh bo&apos;lsa e&apos;lon o&apos;chirilguncha turadi.</p>

            {/* Oldindan ko'rish: tashrifchi ko'radigan komponentning o'zi */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-fg-3">Oldindan ko&apos;rish</span>
                <div className="segment" role="radiogroup" aria-label="Ko'rish tili">
                  {(["uz", "ru"] as const).map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={previewLang === l} data-active={previewLang === l} onClick={() => setPreviewLang(l)} className="segment-item !min-h-7 !px-2.5 !py-0.5 text-[11.5px] uppercase">
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-[var(--r-sm)] border border-line">
                <SiteBannerView tone={tone} text={previewText} href={href.trim() || null} moreLabel={BANNER.more[previewLang]} className="!border-b-0 !px-3.5" />
              </div>
            </div>

            {bannerError && (
              <p role="alert" className="rounded-[var(--r-sm)] bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger-text">
                {bannerError}
              </p>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={() => void saveBanner()} disabled={savingBanner || textUz.trim().length < 3 || !dirty} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
                <Save size={14} /> {savingBanner ? "Saqlanmoqda…" : banner ? "Yangilash" : "E'lonni chiqarish"}
              </button>
              {banner && (
                <button type="button" onClick={() => void removeBanner()} disabled={savingBanner} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-danger/40 px-4 text-[13px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-50">
                  <Trash2 size={14} /> Olib tashlash
                </button>
              )}
              {banner && !dirty && <span className="text-[12px] text-fg-4">Saqlangan</span>}
            </div>
          </div>
        </section>

        {/* --------------------------- Texnik ishlar rejimi --------------------------- */}
        <section className={cn("card skeleton-swap flex flex-col overflow-hidden", maint.on && "!border-warning/50")} aria-labelledby="h-texnik-karta">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h3 id="h-texnik-karta" className="flex items-center gap-2 font-display text-[16px] font-semibold text-fg">
                <Wrench size={16} aria-hidden="true" /> Texnik ishlar rejimi
              </h3>
              <p className={cn("mt-0.5 text-[12.5px]", maint.on ? "font-semibold text-warning-text" : "text-fg-3")} aria-live="polite">
                {maint.on ? `YOQILGAN${maint.since ? ` · ${timeAgo(maint.since)}` : ""} — sayt faqat o'qish rejimida` : "O'chiq — sayt to'liq ishlayapti"}
              </p>
            </div>
            <button type="button" role="switch" aria-checked={maint.on} aria-label="Texnik ishlar rejimi" onClick={() => void toggleMaint()} disabled={savingMaint} className="switch disabled:opacity-50" />
          </header>

          <div className="flex flex-1 flex-col gap-3.5 p-4">
            <p className="text-[12.5px] leading-relaxed text-fg-3">
              Yoqilganda adminlardan boshqa hech kim <b className="font-semibold text-fg-2">o&apos;zgartirish kirita olmaydi</b> (post, xabar, buyurtma, to&apos;lov boshlash) — so&apos;rovlar «texnik ishlar» xabari bilan qaytadi. Sahifalarni ko&apos;rish, kirish va to&apos;lov tizimlarining tasdiq so&apos;rovlari (Payme/Click) ishlayveradi. Migratsiya yoki nosozlik paytida ishlating.
            </p>
            <div>
              <label htmlFor="texnik-uz" className="field-label flex items-center justify-between">
                Xabar (o&apos;zbekcha, ixtiyoriy) <span className="font-normal tabular-nums text-fg-4">{msgUz.length}/{MSG_MAX}</span>
              </label>
              <textarea id="texnik-uz" value={msgUz} onChange={(e) => setMsgUz(e.target.value)} maxLength={MSG_MAX} rows={2} placeholder="Bo'sh — standart matn" className="field w-full resize-y py-2 text-[13.5px] leading-relaxed" />
            </div>
            <div>
              <label htmlFor="texnik-ru" className="field-label flex items-center justify-between">
                Xabar (ruscha, ixtiyoriy) <span className="font-normal tabular-nums text-fg-4">{msgRu.length}/{MSG_MAX}</span>
              </label>
              <textarea id="texnik-ru" value={msgRu} onChange={(e) => setMsgRu(e.target.value)} maxLength={MSG_MAX} rows={2} lang="ru" placeholder="Пусто — стандартный текст" className="field w-full resize-y py-2 text-[13.5px] leading-relaxed" data-no-auto />
              <p className="mt-1 text-[12px] leading-relaxed text-fg-4">
                Xabar sayt tepasidagi chiziqda va bajarilmagan amal javobida ko&apos;rinadi. Bo&apos;sh qolsa standart matn: «{DEFAULT_NOTICE_UZ}»
              </p>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={() => void putMaint({ messageUz: msgUz.trim(), messageRu: msgRu.trim() }, "Xabar saqlandi")} disabled={savingMaint || !maintDirty} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
                <Save size={14} /> Xabarni saqlash
              </button>
              {maint.on && (
                <button type="button" onClick={() => void toggleMaint()} disabled={savingMaint} className="btn-ink inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
                  Rejimni o&apos;chirish
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
