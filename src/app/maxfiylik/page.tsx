import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, uzDate, type LegalSection } from "@/components/auth/LegalDocument";
import { SITE, TERMS_VERSION, VISIBILITY_FIELDS, VISIBILITY_LEVELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description: "Redince qanday shaxsiy ma'lumotlarni yig'adi, kim ko'radi (har bir maydon bo'yicha ko'rinish), qancha saqlaydi va ma'lumotlarni qanday yuklab olish yoki o'chirish mumkin.",
  alternates: { canonical: "/maxfiylik" },
};

const LEVEL_LABEL: Record<string, string> = Object.fromEntries(VISIBILITY_LEVELS.map((l) => [l.value, l.label]));
const LINK = "font-semibold text-accent-text underline underline-offset-2";

export default function MaxfiylikPage() {
  const sections: LegalSection[] = [
    {
      id: "umumiy",
      title: "Umumiy qoidalar",
      body: (
        <>
          <p>
            Ushbu siyosat {SITE.name} platformasi foydalanuvchilarining shaxsga doir ma&apos;lumotlari qanday yig&apos;ilishi, ishlatilishi, saqlanishi va himoya qilinishini tushuntiradi. Siyosat
            O&apos;zbekiston Respublikasining «Shaxsga doir ma&apos;lumotlar to&apos;g&apos;risida»gi Qonuni talablariga muvofiq tuzilgan va{" "}
            <Link href="/oferta" className={LINK}>
              Ommaviy oferta
            </Link>
            ning ajralmas qismi hisoblanadi.
          </p>
          <p>Biz faqat xizmat ko&apos;rsatish uchun zarur ma&apos;lumotlarni yig&apos;amiz va ularni hech qachon sotmaymiz.</p>
        </>
      ),
    },
    {
      id: "malumotlar",
      title: "Qanday ma'lumotlar yig'iladi",
      body: (
        <ul>
          <li>
            <strong>Hisob:</strong> ism, email, parol (faqat bcrypt hash ko&apos;rinishida), ixtiyoriy telefon raqam, jins va avatar.
          </li>
          <li>
            <strong>Mutaxassis profili:</strong> yo&apos;nalish, hudud va shahar, bio, ko&apos;nikmalar, uskunalar, narxlar va paketlar, portfolio, sertifikatlar, ish vaqti, ijtimoiy tarmoq havolalari.
          </li>
          <li>
            <strong>Faoliyat:</strong> buyurtmalar, e&apos;lonlar va takliflar, buyurtma chatidagi xabarlar va fayllar, sharhlar, sevimlilar, saqlangan qidiruvlar, bildirishnomalar.
          </li>
          <li>
            <strong>To&apos;lovlar:</strong> summa, holat, to&apos;lov tizimidagi tranzaksiya raqami. Karta raqami va CVV Platformaga kelmaydi — ularni Payme yoki Click o&apos;zi qayta ishlaydi. Pul
            chiqarish rekvizitlari shifrlangan (AES-256-GCM) holda saqlanadi, ro&apos;yxatlarda faqat maskalangan ko&apos;rinishi chiqadi.
          </li>
          <li>
            <strong>Texnik ma&apos;lumotlar:</strong> IP manzil (suiiste&apos;mollarga qarshi limitlar va xavfsizlik jurnali uchun), brauzer va qurilma turi. Faol sessiyalar ro&apos;yxatida IP manzil
            ochiq saqlanmaydi — faqat uning sha256 hashi.
          </li>
        </ul>
      ),
    },
    {
      id: "cookie",
      title: "Cookie va brauzer xotirasi",
      body: (
        <ul>
          <li>
            <strong>redince_session</strong> — kirish holatini saqlovchi himoyalangan (HttpOnly) cookie. «Meni eslab qolish» bilan 30 kun, aks holda brauzer yopilguncha amal qiladi.
          </li>
          <li>Tanlangan tema (yorug&apos;/qorong&apos;i) brauzeringizning lokal xotirasida saqlanadi.</li>
          <li>Reklama va kuzatuv (tracking) cookie&apos;lari hamda uchinchi tomon reklama tarmoqlari ishlatilmaydi.</li>
        </ul>
      ),
    },
    {
      id: "maqsadlar",
      title: "Ma'lumotlardan foydalanish maqsadlari",
      body: (
        <ul>
          <li>Hisob yaratish, kirish va hisobni himoya qilish (jumladan, ikki bosqichli himoya va qurilmalar ro&apos;yxati).</li>
          <li>Mutaxassislarni katalog, xarita va qidiruvda ko&apos;rsatish, buyurtma va to&apos;lovlarni amalga oshirish.</li>
          <li>Muhim hodisalar haqida bildirishnoma va email yuborish (buyurtma, to&apos;lov, xabar, obuna muddati).</li>
          <li>Firibgarlik, spam va suiiste&apos;mollarning oldini olish, nizolarni ko&apos;rib chiqish.</li>
          <li>Qonunchilik talablarini bajarish.</li>
        </ul>
      ),
    },
    {
      id: "korinish",
      title: "Kim nimani ko'radi",
      body: (
        <>
          <p>
            Mutaxassis har bir kontakt maydonining kimga ko&apos;rinishini o&apos;zi tanlaydi («Kabinet → Profil → Maxfiylik»). Darajalar:{" "}
            {VISIBILITY_LEVELS.map((l, i) => (
              <span key={l.value}>
                {i > 0 ? "; " : ""}
                <strong>{l.label}</strong> — {l.description.charAt(0).toLowerCase() + l.description.slice(1)}
              </span>
            ))}
            . Administratorlar nizo va shikoyatlarni ko&apos;rib chiqish uchun barcha maydonlarni ko&apos;ra oladi.
          </p>
          <div className="overflow-x-auto rounded-[16px] border border-line">
            <table className="w-full min-w-[320px] text-left text-[14px]">
              <caption className="sr-only">Maydonlarning standart ko&apos;rinishi</caption>
              <thead className="bg-surface-2 text-[12px] uppercase tracking-wide text-fg-3">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Maydon
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Standart ko&apos;rinish
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {VISIBILITY_FIELDS.map((f) => (
                  <tr key={f.key}>
                    <td className="px-4 py-2.5 text-fg">{f.label}</td>
                    <td className="px-4 py-2.5 text-fg-2">{LEVEL_LABEL[f.default] ?? f.default}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Ism, yo&apos;nalish, hudud, portfolio, narxlar va sharhlar ommaviy profilning bir qismi. Mutaxassis obunasi faol bo&apos;lmasa, profil katalogdan yashiriladi va kontaktlar ko&apos;rsatilmaydi.
            Mijozning ism va kontaktlari faqat u buyurtma bergan Mutaxassisga ko&apos;rinadi.
          </p>
        </>
      ),
    },
    {
      id: "uchinchi-shaxslar",
      title: "Uchinchi shaxslarga berish",
      body: (
        <>
          <p>Ma&apos;lumotlar faqat xizmat ko&apos;rsatish uchun zarur hajmda quyidagilarga uzatiladi:</p>
          <ul>
            <li>to&apos;lov tizimlari (Payme, Click) — to&apos;lov summasi va buyurtma raqami;</li>
            <li>email yuborish xizmati — email manzil va xat matni;</li>
            <li>hosting va ma&apos;lumotlar bazasi provayderlari — xizmat ishlashi uchun;</li>
            <li>vakolatli davlat organlari — faqat qonunda belgilangan asos va tartibda.</li>
          </ul>
          <p>Ma&apos;lumotlar reklama maqsadida sotilmaydi va uzatilmaydi.</p>
        </>
      ),
    },
    {
      id: "saqlash",
      title: "Saqlash muddatlari",
      body: (
        <ul>
          <li>Hisob va profil ma&apos;lumotlari — hisob o&apos;chirilguncha.</li>
          <li>Buyurtma va to&apos;lov tarixi — hisob o&apos;chirilgandan keyin ham anonim ko&apos;rinishda (ism va kontaktlarsiz) buxgalteriya va nizolar uchun saqlanadi.</li>
          <li>Xavfsizlik jurnali (kirishlar, muhim amallar) — 180 kun.</li>
          <li>Sessiyalar — muddati tugagach yoki yopilgach ko&apos;pi bilan 30 kun.</li>
          <li>Email tasdiqlash kodlari — 15 daqiqa, parol tiklash havolalari — 1 soat (bir martalik).</li>
          <li>Limit hisoblagichlari — tegishli vaqt oynasi tugaguncha.</li>
        </ul>
      ),
    },
    {
      id: "xavfsizlik",
      title: "Ma'lumotlar xavfsizligi",
      body: (
        <ul>
          <li>Parollar bcrypt bilan hashlanadi; ikki bosqichli himoya siri va pul chiqarish rekvizitlari AES-256-GCM bilan shifrlanadi; zaxira kodlari faqat hash ko&apos;rinishida saqlanadi.</li>
          <li>Barcha ulanishlar HTTPS orqali; sessiya cookie&apos;si JavaScript&apos;dan yashirin (HttpOnly) va saytlararo so&apos;rovlardan himoyalangan.</li>
          <li>Kirish urinishlari va boshqa sezgir amallar soni cheklangan; muhim amallar xavfsizlik jurnaliga yoziladi.</li>
          <li>Har bir qurilma sessiyasini «Kabinet → Xavfsizlik» bo&apos;limida ko&apos;rish va alohida yopish mumkin.</li>
        </ul>
      ),
    },
    {
      id: "huquqlar",
      title: "Sizning huquqlaringiz",
      body: (
        <ul>
          <li>
            <strong>Ko&apos;rish va eksport:</strong> «Kabinet → Xavfsizlik → Ma&apos;lumotlarimni yuklab olish» — barcha ma&apos;lumotlaringiz bitta JSON faylda.
          </li>
          <li>
            <strong>Tuzatish:</strong> ism, kontaktlar va profilni «Kabinet → Profil»da istalgan payt o&apos;zgartirasiz.
          </li>
          <li>
            <strong>Ko&apos;rinishni boshqarish:</strong> har bir kontakt maydoni uchun daraja tanlanadi.
          </li>
          <li>
            <strong>Email bildirishnomalardan voz kechish:</strong> «Kabinet → Profil → Email bildirishnomalar» tugmasi. Xavfsizlikka oid xatlar (parol tiklash, tasdiqlash kodi) baribir yuboriladi.
          </li>
          <li>
            <strong>O&apos;chirish:</strong> «Kabinet → Xavfsizlik → Akkauntni o&apos;chirish» — ism, email, telefon, profil va portfolio o&apos;chiriladi, buyurtma tarixi anonimlashtiriladi.
          </li>
        </ul>
      ),
    },
    {
      id: "bolalar",
      title: "Voyaga yetmaganlar",
      body: <p>Platforma 16 yoshga to&apos;lmagan shaxslarga mo&apos;ljallanmagan. Bunday foydalanuvchi ma&apos;lumotlari aniqlansa, hisob o&apos;chiriladi.</p>,
    },
    {
      id: "ozgarishlar",
      title: "Siyosatni o'zgartirish",
      body: (
        <p>
          Siyosat yangilansa, shu sahifada yangi versiya va sana e&apos;lon qilinadi, Kabinetda esa yangilangan hujjatni qabul qilish taklif etiladi. Joriy versiya: <strong>{TERMS_VERSION}</strong>.
        </p>
      ),
    },
    {
      id: "aloqa",
      title: "Aloqa",
      body: (
        <p>
          Shaxsiy ma&apos;lumotlarga oid savol va so&apos;rovlar uchun: Telegram{" "}
          <a href="https://t.me/redince" target="_blank" rel="noreferrer noopener" className={LINK}>
            @redince
          </a>
          . So&apos;rovlarga 30 kun ichida javob beramiz.
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      eyebrow="Huquqiy hujjat"
      title="Maxfiylik"
      accent="siyosati"
      version={TERMS_VERSION}
      effectiveDate={uzDate(TERMS_VERSION)}
      related={{ href: "/oferta", label: "Ommaviy oferta" }}
      intro={<p>Qanday ma&apos;lumotlar yig&apos;iladi, kim nimani ko&apos;radi, qancha saqlanadi va ularni qanday yuklab olish yoki o&apos;chirish mumkin — qisqa va aniq.</p>}
      sections={sections}
    />
  );
}
