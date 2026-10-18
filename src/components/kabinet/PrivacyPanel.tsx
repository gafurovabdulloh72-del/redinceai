"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, MessageCircle, MessagesSquare, PauseCircle, ShieldCheck } from "lucide-react";
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
  { value: "following", label: "Obunalarim", hint: "Faqat siz obuna bo'lgan odamlar yangi suhbat ocha oladi" },
  { value: "none", label: "Hech kim", hint: "Yangi suhbatlar yopiq — mavjud suhbatlar davom etadi" },
];
const COMMENT_OPTIONS: Array<{ value: PrivacySettings["commentPolicy"]; label: string; hint: string }> = [
  { value: "all", label: "Hamma", hint: "Kirgan har bir foydalanuvchi postlaringizga izoh yoza oladi" },
  { value: "followers", label: "Obunachilarim", hint: "Faqat sizga obuna bo'lganlar" },
  { value: "none", label: "Hech kim", hint: "Izohlar yopiq (reaksiyalar qoladi)" },
];

/** Yorliq + izoh + o'ngda switch — AccountForm'dagi «Email bildirishnomalar» qatori bilan bir xil naqsh */
function SwitchRow({ id, icon: Icon, title, hint, checked, onChange, disabled }: { id: string; icon: typeof Eye; title: string; hint: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon size={18} className="shrink-0 text-fg-3" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span id={`${id}-label`} className="block text-[14px] font-semibold text-fg">
          {title}
        </span>
        <span id={`${id}-hint`} className="block text-[12px] text-fg-3">
          {hint}
        </span>
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} onClick={onChange} disabled={disabled} className="switch" />
    </div>
  );
}

/**
 * Kabinet → Xavfsizlik → Maxfiylik: kim yozishi mumkin, kim izoh yozadi, onlayn holat, hisob pauzasi (mutaxassis).
 * Har o'zgarish darhol saqlanadi; xato bo'lsa eski holat qaytadi.
 */
export function PrivacyPanel({ initial, paused: initialPaused = false, canPause = false }: { initial: PrivacySettings; paused?: boolean; canPause?: boolean }) {
  const { toast } = useToast();
  const [v, setV] = useState<PrivacySettings>(initial);
  const [paused, setPaused] = useState(initialPaused);
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
      if (my === seq.current) toast("Maxfiylik saqlandi");
    } catch (e) {
      setV(prev);
      toast(e instanceof Error ? e.message : "Saqlanmadi", "error");
    } finally {
      if (my === seq.current) setSaving(false);
    }
  }

  async function savePause(next: boolean) {
    const prev = paused;
    setPaused(next);
    setSaving(true);
    const my = ++seq.current;
    try {
      const res = await fetch("/api/account/pause", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: next }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Saqlanmadi");
      toast(next ? "Hisob pauzaga qo'yildi — profil katalogda ko'rinmaydi" : "Hisob qayta faollashtirildi");
    } catch (e) {
      setPaused(prev);
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
          <Icon size={18} className="text-fg-3" aria-hidden="true" /> {title}
        </p>
        <div className="segment mt-2 flex w-full" role="radiogroup" aria-label={title}>
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} data-active={value === o.value} name={name} onClick={() => onPick(o.value)} className="segment-item min-h-9 flex-1 text-[12.5px]">
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
    <section id="maxfiylik" className="card scroll-mt-28 p-5 sm:p-6" aria-labelledby="sec-privacy">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="sec-privacy" className="font-display text-[19px] font-semibold tracking-tight text-fg">
            Maxfiylik
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Kim yozadi, kim izoh qoldiradi, onlayn holat.</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", saving ? "bg-fg/6 text-fg-3" : "text-fg-4")} aria-live="polite">
          {saving ? "Saqlanmoqda…" : "Saqlangan"}
        </span>
      </div>
      <div className="mt-5 grid gap-5">
        <Segment name="dm" title="Kim menga yozishi mumkin" icon={MessageCircle} value={v.dmPolicy} options={DM_OPTIONS} onPick={(dmPolicy) => void save({ ...v, dmPolicy })} />
        <Segment name="comment" title="Kim postlarimga izoh yozadi" icon={MessagesSquare} value={v.commentPolicy} options={COMMENT_OPTIONS} onPick={(commentPolicy) => void save({ ...v, commentPolicy })} />
        <div className="divide-y divide-line border-t border-line">
          <SwitchRow
            id="pp-online"
            icon={v.showOnline ? Eye : EyeOff}
            title="Onlayn holatimni ko'rsatish"
            hint={v.showOnline ? "Yashil nuqta va «oxirgi faollik» suhbatdoshlarga ko'rinadi" : "Hech kim onlaynligingizni va oxirgi faolligingizni ko'rmaydi"}
            checked={v.showOnline}
            onChange={() => void save({ ...v, showOnline: !v.showOnline })}
          />
          {canPause && (
            <SwitchRow
              id="pp-pause"
              icon={PauseCircle}
              title="Hisobni pauza qilish"
              hint={paused ? "Profil katalog, xarita va qidiruvda ko'rinmaydi. Havola, mavjud buyurtmalar va chat ishlaydi" : "Ta'til yoki bandlikda profilni vaqtincha katalogdan yashiring — hech narsa o'chmaydi"}
              checked={paused}
              onChange={() => void savePause(!paused)}
            />
          )}
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-fg-3">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> Kontaktlaringiz (telefon, Telegram, email) bu sozlamalardan qat&apos;i nazar faqat buyurtma qabul qilingach ko&apos;rinadi. Bloklanganlar hech qachon yoza olmaydi.
      </p>
    </section>
  );
}
