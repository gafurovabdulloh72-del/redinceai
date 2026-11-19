"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MonitorPlay } from "lucide-react";
import { showToast } from "@/components/ui/toast";

/** Kabinet → Portfolio: «Portfolio saytingiz» — mijozga yuboriladigan vitrina havolasi (nusxalash + ochish) */
export function ShowcaseLinkCard({ path, til }: { path: string; til: "uz" | "ru" }) {
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast(url);
    }
  }
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[var(--r-md)] border border-line bg-[#1a110b] p-4 text-[#f6ebe0] m-flat sm:p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff5a36] text-[#1a110b]">
        <MonitorPlay size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{t("Portfolio saytingiz", "Ваш сайт-портфолио")}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-[#f6ebe0]/60">{t("Mijozga Telegram kanal o'rniga shu havolani yuboring — ishlaringiz bitta chiroyli sahifada.", "Отправляйте клиенту эту ссылку вместо канала — все работы на одной странице.")}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#f6ebe0]/40 px-4 text-[13px] font-semibold hover:border-[#f6ebe0]">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("Nusxalandi", "Скопировано") : t("Nusxalash", "Копировать")}
        </button>
        <a href={path} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#ff5a36] px-4 text-[13px] font-bold text-[#1a110b] hover:brightness-110">
          {t("Ochish", "Открыть")} <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
