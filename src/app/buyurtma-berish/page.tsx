import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Pencil, RotateCcw, SearchX, Sparkles, Wand2 } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { OrderWizard } from "@/components/orders/OrderWizard";
import { REMOTE_KEY, WIZARD_BUDGETS, WIZARD_DEADLINES, wizardQuery, type WizardState } from "@/components/orders/wizard-options";
import { getSession } from "@/lib/auth";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { listSpecialists, type SpecialistListItem } from "@/lib/queries";
import { specialistFilterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Buyurtma sehrgari",
  description: "4 ta savolga javob bering — yo'nalish, byudjet, hudud va muddat bo'yicha sizga mos mutaxassislarni tavsiya qilamiz.",
  alternates: { canonical: "/buyurtma-berish" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function parseState(sp: Record<string, string | string[] | undefined>): WizardState {
  const yonalish = one(sp.yonalish);
  const byudjet = one(sp.byudjet);
  const hudud = one(sp.hudud);
  const muddat = one(sp.muddat);
  return {
    yonalish: yonalish && CATEGORY_BY_SLUG[yonalish] ? yonalish : null,
    byudjet: WIZARD_BUDGETS.find((b) => b.key === byudjet)?.key ?? null,
    hudud: hudud === REMOTE_KEY || (hudud && REGION_BY_SLUG[hudud]) ? hudud : null,
    muddat: WIZARD_DEADLINES.find((d) => d.key === muddat)?.key ?? null,
  };
}

function addDays(days: number): string {
  return new Date(Date.now() + 5 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Buyurtma sehrgari (F72). Natija: listSpecialists (bloklanmagan + obunasi faol — listable) bilan 6 ta tavsiya;
 * kam chiqsa filtrlar bosqichma-bosqich kengaytiriladi (byudjet → hudud → bo'shlik) va bu haqda aytiladi.
 */
export default async function OrderWizardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const state = parseState(sp);
  const showResults = one(sp.natija) === "1" && Boolean(state.yonalish);
  const stepParam = Number(one(sp.qadam));
  const firstEmpty = [state.yonalish, state.byudjet, state.hudud, state.muddat].findIndex((x) => !x);
  const initialStep = Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= 4 ? stepParam - 1 : firstEmpty === -1 ? 3 : firstEmpty;

  if (!showResults) {
    return (
      <div className="container-x">
        <PageHeader
          eyebrow={
            <>
              <Wand2 size={13} className="text-accent" /> Buyurtma sehrgari
            </>
          }
          title={
            <>
              Mos mutaxassisni <span className="accent-serif text-accent">1 daqiqada</span> toping
            </>
          }
          description="4 ta qisqa savol: yo'nalish, byudjet, hudud va muddat. Javoblaringiz bo'yicha eng mos mutaxassislarni tavsiya qilamiz."
          className="mb-8 sm:mb-10"
        />
        <OrderWizard initial={state} initialStep={initialStep} />
      </div>
    );
  }

  const cat = CATEGORY_BY_SLUG[state.yonalish!];
  const budget = WIZARD_BUDGETS.find((b) => b.key === state.byudjet) ?? null;
  const deadline = WIZARD_DEADLINES.find((d) => d.key === state.muddat) ?? null;
  const remote = state.hudud === REMOTE_KEY;
  const region = state.hudud && !remote ? REGION_BY_SLUG[state.hudud] : null;
  const urgent = state.muddat === "shoshilinch";

  const session = await getSession();
  const viewer = { userId: session?.sub ?? null, role: session?.role ?? null };

  // Bosqichma-bosqich kengaytirish: avval hammasi, keyin byudjetsiz, keyin hududsiz, keyin "hozir bo'sh"siz
  const attempts: Array<{ priceMax?: number; region?: string; available?: "1"; relaxed: string[] }> = [];
  const base = { priceMax: budget?.max ?? undefined, region: region?.slug, available: urgent ? ("1" as const) : undefined };
  attempts.push({ ...base, relaxed: [] });
  if (base.priceMax) attempts.push({ ...base, priceMax: undefined, relaxed: ["byudjet"] });
  if (base.region) attempts.push({ ...base, priceMax: undefined, region: undefined, relaxed: ["byudjet", "hudud"].filter((r) => r !== "byudjet" || base.priceMax) });
  if (base.available) attempts.push({ relaxed: ["byudjet", "hudud", "bo'shlik"].filter((r) => (r === "byudjet" ? base.priceMax : r === "hudud" ? base.region : true)) });

  let items: SpecialistListItem[] = [];
  let total = 0;
  let relaxed: string[] = [];
  for (const a of attempts) {
    const filter = specialistFilterSchema.parse({ category: cat.slug, region: a.region, priceMax: a.priceMax, available: a.available, sort: "rating", page: 1, limit: 6 });
    const res = await listSpecialists(filter, viewer);
    if (res.items.length > items.length) {
      items = res.items;
      total = res.total;
      relaxed = a.relaxed;
    }
    if (res.items.length >= 3) break;
  }

  const listQ = new URLSearchParams({ category: cat.slug });
  if (region) listQ.set("region", region.slug);
  if (budget?.max) listQ.set("priceMax", String(budget.max));
  if (urgent) listQ.set("available", "1");
  const jobQ = new URLSearchParams({ category: cat.slug });
  if (region) jobQ.set("region", region.slug);
  if (remote) jobQ.set("remote", "1");
  if (budget?.max) jobQ.set("budgetMax", String(budget.max));
  if (deadline?.days) jobQ.set("deadline", addDays(deadline.days));

  const chips = [
    { step: 1, label: cat.name },
    { step: 2, label: budget?.label ?? "Byudjet: kelishiladi" },
    { step: 3, label: remote ? "Masofaviy" : (region?.name ?? "Butun O'zbekiston") },
    { step: 4, label: deadline?.label ?? "Muddat: kelishiladi" },
  ];
  const relaxedText = relaxed.length ? `Aniq mos keladiganlar kam — ${relaxed.join(", ")} sharti yumshatildi.` : null;

  return (
    <div className="container-x">
      <PageHeader
        eyebrow={
          <>
            <Sparkles size={13} className="text-accent" /> Sehrgar natijasi
          </>
        }
        title={
          <>
            Sizga mos <span className="accent-serif text-accent">{cat.plural.toLowerCase()}</span>
          </>
        }
        description={items.length ? `${total} ta mos mutaxassis topildi — eng yuqori baholanganlari quyida.${relaxedText ? ` ${relaxedText}` : ""}` : "Hozircha mos mutaxassis topilmadi."}
        className="mb-6"
      />

      {/* Tanlovlar — har birini bosib o'zgartirish */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <Link
            key={c.step}
            href={`/buyurtma-berish?${wizardQuery(state, { qadam: String(c.step) })}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
          >
            {c.label} <Pencil size={12} className="text-fg-4" />
          </Link>
        ))}
        <Link href="/buyurtma-berish" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
          <RotateCcw size={13} /> Qayta boshlash
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Mos mutaxassis topilmadi"
          description="E'lon joylang — mutaxassislarning o'zlari narx va muddat bilan taklif yuborishadi."
          action={
            <ButtonLink href={`/ishlar/yangi?${jobQ.toString()}`} variant="accent" size="md">
              <BriefcaseBusiness size={16} /> E'lon joylash
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {items.map((s, i) => (
              <li key={s.slug} className="flex min-w-0 flex-col gap-2">
                <SpecialistCard sp={s} priority={i < 3} />
                <ButtonLink href={`/buyurtma/${s.id}`} variant="outline" size="md" className="w-full">
                  Buyurtma berish <ArrowRight size={15} />
                </ButtonLink>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-stretch gap-3 rounded-[24px] border border-line bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-[16px] font-semibold text-fg">Tanlash qiyinmi?</p>
              <p className="mt-0.5 text-[13px] text-fg-3">Barcha mos mutaxassislarni ko'ring yoki e'lon joylang — ular o'zlari taklif yuborishadi.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/mutaxassislar?${listQ.toString()}`} variant="primary" size="md">
                Barchasini ko'rish ({total}) <ArrowRight size={15} />
              </ButtonLink>
              <ButtonLink href={`/ishlar/yangi?${jobQ.toString()}`} variant="outline" size="md">
                <BriefcaseBusiness size={15} /> E'lon joylash
              </ButtonLink>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
