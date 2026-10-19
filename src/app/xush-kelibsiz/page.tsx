import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Compass, ImagePlus, Sparkles, UserRound, UsersRound, Briefcase } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Xush kelibsiz",
  robots: { index: false, follow: false },
};

/**
 * Ro'yxatdan o'tgan (yoki Google bilan birinchi kirgan) foydalanuvchi uchun tanishuv ekrani.
 * Rolga mos 3 ta keyingi qadam + lentaga o'tish. Instagram/LinkedIn uslubidagi onboarding.
 */
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/kirish?next=/xush-kelibsiz");

  const isSpecialist = user.role === "specialist" || user.role === "admin";
  const firstName = user.name.split(" ")[0] || user.name;

  const steps = isSpecialist
    ? [
        { href: "/kabinet/profil", icon: UserRound, title: "Profilni to'ldiring", text: "Bio, ko'nikmalar, narx va aloqa — mijozlar sizni shundan topadi." },
        { href: "/kabinet/postlar", icon: ImagePlus, title: "Birinchi ishni joylang", text: "Portfolio va postlar — ishlaringizni ko'rsating, obunachilar yig'ing." },
        { href: "/jamoalar", icon: UsersRound, title: "Hamjamiyatga qo'shiling", text: "Kasbdoshlar bilan tanishing, rasmiy kanalda yangiliklarni kuzating." },
      ]
    : [
        { href: "/mutaxassislar", icon: Compass, title: "Mutaxassis toping", text: "Videograf, montajchi, dizayner — ishingizga mos ijodkorni tanlang." },
        { href: "/ishlar/yangi", icon: Briefcase, title: "Ish e'lon qiling", text: "Loyihangizni yozing — mutaxassislar o'zlari taklif yuboradi." },
        { href: "/jamoalar", icon: UsersRound, title: "Hamjamiyatni kuzating", text: "Yangi ishlar, efirlar va foydali maslahatlar — bir joyda." },
      ];

  return (
    <div className="container-x animate-fade-up max-w-2xl py-6 sm:py-10">
      <span className="eyebrow mb-3 inline-flex items-center gap-1.5">
        <Sparkles size={13} className="text-accent" /> Kasb Egalari
      </span>
      <h1 className="display-xl text-fg">
        Xush kelibsiz, {firstName}!
      </h1>
      <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-fg-2">
        {isSpecialist
          ? "Hisobingiz tayyor. Profilni to'ldirsangiz, mijozlar sizni tezroq topadi va birinchi buyurtmalar kela boshlaydi."
          : "Hisobingiz tayyor. Endi mutaxassis topishingiz, ish e'lon qilishingiz yoki hamjamiyatni kuzatishingiz mumkin."}
      </p>

      <ol className="mt-7 grid gap-3 sm:grid-cols-1">
        {steps.map((s, i) => (
          <li key={s.href} className="stagger" style={{ "--i": i } as React.CSSProperties}>
            <Link
              href={s.href}
              className="card card-hover group flex items-center gap-4 p-4 sm:p-5"
            >
              <span className="icon-tile-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
                <s.icon size={20} className="text-fg" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white tabular-nums">{i + 1}</span>
                  {s.title}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-fg-3">{s.text}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href="/" className="btn-accent inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[14.5px] font-semibold">
          Lentaga o'tish <ArrowRight size={17} />
        </Link>
        <Link href="/kabinet" className="inline-flex h-11 items-center rounded-[14px] px-4 text-[14px] font-semibold text-fg-2 transition hover:text-fg">
          Kabinet
        </Link>
      </div>
    </div>
  );
}
