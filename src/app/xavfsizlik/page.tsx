import type { Metadata } from "next";
import Link from "next/link";
import { Bug, HeartHandshake, Send, Trophy } from "lucide-react";
import { SITE } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";

/**
 * XAVFSIZLIK — KAMCHILIK HAQIDA XABAR BERISH (2026-11-10): brauzer konsolidagi ogohlantirish, `/.well-known/security.txt`
 * va footer shu yerga havola beradi. Maqsad: kamchilik topgan odam saytni buzmasdan, bizga yozsin.
 *
 * QOIDA (egasi talabi): bu sahifa himoyamiz QANDAY ishlashini AYTMAYDI — hech qanday texnik tafsilot, «bizda … bor»
 * ro'yxati, bloklash/kuzatuv haqida gap yo'q (hujumchiga xarita chizib bermaymiz). Va'dalar ham minimal:
 * pul mukofoti yoki huquqiy kafolat yozilmagan — egasi qaror qilsa, o'zi qo'shadi.
 */
type T2 = { uz: string; ru: string };

const TXT = {
  metaTitle: { uz: "Xavfsizlik — kamchilik haqida xabar berish", ru: "Безопасность — сообщить об уязвимости" },
  metaDesc: { uz: "Kasb Egalari'da kamchilik topdingizmi? Iltimos, buzib kirmang — bizga yozing, rahmat aytamiz.", ru: "Нашли уязвимость на Kasb Egalari? Пожалуйста, не взламывайте — напишите нам, скажем спасибо." },
  title: { uz: "Xavfsizlik", ru: "Безопасность" },
  lead: { uz: "Iltimos, bizni buzib kirmang 🙏 Yaxshisi — birga mustahkamlaymiz.", ru: "Пожалуйста, не взламывайте нас 🙏 Лучше — укрепим вместе." },
  intro: {
    uz: "Foydalanuvchilarimiz ma'lumotini jiddiy himoya qilamiz. Agar kamchilik topsangiz — undan foydalanmasdan bizga xabar bering: tuzatamiz va sizga minnatdorchilik bildiramiz.",
    ru: "Мы серьёзно защищаем данные пользователей. Если вы нашли уязвимость — не используйте её, а сообщите нам: исправим и поблагодарим вас.",
  },
  reportTitle: { uz: "Kamchilik topdingizmi?", ru: "Нашли уязвимость?" },
  reportBody: {
    uz: "Bizga Telegram orqali yozing: qaysi sahifa, qanday takrorlash mumkin va nima ko'rindi. Skrinshot bo'lsa — yanada yaxshi.",
    ru: "Напишите нам в Telegram: какая страница, как воспроизвести и что вы увидели. Скриншот — ещё лучше.",
  },
  reportBtn: { uz: "Telegram orqali yozish", ru: "Написать в Telegram" },
  reportNote: { uz: "Imkon qadar tez javob beramiz.", ru: "Ответим как можно скорее." },
  rulesTitle: { uz: "Iltimosimiz", ru: "Наша просьба" },
  rules: [
    { uz: "Faqat o'z hisobingiz bilan sinang — boshqalarning ma'lumotini ochmang, o'zgartirmang, o'chirmang.", ru: "Проверяйте только на своём аккаунте — не открывайте, не меняйте и не удаляйте чужие данные." },
    { uz: "Saytni ishdan chiqaradigan usullar, spam va ommaviy avtomatik skanerlashdan foydalanmang.", ru: "Не используйте методы, выводящие сайт из строя, спам и массовое автоматическое сканирование." },
    { uz: "Kamchilikni topgach to'xtang va boshqalarga oshkor etmang — avval bizga tuzatish uchun vaqt bering.", ru: "Найдя уязвимость — остановитесь и не раскрывайте её другим: дайте нам время на исправление." },
  ] as T2[],
  thanksTitle: { uz: "Rahmat aytamiz", ru: "Скажем спасибо" },
  thanksBody: {
    uz: "Har bir xabarni o'qiymiz. Halol xabar bergan odamning ismini — o'zi xohlasa — shu yerga yozib qo'yamiz.",
    ru: "Мы читаем каждое сообщение. Имя того, кто честно сообщил об уязвимости, — если он захочет — появится здесь.",
  },
  fameEmpty: { uz: "Hozircha bo'sh — birinchi bo'ling!", ru: "Пока пусто — станьте первым!" },
  userTitle: { uz: "Oddiy foydalanuvchimisiz?", ru: "Вы обычный пользователь?" },
  userBody: { uz: "Hisobingizni himoyalash uchun ikki bosqichli kirishni yoqing va begona qurilmalarni tekshiring.", ru: "Чтобы защитить аккаунт, включите двухфакторный вход и проверьте чужие устройства." },
  userBtn: { uz: "Kabinet → Xavfsizlik", ru: "Кабинет → Безопасность" },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: TXT.metaTitle[til], description: TXT.metaDesc[til], alternates: { canonical: "/xavfsizlik" }, other: { "m-title": TXT.title[til] } };
}

