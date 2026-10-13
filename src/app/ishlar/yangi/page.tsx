import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, ListChecks, MessageSquareText, ShieldCheck } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui";
import { JobForm, type JobFormPrefill } from "@/components/jobs/JobForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { firstName } from "@/lib/jobs/format";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yangi e'lon",
  description: "Loyihangizni joylang — mos mutaxassislar narx va muddat bilan taklif yuborishadi.",
  robots: { index: false, follow: false },
};

const STEPS = [
  { icon: BriefcaseBusiness, t: "E'lon joylang", d: "Vazifa, byudjet va muddatni yozing — 2 daqiqa." },
  { icon: MessageSquareText, t: "Takliflarni oling", d: "Mutaxassislar narx, muddat va xat bilan javob beradi." },
  { icon: ShieldCheck, t: "Tanlang va xavfsiz to'lang", d: "Pul eskrouda — ishni qabul qilganingizda o'tadi." },
];

type PrefillParams = { category?: string | string[]; region?: string | string[]; remote?: string | string[]; budgetMax?: string | string[]; deadline?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sehrgar / «obuna faol emas» havolasidagi parametrlar — faqat ma'lum qiymatlar qabul qilinadi, qolgani e'tiborsiz */
function parsePrefill(sp: PrefillParams): { prefill: JobFormPrefill | undefined; query: string } {
  const out: JobFormPrefill = {};
  const q = new URLSearchParams();
  const category = one(sp.category);
  if (category && CATEGORIES.some((c) => c.slug === category)) {
    out.category = category;
    q.set("category", category);
  }
  const region = one(sp.region);
  if (region && REGIONS.some((r) => r.slug === region)) {
    out.regionSlug = region;
    q.set("region", region);
  }
  if (one(sp.remote) === "1") {
    out.remote = true;
    q.set("remote", "1");
  }
  const budgetMax = Number(one(sp.budgetMax));
  if (Number.isInteger(budgetMax) && budgetMax > 0 && budgetMax <= 1_000_000_000) {
    out.budgetMax = budgetMax;
    q.set("budgetMax", String(budgetMax));
  }
  const deadline = one(sp.deadline);
  if (deadline && ISO_DATE_RE.test(deadline) && !Number.isNaN(Date.parse(`${deadline}T00:00:00Z`))) {
    out.deadline = `${formatDate(`${deadline}T12:00:00+05:00`)} gacha`;
    q.set("deadline", deadline);
  }
  const query = q.toString();
  return { prefill: query ? out : undefined, query };
}

/** Yangi e'lon: faqat mijozlar; mutaxassis va admin — tushuntirish */
export default async function NewJobPage({ searchParams }: { searchParams: Promise<PrefillParams> }) {
  const { prefill, query } = parsePrefill(await searchParams);
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(query ? `/ishlar/yangi?${query}` : "/ishlar/yangi"));

  if (user.role !== "client") {
    return (
      <div className="container-x max-w-2xl">
        <div className="card-outline flex flex-col items-center px-6 py-14 text-center">
          <span className="icon-tile-soft icon-tile-lg mb-4" aria-hidden="true">
            <ListChecks size={24} />
          </span>
          <h1 className="font-display text-[22px] font-semibold text-fg">E'lonni faqat mijozlar joylaydi</h1>
          <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-fg-3">
            {user.role === "specialist"
              ? "Siz mutaxassis sifatida ro'yxatdan o'tgansiz — ochiq e'lonlarga taklif yuborishingiz mumkin."
              : "Administrator hisobidan e'lon joylanmaydi."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/ishlar" variant="accent" size="md">
              Ochiq ishlarni ko'rish
            </ButtonLink>
            {user.role === "specialist" && (
              <ButtonLink href="/kabinet/takliflar" variant="outline" size="md">
                Takliflarim
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x">
      <ButtonLink href="/ishlar" variant="ghost" size="sm" className="-ml-3 mb-4 !h-10">
        <ArrowLeft size={15} /> Barcha e'lonlar
      </ButtonLink>
      <PageHeader
        eyebrow="Mijozlar uchun bepul"
        title={
          <>
            Yangi <span className="accent-serif text-accent">e'lon</span>
          </>
        }
        description="Loyihangizni tasvirlab bering — mos mutaxassislar o'zlari taklif yuborishadi. Taklifni qabul qilsangiz, buyurtma avtomatik yaratiladi."
      />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-8">
          <JobForm prefill={prefill} clientFirstName={firstName(user.name)} emailVerified={user.emailVerified} />
        </div>
        <aside className="min-w-0 lg:col-span-4">
          <div className="card p-5 lg:sticky lg:top-24">
            <p className="eyebrow">Qanday ishlaydi</p>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex items-start gap-3">
                  <span className="icon-tile icon-tile-sm shrink-0" aria-hidden="true">
                    <s.icon size={15} />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-fg">
                      <span className="mr-1 text-fg-4">{i + 1}.</span>
                      {s.t}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
