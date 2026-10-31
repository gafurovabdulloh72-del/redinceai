"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui";
import { CraftStep, RoleStep, StepBar } from "@/components/auth/RegisterSteps";
import { CATEGORY_BY_SLUG } from "@/lib/categories";
import { EXPERIENCE_LEVELS, REGION_BY_SLUG } from "@/lib/constants";
import { normalizeUzPhone } from "@/lib/utils";

type Role = "client" | "specialist";
type Step = "role" | "name" | "craft" | "phone" | "confirm";

/**
 * Mini App ichida ro'yxatdan o'tish — savollar KETMA-KET (bitta ekranda bitta savol), botdagi savol-javob bilan bir xil:
 * rol → ism (Telegram nomi oldindan to'ldirilgan) → (mutaxassis: kasb, tajriba, hudud) → telefon (ixtiyoriy) → tasdiqlash.
 * Yakunda POST /api/tg/auth {register} → hisob + sessiya → /xush-kelibsiz.
 */
export function TgRegister({ tgName, initData, to, onBack }: { tgName: string; initData: string; to: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState(tgName);
  const [category, setCategory] = useState<string | null>(null);
  const [experience, setExperience] = useState("middle");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const order: Step[] = role === "specialist" ? ["role", "name", "craft", "phone", "confirm"] : ["role", "name", "phone", "confirm"];
  const idx = order.indexOf(step);
  const back = () => (idx <= 0 ? onBack() : setStep(order[idx - 1]));
  const go = (s: Step) => {
    setErr(null);
    setStep(s);
  };

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/tg/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, to, register: { role, name: name.trim(), phone: phone.trim() ? (normalizeUzPhone(phone) ?? phone.trim()) : "", ...(role === "specialist" ? { category, experience, region } : {}) } }),
      });
      const j = (await r.json()) as { ok: boolean; data?: { next?: string }; error?: string; fields?: Record<string, string> };
      if (!r.ok || !j.ok) throw new Error(j.fields ? Object.values(j.fields)[0] : j.error || "Hisob ochilmadi");
      document.cookie = "tgapp=1; path=/; max-age=43200; samesite=lax";
      window.location.replace(j.data?.next || "/xush-kelibsiz");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hisob ochilmadi");
      setBusy(false);
    }
  }

  return (
    <div className="w-full text-left">
      <StepBar step={idx + 1} total={order.length} onBack={back} />

      {step === "role" && (
        <>
          <h2 className="mb-3 text-center font-display text-[18px] font-semibold text-fg">Siz kimsiz?</h2>
          <RoleStep
            role={role}
            onPick={(r) => {
              setRole(r);
              go("name");
            }}
          />
        </>
      )}

      {step === "name" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.replace(/\s+/g, " ").trim();
            if (n.length < 2 || n.length > 60) return setErr("Ism 2–60 belgi bo'lsin");
            if (/https?:\/\/|@|\d{5,}/.test(n)) return setErr("Ismda havola va raqam bo'lmasin");
            setName(n);
            go(role === "specialist" ? "craft" : "phone");
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="tg-name" className="field-label">
              Ism-familiyangiz
            </label>
            <div className="relative">
              <UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
              <input id="tg-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Dilnoza Karimova" maxLength={60} className="field w-full pl-10 text-[15px]" />
            </div>
            <p className="mt-1.5 text-[12px] text-fg-3">Telegram'dagi nomingiz qo'yildi — xohlasangiz o'zgartiring.</p>
          </div>
          {err && <p role="alert" className="text-[13px] font-semibold text-danger-text">{err}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full">
            Davom etish <ArrowRight size={18} />
          </Button>
        </form>
      )}

      {step === "craft" && (
        <CraftStep
          category={category}
          onCategory={setCategory}
          experience={experience}
          onExperience={setExperience}
          region={region}
          onRegion={setRegion}
          error={err}
          onNext={() => {
            if (!category) return setErr("Kasbingizni tanlang");
            if (!region) return setErr("Hududni tanlang");
            go("phone");
          }}
        />
      )}

      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.trim() && !normalizeUzPhone(phone)) return setErr("Raqam ko'rinishi: +998 90 123 45 67");
            go("confirm");
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="tg-phone" className="field-label">
              Telefon raqamingiz <span className="font-normal text-fg-3">(ixtiyoriy)</span>
            </label>
            <div className="relative">
              <Phone size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
              <input id="tg-phone" autoFocus type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" className="field w-full pl-10 text-[15px]" dir="ltr" />
            </div>
            <p className="mt-1.5 text-[12px] text-fg-3">Raqam hech kimga ko'rsatilmaydi — faqat platforma bilan aloqa uchun.</p>
          </div>
          {err && <p role="alert" className="text-[13px] font-semibold text-danger-text">{err}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full">
            Davom etish <ArrowRight size={18} />
          </Button>
          <button type="button" onClick={() => { setPhone(""); go("confirm"); }} className="block w-full text-center text-[13.5px] font-semibold text-fg-3 hover:text-fg">
            O&apos;tkazib yuborish
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <h2 className="font-display text-[18px] font-semibold text-fg">Tekshiring</h2>
          <dl className="card divide-y divide-line text-[14px]">
            <Row k="Ism" v={name} />
            <Row k="Rol" v={role === "specialist" ? "Mutaxassis" : "Mijoz"} />
            {role === "specialist" && (
              <>
                <Row k="Kasb" v={CATEGORY_BY_SLUG[category ?? ""]?.name ?? "—"} />
                <Row k="Tajriba" v={EXPERIENCE_LEVELS.find((l) => l.value === experience)?.label ?? "—"} />
                <Row k="Hudud" v={REGION_BY_SLUG[region]?.name ?? "—"} />
              </>
            )}
            <Row k="Telefon" v={phone.trim() || "—"} />
          </dl>
          {err && <p role="alert" className="text-[13px] font-semibold text-danger-text">{err}</p>}
          <Button type="button" variant="accent" size="lg" disabled={busy} onClick={() => void submit()} className="w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Hisob ochish
          </Button>
          <p className="text-center text-[11.5px] leading-snug text-fg-4">
            «Hisob ochish» bosilganda <a href="/oferta" className="underline">oferta</a> va <a href="/maxfiylik" className="underline">maxfiylik siyosati</a>ga rozilik bildirasiz.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-2.5">
      <dt className="text-fg-3">{k}</dt>
      <dd className="text-right font-semibold text-fg">{v}</dd>
    </div>
  );
}
