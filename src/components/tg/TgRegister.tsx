"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui";
import { CraftStep, RoleStep, StepBar } from "@/components/auth/RegisterSteps";
import { useLocale } from "@/components/i18n/LocaleProvider";
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
  // Til — TgAppGate Telegram tiliga qarab LocaleProvider bilan o'raydi (ru → ruscha; RoleStep/CraftStep ham shu kontekstdan oladi)
  const til = useLocale();
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const EXP_RU: Record<string, string> = { junior: "Начинающий (до 1 года)", middle: "Средний (1–3 года)", senior: "Опытный (3–6 лет)", expert: "Эксперт (6+ лет)" };

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
      if (!r.ok || !j.ok) throw new Error(j.fields ? Object.values(j.fields)[0] : j.error || t("Hisob ochilmadi", "Не удалось создать аккаунт"));
      document.cookie = "tgapp=1; path=/; max-age=43200; samesite=lax";
      window.location.replace(j.data?.next || "/xush-kelibsiz");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Hisob ochilmadi", "Не удалось создать аккаунт"));
      setBusy(false);
    }
  }

  return (
    <div className="w-full text-left">
      <StepBar step={idx + 1} total={order.length} onBack={back} />

      {step === "role" && (
        <>
          <h2 className="mb-3 text-center font-display text-[18px] font-semibold text-fg">{t("Siz kimsiz?", "Кто вы?")}</h2>
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
            if (n.length < 2 || n.length > 60) return setErr(t("Ism 2–60 belgi bo'lsin", "Имя — от 2 до 60 символов"));
            if (/https?:\/\/|@|\d{5,}/.test(n)) return setErr(t("Ismda havola va raqam bo'lmasin", "В имени не должно быть ссылок и номеров"));
            setName(n);
            go(role === "specialist" ? "craft" : "phone");
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="tg-name" className="field-label">
              {t("Ism-familiyangiz", "Имя и фамилия")}
            </label>
            <div className="relative">
              <UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
              <input id="tg-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Dilnoza Karimova" maxLength={60} className="field w-full pl-10 text-[15px]" />
            </div>
            <p className="mt-1.5 text-[12px] text-fg-3">{t("Telegram'dagi nomingiz qo'yildi — xohlasangiz o'zgartiring.", "Подставили ваше имя из Telegram — при желании измените.")}</p>
          </div>
          {err && <p role="alert" className="text-[13px] font-semibold text-danger-text">{err}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full">
            {t("Davom etish", "Продолжить")} <ArrowRight size={18} />
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
            if (!category) return setErr(t("Kasbingizni tanlang", "Выберите профессию"));
            if (!region) return setErr(t("Hududni tanlang", "Выберите регион"));
            go("phone");
          }}
        />
      )}

      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.trim() && !normalizeUzPhone(phone)) return setErr(t("Raqam ko'rinishi: +998 90 123 45 67", "Формат номера: +998 90 123 45 67"));
            go("confirm");
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="tg-phone" className="field-label">
              {t("Telefon raqamingiz", "Номер телефона")} <span className="font-normal text-fg-3">({t("ixtiyoriy", "необязательно")})</span>
            </label>
            <div className="relative">
              <Phone size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
              <input id="tg-phone" autoFocus type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" className="field w-full pl-10 text-[15px]" dir="ltr" />
            </div>
            <p className="mt-1.5 text-[12px] text-fg-3">{t("Raqam hech kimga ko'rsatilmaydi — faqat platforma bilan aloqa uchun.", "Номер никому не показывается — только для связи с платформой.")}</p>
          </div>
          {err && <p role="alert" className="text-[13px] font-semibold text-danger-text">{err}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full">
            {t("Davom etish", "Продолжить")} <ArrowRight size={18} />
          </Button>
          <button type="button" onClick={() => { setPhone(""); go("confirm"); }} className="block w-full text-center text-[13.5px] font-semibold text-fg-3 hover:text-fg">
            {t("O'tkazib yuborish", "Пропустить")}
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <h2 className="font-display text-[18px] font-semibold text-fg">{t("Tekshiring", "Проверьте")}</h2>
          <dl className="card divide-y divide-line text-[14px]">
            <Row k={t("Ism", "Имя")} v={name} />
            <Row k={t("Rol", "Роль")} v={role === "specialist" ? t("Mutaxassis", "Специалист") : t("Mijoz", "Клиент")} />
            {role === "specialist" && (
              <>
                <Row k={t("Kasb", "Профессия")} v={CATEGORY_BY_SLUG[category ?? ""]?.name ?? "—"} />
                <Row k={t("Tajriba", "Опыт")} v={til === "ru" ? (EXP_RU[experience] ?? "—") : (EXPERIENCE_LEVELS.find((l) => l.value === experience)?.label ?? "—")} />
                <Row k={t("Hudud", "Регион")} v={REGION_BY_SLUG[region]?.name ?? "—"} />
              </>
            )}
            <Row k={t("Telefon", "Телефон")} v={phone.trim() || "—"} />
          </dl>
          {err && <p role="alert" className="text-[13px] font-semibold text-danger-text">{err}</p>}
          <Button type="button" variant="accent" size="lg" disabled={busy} onClick={() => void submit()} className="w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {t("Hisob ochish", "Создать аккаунт")}
          </Button>
          <p className="text-center text-[11.5px] leading-snug text-fg-4">
            {til === "ru" ? (
              <>
                Нажимая «Создать аккаунт», вы соглашаетесь с <a href="/oferta" className="underline">офертой</a> и <a href="/maxfiylik" className="underline">политикой конфиденциальности</a>.
              </>
            ) : (
              <>
                «Hisob ochish» bosilganda <a href="/oferta" className="underline">oferta</a> va <a href="/maxfiylik" className="underline">maxfiylik siyosati</a>ga rozilik bildirasiz.
              </>
            )}
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
