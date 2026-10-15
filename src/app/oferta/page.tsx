import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, uzDate, type LegalSection } from "@/components/auth/LegalDocument";
import { SITE, SUBSCRIPTION_PLANS, TERMS_VERSION } from "@/lib/constants";
import { AUTO_RELEASE_DAYS } from "@/lib/payments/service";
import { getSettings } from "@/lib/payments/settings";
import { planPrice } from "@/lib/subscriptions/access";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ommaviy oferta",
  description: "Kasb Egalari platformasidan foydalanish shartlari: platformaning roli, mutaxassislar obunasi, eskrou to'lovlar va komissiya, qaytarish va nizolar, taqiqlangan harakatlar, javobgarlik.",
  alternates: { canonical: "/oferta" },
};

/** Narxlar admin sozlamalaridan olinadi — soatiga bir marta yangilanadi */
export const revalidate = 3600;

export default async function OfertaPage() {
  const s = await getSettings();
  const price = formatPrice(s.subscriptionPrice);
  const trial = s.subscriptionTrialDays;
  const grace = s.subscriptionGraceDays;

  const sections: LegalSection[] = [
    {
      id: "umumiy",
      title: "Umumiy qoidalar",
      body: (
        <>
          <p>
            Ushbu hujjat {SITE.name} platformasi (keyingi o&apos;rinlarda — «Platforma») tomonidan istalgan shaxsga qaratilgan ommaviy oferta hisoblanadi va O&apos;zbekiston Respublikasi Fuqarolik
            kodeksining ommaviy oferta to&apos;g&apos;risidagi qoidalariga muvofiq tuzilgan.
          </p>
          <p>
            Platformada ro&apos;yxatdan o&apos;tish, «Oferta va Maxfiylik siyosatiga roziman» belgisini qo&apos;yish yoki Platforma xizmatlaridan amalda foydalanish ofertaning to&apos;liq va so&apos;zsiz
            qabul qilinishi (aksept) hisoblanadi. Agar shartlarga rozi bo&apos;lmasangiz, Platformadan foydalanmang.
          </p>
          <p>
            Shaxsga doir ma&apos;lumotlarni qayta ishlash tartibi alohida hujjatda — <Link href="/maxfiylik" className="font-semibold text-accent-text underline underline-offset-2">Maxfiylik siyosati</Link>da
            bayon etilgan va ushbu ofertaning ajralmas qismi hisoblanadi.
          </p>
        </>
      ),
    },
    {
      id: "atamalar",
      title: "Atamalar",
      body: (
        <ul>
          <li>
            <strong>Foydalanuvchi</strong> — Platformada hisob ochgan har qanday jismoniy yoki yuridik shaxs.
          </li>
          <li>
            <strong>Mijoz</strong> — xizmat buyurtma qiluvchi Foydalanuvchi.
          </li>
          <li>
            <strong>Mutaxassis</strong> — videograf, montajor, dizayner va boshqa ijodiy xizmatlarni taklif qiluvchi, ommaviy profil ochgan Foydalanuvchi.
          </li>
          <li>
            <strong>Buyurtma</strong> — Mijoz va Mutaxassis o&apos;rtasida Platforma orqali rasmiylashtirilgan ish (narx, muddat, natija).
          </li>
          <li>
            <strong>E&apos;lon</strong> — Mijoz joylagan ish tavsifi; <strong>Taklif</strong> — Mutaxassisning e&apos;longa yuborgan narx va muddat taklifi.
          </li>
          <li>
            <strong>Eskrou</strong> — Mijoz to&apos;lagan pulni ish qabul qilinguncha Platforma hisobida saqlab turish tartibi.
          </li>
          <li>
            <strong>Obuna</strong> — Mutaxassisning profilini katalogda ko&apos;rsatish va yangi buyurtmalar olish huquqi uchun oylik to&apos;lov.
          </li>
        </ul>
      ),
    },
    {
      id: "platforma-roli",
      title: "Platformaning roli",
      body: (
        <>
          <p>
            Platforma — Mijoz va Mutaxassisni bir-biri bilan tanishtiruvchi axborot vositachisi: katalog, xarita, qidiruv, e&apos;lonlar, buyurtma va xabar almashish vositalari hamda eskrou to&apos;lov
            imkoniyatini taqdim etadi.
          </p>
          <ul>
            <li>Platforma Mijoz va Mutaxassis o&apos;rtasidagi kelishuvning tarafi emas va xizmat sifati, muddati yoki natijasini kafolatlamaydi.</li>
            <li>Mutaxassis profilidagi ma&apos;lumotlar (portfolio, narx, tajriba) uchun profil egasi javob beradi. «Tasdiqlangan» belgisi faqat Platforma tekshiruvidan o&apos;tganini bildiradi.</li>
            <li>
              Tomonlar tanishgach Platformadan tashqarida (masalan, Telegram yoki telefon orqali) muloqot qilishlari va kelishishlari mumkin. Bunday kelishuvlar va to&apos;lovlar Platforma eskrou
              himoyasidan tashqarida bo&apos;ladi.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "hisob",
      title: "Ro'yxatdan o'tish va hisob xavfsizligi",
      body: (
        <>
          <ul>
            <li>Platformadan 16 yoshdan oshgan shaxslar foydalanishi mumkin; to&apos;lov va pul chiqarish uchun 18 yosh to&apos;lgan bo&apos;lishi lozim.</li>
            <li>Ro&apos;yxatdan o&apos;tishda haqiqiy ism, ishlaydigan email va (ixtiyoriy) telefon raqam kiritiladi. Bir shaxs bitta hisobdan foydalanadi.</li>
            <li>Parol va kirish kodlarini sir saqlash Foydalanuvchining zimmasida. Ikki bosqichli himoyani (autentifikator ilovasi) yoqish tavsiya etiladi, administratorlar uchun esa qat&apos;iy talab etiladi.</li>
            <li>Hisobga begona kirish sezilsa, darhol parolni o&apos;zgartirib, «Kabinet → Xavfsizlik» bo&apos;limida boshqa sessiyalarni yoping.</li>
          </ul>
        </>
      ),
    },
    {
      id: "obuna",
      title: "Mutaxassislar uchun obuna",
      body: (
        <>
          <p>
            Mijoz va Mutaxassis Platformada bir-birini topgach, ko&apos;pincha ishni boshqa kanallarda davom ettiradi. Shu sababli Platformaning asosiy daromadi komissiya emas, balki Mutaxassislarning
            oylik obunasi hisoblanadi. <strong>Mijozlar uchun Platforma bepul.</strong>
          </p>
          <ul>
            <li>
              Obuna narxi — <strong>oyiga {price}</strong>. Uzoq muddatga to&apos;lansa chegirma beriladi:{" "}
              {SUBSCRIPTION_PLANS.map((p, i) => (
                <span key={p.months}>
                  {i > 0 ? ", " : ""}
                  {p.months} oy — {formatPrice(planPrice(p.months, s))}
                  {p.discountPct ? ` (−${p.discountPct}%)` : ""}
                </span>
              ))}
              .
            </li>
            {trial > 0 && (
              <li>
                Yangi Mutaxassis uchun ro&apos;yxatdan o&apos;tgan kundan boshlab <strong>{trial} kunlik bepul sinov muddati</strong> amal qiladi.
              </li>
            )}
            <li>
              Obuna (yoki sinov) muddati tugagach {grace > 0 ? `${grace} kunlik imtiyozli davr beriladi — bu vaqtda profil odatdagidek ishlaydi.` : "imtiyozli davr berilmaydi."}
            </li>
            <li>
              Imtiyozli davr ham tugagach, obuna to&apos;lanmaguncha: profil katalog, xarita, qidiruv takliflari va hudud sahifalaridan yashiriladi; to&apos;g&apos;ridan-to&apos;g&apos;ri havola orqali
              ochilganda kontaktlar ko&apos;rsatilmaydi; yangi buyurtma qabul qilish va e&apos;lonlarga taklif yuborish to&apos;xtatiladi. Boshlangan buyurtmalar va eskroudagi to&apos;lovlar odatdagidek
              yakunlanadi.
            </li>
            <li>To&apos;lov Payme, Click yoki bank o&apos;tkazmasi (administrator tasdiqlaydi) orqali amalga oshiriladi. Avtomatik yechib olish yo&apos;q — har bir davr alohida to&apos;lanadi.</li>
            <li>Yangi to&apos;lov joriy muddat tugagan kundan (yoki muddat o&apos;tib ketgan bo&apos;lsa — to&apos;lov kunidan) boshlab davrni uzaytiradi. Muddat tugashidan 3 kun va 1 kun oldin eslatma yuboriladi.</li>
            <li>
              Boshlangan davr uchun to&apos;lov qaytarilmaydi, Platforma aybi bilan xizmat ko&apos;rsatilmagan holatlar bundan mustasno. Narx o&apos;zgarsa, kamida 14 kun oldin e&apos;lon qilinadi va
              allaqachon to&apos;langan davrga ta&apos;sir qilmaydi.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "eskrou",
      title: "Eskrou to'lovlar va komissiya",
      body: (
        <>
          <ol>
            <li>Mutaxassis buyurtma narxini belgilaydi (eng kam summa — {formatPrice(s.minOrderAmount)}), Mijoz uni Payme, Click yoki bank o&apos;tkazmasi orqali to&apos;laydi.</li>
            <li>To&apos;langan pul eskrouda saqlanadi — Mutaxassis ishni bajarayotgan paytda u hech kimga o&apos;tkazilmaydi.</li>
            <li>Mutaxassis ishni topshiradi, Mijoz natijani tekshirib «Qabul qilish»ni bosadi va pul Mutaxassis balansiga o&apos;tadi.</li>
            <li>
              Ish topshirilgandan keyin {AUTO_RELEASE_DAYS} kun ichida Mijoz na qabul qilsa, na nizo ochsa — pul avtomatik ravishda Mutaxassisga o&apos;tkaziladi.
            </li>
          </ol>
          <p>
            Eskrou orqali o&apos;tgan har bir buyurtmadan Platforma komissiyasi Mutaxassisga o&apos;tkaziladigan summadan ushlab qolinadi: yangi Mutaxassislar uchun {s.commissionPctNew}%, standart
            darajada {s.commissionPct}%, «Top mutaxassis»lar uchun {s.commissionPctTop}%. Shoshilinch buyurtma uchun Mijoz {s.urgentPct}% gacha ustama to&apos;lashi mumkin.
          </p>
          <p>Balansdan pul chiqarish — kamida {formatPrice(s.minPayout)}; so&apos;rov administrator tomonidan ko&apos;rib chiqiladi. To&apos;lov tizimlari komissiyasi (agar bo&apos;lsa) ularning tariflari bo&apos;yicha.</p>
        </>
      ),
    },
    {
      id: "qaytarish",
      title: "Bekor qilish, qaytarish va nizolar",
      body: (
        <>
          <ul>
            <li>Ish boshlanishidan oldin buyurtma bekor qilinsa, eskroudagi summa Mijozga to&apos;liq qaytariladi.</li>
            <li>Ish jarayonida kelishmovchilik chiqsa, istalgan tomon buyurtma sahifasida nizo ochishi mumkin. Nizo davomida pul eskrouda muzlatiladi.</li>
            <li>
              Administrator buyurtma tarixi, chatdagi yozishmalar va topshirilgan fayllarni ko&apos;rib chiqib qaror qabul qiladi: pulni to&apos;liq Mutaxassisga o&apos;tkazish, to&apos;liq Mijozga qaytarish
              yoki qisman bo&apos;lish. Shu sababli kelishuvlarni buyurtma chatida yozib qoldirish tavsiya etiladi.
            </li>
            <li>Qaytarilgan pul to&apos;lov qilingan usul orqali, to&apos;lov tizimi muddatlarida qaytariladi.</li>
            <li>Platformadan tashqarida amalga oshirilgan to&apos;lovlar bo&apos;yicha Platforma nizolarni ko&apos;rib chiqmaydi va pulni qaytarmaydi.</li>
          </ul>
        </>
      ),
    },
    {
      id: "taqiqlar",
      title: "Taqiqlangan harakatlar",
      body: (
        <ul>
          <li>Soxta profil, boshqa shaxs nomidan ish yuritish yoki bloklangandan keyin yangi hisob ochish.</li>
          <li>Boshqalarning ishini o&apos;z portfoliosi sifatida joylash, mualliflik huquqini buzish.</li>
          <li>Soxta sharh yozish yoki sharhni pul evaziga o&apos;zgartirishni talab qilish.</li>
          <li>Firibgarlik, oldindan pul olib ishni bajarmaslik, boshqa foydalanuvchilarni Platformadagi to&apos;lov o&apos;rniga «xavfsizroq» deb aldash.</li>
          <li>Haqoratli, kamsituvchi, zo&apos;ravonlikka chaqiruvchi, odobsiz yoki qonunga zid kontent.</li>
          <li>Spam, ommaviy xabar yuborish, boshqalarning shaxsiy ma&apos;lumotlarini ruxsatsiz yig&apos;ish.</li>
          <li>Platforma xavfsizligini buzishga, limitlarni chetlab o&apos;tishga yoki ma&apos;lumotlarni avtomatik yig&apos;ishga (scraping) urinish.</li>
        </ul>
      ),
    },
    {
      id: "kontent",
      title: "Kontent va intellektual mulk",
      body: (
        <>
          <p>
            Foydalanuvchi joylagan matn, rasm va videolarga bo&apos;lgan huquqlar uning o&apos;zida qoladi. Kontentni joylash orqali Foydalanuvchi Platformaga uni xizmat ko&apos;rsatish maqsadida (profilda
            ko&apos;rsatish, qidiruv, ijtimoiy tarmoqlardagi ulashish ko&apos;rinishi) bepul, noeksklyuziv tarzda foydalanish huquqini beradi.
          </p>
          <p>Buyurtma natijasiga bo&apos;lgan huquqlar to&apos;liq to&apos;lov amalga oshgach, agar tomonlar boshqacha kelishmagan bo&apos;lsa, Mijozga o&apos;tadi.</p>
        </>
      ),
    },
    {
      id: "javobgarlik",
      title: "Javobgarlikni cheklash",
      body: (
        <ul>
          <li>Platforma «boricha» (as is) taqdim etiladi; texnik nosozliklar, rejalashtirilgan ishlar va uchinchi tomon xizmatlari (to&apos;lov tizimlari, hosting) uzilishlari bo&apos;lishi mumkin.</li>
          <li>Platforma Foydalanuvchilar o&apos;rtasidagi bevosita kelishuvlar, Platformadan tashqaridagi to&apos;lovlar va ular natijasida yetgan zarar uchun javob bermaydi.</li>
          <li>Har qanday holatda Platformaning javobgarligi Foydalanuvchi oxirgi 3 oyda Platformaga to&apos;lagan obuna va komissiya summasidan oshmaydi.</li>
          <li>Fors-major holatlarida (tabiiy ofat, davlat organlari qarorlari, keng ko&apos;lamli tarmoq uzilishlari) tomonlar majburiyatlarni bajarmaganlik uchun javobgar emas.</li>
        </ul>
      ),
    },
    {
      id: "bloklash",
      title: "Hisobni bloklash va o'chirish",
      body: (
        <>
          <p>
            Ushbu shartlar buzilganda Platforma ogohlantirishsiz profilni yashirish, hisobni vaqtincha yoki butunlay bloklash huquqiga ega. Qoidabuzarlik tufayli bloklanganda to&apos;langan obunaning
            qolgan qismi qaytarilmaydi.
          </p>
          <p>
            Foydalanuvchi istalgan vaqtda «Kabinet → Xavfsizlik» bo&apos;limida hisobini o&apos;chirishi mumkin. Eskroudagi to&apos;lovlar yoki kutilayotgan pul chiqarish so&apos;rovi yakunlanmaguncha
            o&apos;chirish amalga oshmaydi.
          </p>
        </>
      ),
    },
    {
      id: "ozgarishlar",
      title: "Shartlarni o'zgartirish",
      body: (
        <p>
          Platforma ushbu shartlarni o&apos;zgartirishi mumkin. Yangi versiya shu sahifada sana va versiya raqami bilan e&apos;lon qilinadi, Kabinetda esa yangilangan shartlarni qabul qilish taklif
          etiladi. Yangi versiya kuchga kirgandan keyin Platformadan foydalanishni davom ettirish uni qabul qilish hisoblanadi. Joriy versiya: <strong>{TERMS_VERSION}</strong>.
        </p>
      ),
    },
    {
      id: "aloqa",
      title: "Nizolarni hal qilish va aloqa",
      body: (
        <>
          <p>
            Ushbu oferta O&apos;zbekiston Respublikasi qonunchiligiga muvofiq tartibga solinadi. Kelishmovchiliklar avvalo muzokaralar yo&apos;li bilan, kelishuvga erishilmasa — qonunchilikda belgilangan
            tartibda sudda hal qilinadi.
          </p>
          <p>
            Savollar va murojaatlar uchun: Telegram{" "}
            <a href="https://t.me/kasb_egalari" target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-text underline underline-offset-2">
              @kasb_egalari
            </a>
            . Hisob va buyurtmalarga oid murojaatlarni Kabinet orqali yuborish tavsiya etiladi.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalDocument
      eyebrow="Huquqiy hujjat"
      title="Ommaviy"
      accent="oferta"
      version={TERMS_VERSION}
      effectiveDate={uzDate(TERMS_VERSION)}
      related={{ href: "/maxfiylik", label: "Maxfiylik siyosati" }}
      intro={
        <p>
          {SITE.name}&apos;dan foydalanish shartlari: platforma nima qiladi va nima qilmaydi, mutaxassislar obunasi ({price}/oy), eskrou to&apos;lovlar, komissiya, qaytarish va nizolar tartibi.
        </p>
      }
      sections={sections}
    />
  );
}
