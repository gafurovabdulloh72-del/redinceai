"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, MessageCircle, MessagesSquare, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface PrivacySettings {
  dmPolicy: "all" | "following" | "none";
  commentPolicy: "all" | "followers" | "none";
  showOnline: boolean;
}
type ApiResp = { ok: boolean; data?: PrivacySettings; error?: string; fields?: Record<string, string> };

const DM_OPTIONS: Array<{ value: PrivacySettings["dmPolicy"]; label: string; hint: string }> = [
  { value: "all", label: "Hamma", hint: "Istalgan foydalanuvchi sizga yoza oladi" },
  { value: "following", label: "Men obuna bo'lganlar", hint: "Faqat siz obuna bo'lgan odamlar yangi suhbat ocha oladi" },
  { value: "none", label: "Hech kim", hint: "Yangi suhbatlar yopiq — mavjud suhbatlar davom etadi" },
];
const COMMENT_OPTIONS: Array<{ value: PrivacySettings["commentPolicy"]; label: string; hint: string }> = [
  { value: "all", label: "Hamma", hint: "Kirgan har bir foydalanuvchi postlaringizga izoh yoza oladi" },
  { value: "followers", label: "Obunachilarim", hint: "Faqat sizga obuna bo'lganlar" },
  { value: "none", label: "Hech kim", hint: "Izohlar yopiq (reaksiyalar qoladi)" },
];

/** Kabinet → Xavfsizlik → Maxfiylik: kim yozishi mumkin, kim izoh yozadi, onlayn holat. O'zgarish darhol saqlanadi */
export function PrivacyPanel({ initial }: { initial: PrivacySettings }) {
  const { toast } = useToast();
  const [v, setV] = useState<PrivacySettings>(initial);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  async function save(next: PrivacySettings) {
    const prev = v;
    setV(next);
    setSaving(true);
    const my = ++seq.current;
    try {
      const res = await fetch("/api/account/privacy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlanmadi");
      if (my === seq.current) toast("Maxfiylik sozlamalari saqlandi");
    } catch (e) {
      setV(prev);
      toast(e instanceof Error ? e.message : "Saqlanmadi", "error");
    } finally {
      if (my === seq.current) setSaving(false);
    }
  }

  function Segment<T extends string>({ name, value, options, onPick, icon: Icon, title }: { name: string; value: T; options: Array<{ value: T; label: string; hint: string }>; onPick: (v: T) => void; icon: typeof MessageCircle; title: string }) {
    const cur = options.find((o) => o.value === value);
    return (
      <div>
        <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <Icon size={15} className="text-fg-3" /> {title}
        </p>
        <div className="segment mt-2 flex w-full" role="radiogroup" aria-label={title}>
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} name={name} onClick={() => onPick(o.value)} className={cn("segment-item flex-1 text-[12.5px]", value === o.value && "segment-item-active")}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-fg-3" aria-live="polite">
          {cur?.hint}
        </p>
      </div>
    );
  }

  return (
    <section id="maxfiylik" className="card scroll-mt-28 p-5 sm:p-7" aria-labelledby="sec-privacy">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="sec-privacy" className="font-display text-[20px] font-semibold tracking-tight text-fg">
            Maxfiylik
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Kim sizga yozishi, kim postlaringizga izoh yozishi va onlayn holatingiz ko&apos;rinishi. Bloklanganlar hech qachon yoza olmaydi.</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", saving ? "bg-fg/6 text-fg-3" : "bg-success-soft text-success-text")} aria-live="polite">
          {saving ? "Saqlanmoqda…" : "Saqlangan"}
        </span>
      </div>
      <div className="mt-5 grid gap-5">
        <Segment name="dm" title="Kim menga yozishi mumkin" icon={MessageCircle} value={v.dmPolicy} options={DM_OPTIONS} onPick={(dmPolicy) => void save({ ...v, dmPolicy })} />
        <Segment name="comment" title="Kim postlarimga izoh yozadi" icon={MessagesSquare} value={v.commentPolicy} options={COMMENT_OPTIONS} onPick={(commentPolicy) => void save({ ...v, commentPolicy })} />
        <button
          type="button"
          role="switch"
          aria-checked={v.showOnline}
          onClick={() => void save({ ...v, showOnline: !v.showOnline })}
          className="flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] border border-line px-4 py-2.5 text-left transition hover:border-line-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg/6 text-fg-2">{v.showOnline ? <Eye size={16} /> : <EyeOff size={16} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-fg">Onlayn holatimni ko&apos;rsatish</span>
            <span className="block text-[12px] text-fg-3">{v.showOnline ? "Yashil nuqta va «oxirgi faollik» suhbatdoshlarga ko'rinadi" : "Yashirin — hech kim onlaynligingizni va oxirgi faolligingizni ko'rmaydi"}</span>
          </span>
          <span aria-hidden="true" className="switch" aria-checked={v.showOnline} />
        </button>
      </div>
      <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-fg-3">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" /> Kontaktlaringiz (telefon, Telegram, email) bu sozlamalardan qat&apos;i nazar faqat buyurtma qabul qilingach ko&apos;rinadi.
      </p>
    </section>
  );
}
