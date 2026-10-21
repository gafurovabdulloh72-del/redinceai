/**
 * Narx qoidalari va bozor tahlili asosidagi tavsiya.
 *  · PRICE_MIN — har bir mutaxassisning «dan» narxi shundan kam bo'lmaydi (200 000 so'm); dollarda — PRICE_MIN_USD.
 *  · suggestPrice() — kasb, tajriba, hudud va sharh/buyurtma ko'rsatkichlari bo'yicha alohida narx (so'mda).
 * Sof funksiyalar: klientda (forma tavsiyasi), serverda va skriptlarda (bir martalik tuzatish) ishlaydi.
 */

export const PRICE_MIN = 200_000;
export const PRICE_MIN_USD = 20;

/** Kasb bo'yicha o'rta darajadagi mutaxassisning boshlang'ich (bitta kichik loyiha / oylik xizmat) narxi, so'm */
export const CATEGORY_BASE_PRICE: Record<string, number> = {
  // Video
  videograf: 600_000, montajor: 300_000, "motion-dizayner": 500_000, "reels-maker": 300_000, dronograf: 500_000, animator: 600_000,
  kolorist: 400_000, "vfx-artist": 700_000, "video-prodyuser": 1_500_000, "jonli-efir": 800_000,
  // Dizayn
  dizayner: 300_000, "ui-ux": 800_000, "logo-brending": 500_000, illyustrator: 400_000, "veb-dizayner": 700_000, "smm-dizayner": 250_000,
  prezentatsiya: 250_000, infografika: 300_000, poligrafiya: 250_000, "qadoq-dizayner": 500_000, "kiyim-dizayner": 450_000, "shrift-dizayner": 500_000,
  // Foto
  fotograf: 400_000, "toy-fotograf": 800_000, "mahsulot-fotograf": 350_000, "portret-fotograf": 400_000, retusher: 200_000, "ugc-kreator": 300_000,
  // 3D
  "3d-artist": 700_000, "3d-modeler": 500_000, "arxitektura-vizual": 900_000, "interyer-dizayner": 1_200_000, "cad-chizmachi": 400_000,
  "ar-vr": 1_500_000, "game-artist": 800_000, "3d-animator": 800_000,
  // Audio
  ovoz: 300_000, diktor: 250_000, dublyaj: 400_000, "musiqa-prodyuser": 600_000, bastakor: 700_000, "saund-dizayner": 400_000, "podkast-muharrir": 250_000,
  // Dasturlash
  frontend: 1_500_000, backend: 2_000_000, fullstack: 2_500_000, "mobil-dasturchi": 2_500_000, wordpress: 1_000_000, "telegram-bot": 700_000,
  "game-dev": 2_000_000, "1c-dasturchi": 800_000, "qa-tester": 800_000, devops: 2_500_000, "kiber-xavfsizlik": 2_500_000, "no-code": 800_000,
  // Marketing
  "smm-menejer": 1_000_000, targetolog: 1_000_000, "kontekst-reklama": 1_000_000, seo: 1_000_000, marketolog: 1_200_000, "kontent-menejer": 800_000,
  "email-marketing": 600_000, "brend-strateg": 1_500_000, "influencer-menejer": 800_000, "pr-menejer": 1_000_000,
  // Yozuv
  kopirayter: 200_000, "kontent-yozuvchi": 200_000, ssenarist: 400_000, tarjimon: 200_000, "sinxron-tarjimon": 800_000, muharrir: 200_000,
  "texnik-yozuvchi": 400_000, subtitr: 200_000,
  // Biznes
  "virtual-assistent": 500_000, "loyiha-menejer": 1_500_000, "mahsulot-menejer": 2_000_000, "sotuv-menejer": 700_000, "mijozlar-xizmati": 400_000,
  buxgalter: 500_000, "moliya-tahlilchi": 1_000_000, "hr-mutaxassis": 700_000, "biznes-konsultant": 1_500_000, huquqshunos: 500_000,
  // Ma'lumotlar va AI
  "data-analitik": 1_500_000, "bi-dashboard": 1_500_000, "ai-muhandis": 3_000_000, "prompt-muhandis": 1_000_000, "malumot-kiritish": 200_000, "excel-mutaxassis": 300_000,
  // Ta'lim
  repetitor: 200_000, "til-oqituvchi": 200_000, "kurs-muallifi": 1_000_000, "mentor-trener": 500_000, "kasbiy-ustoz": 400_000,
};

const EXPERIENCE_FACTOR: Record<string, number> = { junior: 0.8, middle: 1, senior: 1.4, expert: 1.9 };

/** Hudud koeffitsienti: Toshkent shahri qimmatroq, chekka hududlar arzonroq */
function regionFactor(regionSlug: string | null | undefined): number {
  switch (regionSlug) {
    case "toshkent-shahri":
      return 1.15;
    case "toshkent-viloyati":
    case "samarqand":
    case "buxoro":
      return 1;
    case "":
    case null:
    case undefined:
      return 1;
    default:
      return 0.9;
  }
}

/** «Yumaloq» narx: 1 mln gacha — 50 mingga, 3 mln gacha — 100 mingga, undan keyin — 250 mingga */
export function roundPrice(n: number): number {
  const step = n < 1_000_000 ? 50_000 : n < 3_000_000 ? 100_000 : 250_000;
  return Math.max(PRICE_MIN, Math.round(n / step) * step);
}

export interface PriceInput {
  category: string;
  experience?: string | null;
  regionSlug?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  completedCount?: number | null;
  topRated?: boolean | null;
  isVerified?: boolean | null;
}

/** Mutaxassisga alohida narx tavsiyasi: [dan, gacha] — so'mda, ikkalasi PRICE_MIN'dan kam emas */
export function suggestPrice(sp: PriceInput): { from: number; to: number } {
  const base = CATEGORY_BASE_PRICE[sp.category] ?? 400_000;
  let f = (EXPERIENCE_FACTOR[sp.experience ?? "middle"] ?? 1) * regionFactor(sp.regionSlug);
  // Obro' ko'rsatkichlari: yaxshi sharhlar, bajarilgan buyurtmalar, nishonlar narxni ko'taradi (bir-biriga ko'paymaydi — yig'indi, 1.35 dan oshmaydi)
  let bonus = 0;
  if ((sp.reviewCount ?? 0) >= 3 && (sp.rating ?? 0) >= 4.8) bonus += 0.1;
  if (sp.topRated) bonus += 0.1;
  if (sp.isVerified) bonus += 0.05;
  if ((sp.completedCount ?? 0) >= 50) bonus += 0.15;
  else if ((sp.completedCount ?? 0) >= 10) bonus += 0.08;
  f *= 1 + Math.min(bonus, 0.35);
  const from = roundPrice(base * f);
  const to = roundPrice(from * 2.6);
  return { from, to: Math.max(to, from + 100_000) };
}