export default async function SecurityPage() {
  const til = await getLocale();
  const t = (e: T2) => e[til];
  const card = "card p-5 sm:p-6";
  const h2 = "flex items-center gap-2 text-[17px] font-semibold text-fg";
  const li = "flex gap-2.5 text-[14px] leading-relaxed text-fg-2";
  const dot = "mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent";
  return (
    <div className="container-x animate-fade-up">
      <div className="mx-auto max-w-3xl">
        <header>
          <h1 className="display-xl text-fg max-sm:hidden">{t(TXT.title)}</h1>
          <p className="mt-2 text-[19px] font-semibold leading-snug text-fg sm:text-[22px]">{t(TXT.lead)}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{t(TXT.intro)}</p>
        </header>

        <div className="mt-6 grid gap-4">
          <section className={`${card} border-accent/30`} aria-labelledby="xavf-xabar">
            <h2 id="xavf-xabar" className={h2}>
              <Bug size={18} className="text-accent" /> {t(TXT.reportTitle)}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{t(TXT.reportBody)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href={SITE.supportTelegram} target="_blank" rel="noreferrer noopener" className="btn-accent inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold">
                <Send size={15} /> {t(TXT.reportBtn)}
              </a>
              <span className="text-[12.5px] text-fg-3">{t(TXT.reportNote)}</span>
            </div>
          </section>

          <section className={card} aria-labelledby="xavf-qoida">
            <h2 id="xavf-qoida" className={h2}>
              <HeartHandshake size={18} className="text-fg-3" /> {t(TXT.rulesTitle)}
            </h2>
            <ul className="mt-3 grid gap-2.5">
              {TXT.rules.map((r, i) => (
                <li key={i} className={li}>
                  <span className={dot} aria-hidden /> {t(r)}
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-labelledby="xavf-zal">
            <h2 id="xavf-zal" className={h2}>
              <Trophy size={18} className="text-fg-3" /> {t(TXT.thanksTitle)}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{t(TXT.thanksBody)}</p>
            <p className="mt-3 rounded-[12px] border border-dashed border-line px-4 py-4 text-center text-[13.5px] leading-relaxed text-fg-3">{t(TXT.fameEmpty)}</p>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-fg/[0.04] px-5 py-4" aria-labelledby="xavf-user">
            <div className="min-w-0">
              <h2 id="xavf-user" className="text-[14.5px] font-semibold text-fg">
                {t(TXT.userTitle)}
              </h2>
              <p className="mt-0.5 text-[13px] text-fg-2">{t(TXT.userBody)}</p>
            </div>
            <Link href="/kabinet/xavfsizlik" className="inline-flex h-10 shrink-0 items-center rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg hover:border-fg">
              {t(TXT.userBtn)}
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
