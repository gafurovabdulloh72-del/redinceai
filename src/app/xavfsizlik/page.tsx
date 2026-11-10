import type { Metadata } from "next";
import Link from "next/link";
import { Bug, HeartHandshake, Lock, Send, ShieldCheck, Trophy } from "lucide-react";
import { SITE } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";

/**
 * XAVFSIZLIK VA MAS'ULIYATLI XABAR BERISH (2026-11-10): tuzoq (honeypot) hazil sahifalari, brauzer konsolidagi
 * ogohlantirish va `/.well-known/security.txt` shu yerga havola beradi. Maqsad: kamchilik topgan odam saytni buzmasdan,
 * bizga yozsin. Pul mukofoti VA'DA QILINMAYDI (egasi qaror qilsa — shu yerga yoziladi); «Shon-sharaf zali» qo'lda to'ldiriladi.
 */
type T2 = { uz: string; ru: string };

const TXT = {
  metaTitle: { uz: "Xavfsizlik — kamchilik haqida xabar berish", ru: "Безопасность — сообщить об уязвимости" },
  metaDesc: { uz: "Kasb Egalari'da kamchilik topdingizmi? Iltimos, buzib kirmang — bizga yozing: rahmat aytamiz va ismingizni Shon-sharaf zaliga yozamiz.", ru: "Нашли уязвимость на Kasb Egalari? Пожалуйста, не взламывайте — напишите нам: скажем спасибо и добавим вас в Зал славы." },
  title: { uz: "Xavfsizlik", ru: "Безопасность" },
  lead: { uz: "Iltimos, bizni buzib kirmang 🙏 Yaxshisi — birga mustahkamlaymiz.", ru: "Пожалуйста, не взламывайте нас 🙏 Лучше — укрепим вместе." },
  intro: {
    uz: "Biz kichik jamoamiz va foydalanuvchilarimiz ma'lumotini jiddiy himoya qilamiz. Hech bir tizim mukammal emas: agar kamchilik topsangiz, undan foydalanmasdan bizga xabar bering — tez tuzatamiz va sizga minnatdorchilik bildiramiz.",
    ru: "Мы небольшая команда и серьёзно защищаем данные пользователей. Идеальных систем не бывает: если вы нашли уязвимость — не используйте её, а сообщите нам. Мы быстро исправим и поблагодарим вас.",
  },
  reportTitle: { uz: "Kamchilik topdingizmi?", ru: "Нашли уязвимость?" },
  reportBody: {
    uz: "Bizga Telegram orqali yozing. Xabarda: qaysi sahifa yoki so'rov, qanday takrorlash mumkin (qadamlar), nima ko'rindi. Skrinshot yoki qisqa video bo'lsa — yanada yaxshi.",
    ru: "Напишите нам в Telegram. В сообщении укажите: какая страница или запрос, как воспроизвести (шаги), что вы увидели. Скриншот или короткое видео — ещё лучше.",
  },
  reportBtn: { uz: "Telegram orqali yozish", ru: "Написать в Telegram" },
  reportNote: { uz: "Imkon qadar tez javob beramiz.", ru: "Ответим как можно скорее." },
  rulesTitle: { uz: "Halol tekshirish qoidalari", ru: "Правила честного исследования" },
  rules: [
    { uz: "Faqat o'z hisobingiz va o'z ma'lumotlaringiz bilan sinang — boshqalarning ma'lumotini ochmang, o'zgartirmang, o'chirmang.", ru: "Проверяйте только на своём аккаунте и своих данных — не открывайте, не меняйте и не удаляйте чужие." },
    { uz: "Saytni ishdan chiqaradigan (DoS), spam yoki ommaviy avtomatik skanerlash usullaridan foydalanmang.", ru: "Не используйте методы, выводящие сайт из строя (DoS), спам и массовое автоматическое сканирование." },
    { uz: "Kamchilikni topgach to'xtang: uni chuqurroq «ekspluatatsiya» qilmang va boshqalarga oshkor etmang — avval bizga tuzatish uchun vaqt bering (90 kungacha).", ru: "Найдя уязвимость — остановитесь: не эксплуатируйте её глубже и не раскрывайте другим, дайте нам время на исправление (до 90 дней)." },
    { uz: "Foydalanuvchilarni aldash (fishing, ijtimoiy injeneriya) va jismoniy kirish — qamrovdan tashqarida.", ru: "Обман пользователей (фишинг, социальная инженерия) и физический доступ — вне области исследования." },
  ] as T2[],
  promiseTitle: { uz: "Biz nima va'da qilamiz", ru: "Что мы обещаем" },
  promises: [
    { uz: "Qoidalarga amal qilgan tadqiqotchiga nisbatan huquqiy da'vo qilmaymiz.", ru: "Не предъявляем юридических претензий исследователю, соблюдающему правила." },
    { uz: "Xabaringizni o'qiymiz, holatini aytib turamiz va tuzatilgach xabar beramiz.", ru: "Прочитаем сообщение, будем держать в курсе и сообщим, когда исправим." },
    { uz: "Xohlasangiz, ismingizni «Shon-sharaf zali»ga yozamiz. Hozircha pul mukofoti yo'q — lekin rahmat va choy bizdan ☕", ru: "Если захотите — добавим ваше имя в «Зал славы». Денежного вознаграждения пока нет — но спасибо и чай с нас ☕" },
  ] as T2[],
  howTitle: { uz: "Saytni qanday himoya qilamiz", ru: "Как мы защищаем сайт" },
  how: [
    { uz: "Parollar bir tomonlama xeshlanadi; ikki bosqichli kirish (2FA) va faol qurilmalarni boshqarish bor.", ru: "Пароли хешируются необратимо; есть двухфакторный вход (2FA) и управление активными устройствами." },
    { uz: "Telefon va boshqa aloqa ma'lumotlari bazada shifrlangan holda saqlanadi.", ru: "Телефоны и другие контакты хранятся в базе в зашифрованном виде." },
    { uz: "Yopiq fayl va pullik videolar faqat ruxsati bor foydalanuvchiga, vaqtinchalik havola bilan beriladi.", ru: "Закрытые файлы и платные видео выдаются только тем, у кого есть доступ, по временной ссылке." },
    { uz: "Shubhali so'rovlar cheklanadi; saytda tuzoqlar bor 🪤 — avtomatik skanerlar bloklanadi. Qo'lda va ehtiyotkorlik bilan tekshiring.", ru: "Подозрительные запросы ограничиваются; на сайте есть ловушки 🪤 — автоматические сканеры блокируются. Проверяйте вручную и аккуратно." },
  ] as T2[],
  fameTitle: { uz: "Shon-sharaf zali", ru: "Зал славы" },
  fameEmpty: { uz: "Hozircha bo'sh — birinchi bo'ling! Kamchilik haqida halol xabar bergan odamlarning ismi shu yerda turadi.", ru: "Пока пусто — станьте первым! Здесь будут имена тех, кто честно сообщил об уязвимости." },
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

          <section className={card} aria-labelledby="xavf-vada">
            <h2 id="xavf-vada" className={h2}>
              <ShieldCheck size={18} className="text-fg-3" /> {t(TXT.promiseTitle)}
            </h2>
            <ul className="mt-3 grid gap-2.5">
              {TXT.promises.map((r, i) => (
                <li key={i} className={li}>
                  <span className={dot} aria-hidden /> {t(r)}
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-labelledby="xavf-himoya">
            <h2 id="xavf-himoya" className={h2}>
              <Lock size={18} className="text-fg-3" /> {t(TXT.howTitle)}
            </h2>
            <ul className="mt-3 grid gap-2.5">
              {TXT.how.map((r, i) => (
                <li key={i} className={li}>
                  <span className={dot} aria-hidden /> {t(r)}
                </li>
              ))}
            </ul>
          </section>

          <section className={card} aria-labelledby="xavf-zal">
            <h2 id="xavf-zal" className={h2}>
              <Trophy size={18} className="text-fg-3" /> {t(TXT.fameTitle)}
            </h2>
            <p className="mt-2 rounded-[12px] border border-dashed border-line px-4 py-5 text-center text-[13.5px] leading-relaxed text-fg-3">{t(TXT.fameEmpty)}</p>
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
