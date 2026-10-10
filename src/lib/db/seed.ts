/**
 * Namuna ma'lumotlar: admin, mijozlar, 14 hudud bo'ylab mutaxassislar, portfolio, sharhlar, buyurtmalar.
 * Ishga tushirish: npm run db:push && npm run db:seed
 */
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { CATEGORIES, PLATFORM_DEFAULTS, REGIONS } from "../constants";
import { slugify } from "../utils";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client, { schema });

/* ---------- deterministik tasodif ---------- */
let seedState = 20251010;
function rnd() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
const pickN = <T,>(arr: readonly T[], n: number) => [...arr].sort(() => rnd() - 0.5).slice(0, n);
const between = (a: number, b: number) => Math.floor(a + rnd() * (b - a));
let counter = 0;
const uid = () => `seed-${(++counter).toString(36).padStart(5, "0")}-${Math.floor(rnd() * 1e9).toString(36)}`;

/* ---------- ismlar ---------- */
const MALE = ["Jasur", "Bekzod", "Sardor", "Javohir", "Azizbek", "Shaxzod", "Doston", "Ulug'bek", "Bobur", "Otabek", "Sanjar", "Temur", "Nodir", "Farrux", "Diyor", "Islom", "Kamron", "Abror", "Shohruh", "Mirjalol", "Akmal", "Rustam", "Xurshid", "Eldor", "Jahongir"];
const FEMALE = ["Madina", "Sevara", "Nilufar", "Dilnoza", "Zarina", "Gulnora", "Shahnoza", "Malika", "Kamola", "Nargiza", "Feruza", "Mohira", "Dildora", "Laylo", "Umida", "Durdona", "Zilola", "Nozima"];
const SURNAMES = ["Karimov", "Rahimov", "Tursunov", "Yusupov", "Abdullayev", "Ismoilov", "Mirzayev", "Qodirov", "Saidov", "Xolmatov", "Ergashev", "Nazarov", "Sobirov", "Toshmatov", "Olimov", "Jo'rayev", "Mahmudov", "Umarov", "Hamidov", "Aliyev", "Boboyev", "Normatov"];

const TITLES: Record<string, string[]> = {
  videograf: ["To'y va event videografi", "Reklama roliklari rejissyori", "Korporativ video va intervyu", "Cinematic to'y filmlari", "Mahsulot va brend videolari", "Dron va aero suratga olish"],
  montajor: ["Video montaj va rang korreksiya", "YouTube va Reels montajori", "Reklama roliklari montaji", "Kino uslubidagi montaj", "Tez va sifatli SMM montaj", "Hujjatli film montajori"],
  dizayner: ["Logo va brending dizayneri", "SMM va poster dizayni", "Grafik dizayn | Figma, Illustrator", "Banner va bosma dizayn", "Qadoq va etiketka dizayneri", "Brend kitob va identika"],
  "motion-dizayner": ["2D motion va intro animatsiya", "Infografika va explainer video", "After Effects motion dizayner", "Logo animatsiya va titrlar", "3D motion va reklama animatsiyasi"],
  fotograf: ["Portret va fashion fotograf", "To'y fotografi", "Mahsulot (predmet) fotosessiya", "Event va reportaj suratga olish", "Oilaviy va bolalar fotosessiyasi"],
  "3d-artist": ["3D vizualizatsiya va interyer render", "3D mahsulot modellashtirish", "Blender 3D artist", "Arxitektura vizualizatsiyasi", "3D personaj va game asset"],
  "ui-ux": ["Mobil ilova UI/UX dizayneri", "Sayt va landing dizayni", "Figma UI/UX | Dizayn tizimlari", "SaaS mahsulot dizayneri"],
  ovoz: ["Ovoz yozish va dublyaj", "Podkast montaji va mastering", "Reklama uchun diktor ovozi", "Sound design va musiqa montaji"],
};

const SKILLS: Record<string, string[]> = {
  videograf: ["Sony FX3", "Sony A7S III", "Canon R6", "DJI Ronin", "Dron DJI Mavic", "Cinematic", "Wedding", "Intervyu", "Reklama", "Slow-motion", "Yorug'lik"],
  montajor: ["Premiere Pro", "DaVinci Resolve", "After Effects", "Final Cut", "Rang korreksiya", "Sound design", "Reels/TikTok", "YouTube", "Subtitr", "Motion grafika"],
  dizayner: ["Figma", "Adobe Illustrator", "Photoshop", "Brending", "Logo", "Poster", "SMM dizayn", "Tipografika", "Bosma", "Qadoq"],
  "motion-dizayner": ["After Effects", "Cinema 4D", "Blender", "Lottie", "2D animatsiya", "3D animatsiya", "Infografika", "Intro", "Rigging"],
  fotograf: ["Portret", "Fashion", "To'y", "Mahsulot", "Studiya yorug'ligi", "Lightroom", "Photoshop", "Retush", "Canon", "Sony"],
  "3d-artist": ["Blender", "3ds Max", "Corona", "V-Ray", "Cinema 4D", "Substance", "Interyer", "Eksteryer", "Mahsulot render", "Unreal Engine"],
  "ui-ux": ["Figma", "Dizayn tizimi", "Prototip", "UX tadqiqot", "Mobil UI", "Web UI", "Framer", "Webflow"],
  ovoz: ["Pro Tools", "Logic Pro", "Audition", "Diktor", "Dublyaj", "Mastering", "Podkast", "Studiya"],
};

const PRICE: Record<string, [number, number]> = {
  videograf: [1_500_000, 12_000_000],
  montajor: [300_000, 5_000_000],
  dizayner: [200_000, 4_000_000],
  "motion-dizayner": [500_000, 8_000_000],
  fotograf: [500_000, 6_000_000],
  "3d-artist": [800_000, 15_000_000],
  "ui-ux": [1_000_000, 20_000_000],
  ovoz: [150_000, 2_000_000],
};

const BIO_INTRO = [
  "{years} yildan beri {cat} sifatida ishlayman.",
  "{cat} sohasida {years} yillik tajribaga egaman.",
  "Men {city}da faoliyat yurituvchi {cat}man, {years} yil tajriba.",
];
const BIO_BODY = [
  "Har bir loyihaga individual yondashaman — g'oyadan tayyor mahsulotgacha barcha bosqichlarni o'zim nazorat qilaman.",
  "Mijozning brendini va maqsadini chuqur tushunib, natijaga yo'naltirilgan ish qilaman.",
  "Zamonaviy texnika va dasturlar bilan ishlayman, muddatlarga qat'iy rioya qilaman.",
  "100 dan ortiq loyiha, shu jumladan yirik brendlar va davlat tashkilotlari bilan hamkorlik qilganman.",
  "Ijodiy yondashuv va texnik sifat — mening asosiy tamoyillarim.",
];
const BIO_END = [
  "O'zbekistonning istalgan hududiga chiqib ishlashim mumkin.",
  "Masofadan ham ishlayman — dunyoning istalgan nuqtasidan buyurtma qabul qilaman.",
  "Birinchi maslahat bepul. Telegram orqali yozing!",
  "Portfolio bilan tanishib chiqing va bog'laning.",
];

const PORTFOLIO_TITLES: Record<string, string[]> = {
  videograf: ["To'y filmi — Samarqand", "Reklama roligi: milliy taom", "Korporativ intervyu", "Aero suratga olish — Chorvoq", "Brend hikoyasi", "Event aftermovie"],
  montajor: ["Reels seriyasi — 1M ko'rish", "YouTube vlog montaji", "Rang korreksiya: oldin/keyin", "Reklama montaji 30 soniya", "Hujjatli film treyleri"],
  dizayner: ["Logo va brending — kafe", "SMM post seriyasi", "Poster: festival", "Qadoq dizayni — choy", "Vizitka va blank", "Brend kitob"],
  "motion-dizayner": ["Logo animatsiya", "Explainer video — fintech", "Infografika: statistika", "Intro — YouTube kanal", "3D reklama animatsiyasi"],
  fotograf: ["Portret seriyasi", "Mahsulot fotosessiya — kosmetika", "To'y fotosessiya", "Fashion lookbook", "Oilaviy suratlar"],
  "3d-artist": ["Interyer render — mehmonxona", "Mahsulot 3D — soat", "Eksteryer vizualizatsiya", "Game asset — qurol", "Mebel renderlari"],
  "ui-ux": ["Mobil bank ilovasi UI", "Landing — ta'lim platformasi", "Dizayn tizimi", "E-commerce ilova", "Dashboard UI"],
  ovoz: ["Reklama diktor ovozi", "Podkast — 20 epizod", "Dublyaj namunasi", "Audiokitob"],
};

const YOUTUBE = ["https://www.youtube.com/watch?v=ysz5S6PUM-U", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "https://www.youtube.com/watch?v=LXb3EKWsInQ", "https://www.youtube.com/watch?v=hY7m5jjJ9mM"];

const REVIEWS = [
  "Juda sifatli ish qildi, muddatidan oldin topshirdi. Tavsiya qilaman!",
  "Professional yondashuv, har bir detalga e'tibor beradi. Yana murojaat qilaman.",
  "Natija kutganimdan ham yaxshi chiqdi. Rahmat!",
  "Narx-sifat nisbati a'lo. Muloqot oson va tez.",
  "Birinchi variantdan ko'nglim to'ldi, tuzatishlar deyarli kerak bo'lmadi.",
  "Ijodiy g'oyalari zo'r, loyihaga o'z hissasini qo'shdi.",
  "Yaxshi ishladi, lekin muddat biroz cho'zildi.",
  "Texnik jihatdan juda kuchli mutaxassis.",
];

const ORDER_TITLES = ["To'y uchun videograf kerak", "Instagram uchun 10 ta Reels montaji", "Kafe uchun logo va menyu dizayni", "Mahsulot fotosessiyasi (30 ta mahsulot)", "YouTube kanal uchun intro", "Interyer 3D render — 2 xona", "Ilova uchun UI dizayn", "Reklama roligiga diktor ovozi"];

function catLabel(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)?.name.toLowerCase() ?? slug;
}

async function main() {
  if (process.argv.includes("--if-empty")) {
    const [row] = await db.select({ n: count() }).from(schema.users);
    if (row.n > 0) {
      console.log(`→ Bazada ${row.n} ta foydalanuvchi bor — seed o'tkazib yuborildi.`);
      return;
    }
  }
  console.log("→ Eski ma'lumotlar tozalanmoqda...");
  await db.delete(schema.notifications);
  await db.delete(schema.favorites);
  await db.delete(schema.payouts);
  await db.delete(schema.payments);
  await db.delete(schema.auditLogs);
  await db.delete(schema.passwordResets);
  await db.delete(schema.reviews);
  await db.delete(schema.orders);
  await db.delete(schema.portfolioItems);
  await db.delete(schema.specialists);
  await db.delete(schema.users);

  const pass = await bcrypt.hash("demo12345", 10);
  const adminPass = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "admin12345", 10);
  const now = Date.now();
  const DAY = 86_400_000;

  /* ---------- admin ---------- */
  const adminId = uid();
  await db.insert(schema.users).values({
    id: adminId,
    name: "Redince Admin",
    email: process.env.ADMIN_EMAIL ?? "admin@redince.uz",
    passwordHash: adminPass,
    role: "admin",
    createdAt: new Date(now - 200 * DAY),
  });

  /* ---------- mijozlar ---------- */
  const clientIds: string[] = [];
  const clients = [
    ["Aziza Yo'ldosheva", "aziza@example.com"],
    ["Botir Qosimov", "botir@example.com"],
    ["Nigora Saidova", "nigora@example.com"],
    ["Sherzod Alimov", "sherzod@example.com"],
    ["Dilshod Raximov", "dilshod@example.com"],
    ["Mijoz Demo", "mijoz@redince.uz"],
  ];
  for (const [name, email] of clients) {
    const id = uid();
    clientIds.push(id);
    await db.insert(schema.users).values({ id, name, email, passwordHash: pass, role: "client", gender: /a$/.test(name.split(" ")[0]) ? "female" : "male", phone: `+99890${between(1000000, 9999999)}`, createdAt: new Date(now - between(5, 180) * DAY) });
  }

  /* ---------- mutaxassislar ---------- */
  // Har hududga kamida 2 ta; Toshkent va yirik shaharlarga ko'proq
  const WEIGHT: Record<string, number> = {
    "toshkent-shahri": 12, "toshkent-viloyati": 4, samarqand: 6, buxoro: 4, fargona: 5, andijon: 4, namangan: 4,
    qashqadaryo: 3, surxondaryo: 3, xorazm: 3, navoiy: 3, jizzax: 2, sirdaryo: 2, qoraqalpogiston: 3,
  };

  const usedSlugs = new Set<string>();
  const usedEmails = new Set<string>();
  const specialistIds: { id: string; userId: string; category: string }[] = [];
  let demoSpecialistMade = false;

  for (const region of REGIONS) {
    const n = WEIGHT[region.slug] ?? 2;
    for (let i = 0; i < n; i++) {
      const female = rnd() < 0.38;
      const first = female ? pick(FEMALE) : pick(MALE);
      let sur = pick(SURNAMES);
      if (female) sur = sur.replace(/ov$/, "ova").replace(/ev$/, "eva");
      const name = `${first} ${sur}`;

      let email = `${slugify(first)}.${slugify(sur)}@example.com`;
      while (usedEmails.has(email)) email = `${slugify(first)}.${slugify(sur)}${between(1, 99)}@example.com`;
      usedEmails.add(email);

      let slug = slugify(name);
      while (usedSlugs.has(slug)) slug = `${slugify(name)}-${between(2, 99)}`;
      usedSlugs.add(slug);

      const userId = uid();
      const isDemo = !demoSpecialistMade && region.slug === "toshkent-shahri";
      await db.insert(schema.users).values({
        id: userId,
        name,
        email: isDemo ? "mutaxassis@redince.uz" : email,
        passwordHash: pass,
        role: "specialist",
        gender: female ? "female" : "male",
        phone: `+9989${between(0, 9)}${between(1000000, 9999999)}`,
        avatarUrl: rnd() < 0.55 ? `https://i.pravatar.cc/200?u=${slug}` : null,
        createdAt: new Date(now - between(10, 400) * DAY),
      });
      if (isDemo) demoSpecialistMade = true;

      const category = pick(CATEGORIES).slug;
      const [pmin, pmax] = PRICE[category];
      const priceFrom = Math.round(between(pmin, (pmin + pmax) / 2) / 50_000) * 50_000;
      const priceTo = rnd() < 0.7 ? Math.round(between(priceFrom * 1.5, pmax) / 50_000) * 50_000 : null;
      const years = between(1, 12);
      const experience = years < 1.5 ? "junior" : years < 3 ? "middle" : years < 6 ? "senior" : "expert";
      const reviewCount = rnd() < 0.8 ? between(0, 6) : 0;
      const city = i === 0 ? region.capital : pick(region.cities);

      const bio = [
        pick(BIO_INTRO).replace("{years}", String(years)).replace("{cat}", catLabel(category)).replace("{city}", city),
        pick(BIO_BODY),
        pick(BIO_BODY),
        pick(BIO_END),
      ].join(" ");

      const spId = uid();
      await db.insert(schema.specialists).values({
        id: spId,
        userId,
        slug,
        title: pick(TITLES[category]),
        category,
        regionSlug: region.slug,
        city,
        bio,
        priceFrom,
        priceTo,
        experience,
        skills: pickN(SKILLS[category], between(3, 7)),
        languages: rnd() < 0.6 ? ["uz", "ru"] : rnd() < 0.5 ? ["uz", "ru", "en"] : ["uz"],
        telegram: slug.replace(/-/g, "_"),
        instagram: rnd() < 0.8 ? slug.replace(/-/g, ".") : null,
        youtube: rnd() < 0.4 ? "https://youtube.com/@" + slug : null,
        coverUrl: rnd() < 0.75 ? `https://picsum.photos/seed/${slug}-cover/900/400` : null,
        visibility: { phone: rnd() < 0.5 ? "public" : "clients", instagram: rnd() < 0.85 ? "public" : "hidden", email: "hidden" },
        schedule: {
          days: {
            mon: { enabled: true, from: "09:00", to: "18:00" },
            tue: { enabled: true, from: "09:00", to: "18:00" },
            wed: { enabled: true, from: "09:00", to: "18:00" },
            thu: { enabled: true, from: "09:00", to: "18:00" },
            fri: { enabled: true, from: "09:00", to: "17:00" },
            sat: { enabled: rnd() < 0.6, from: "10:00", to: "15:00" },
            sun: { enabled: false, from: "10:00", to: "14:00" },
          },
          note: rnd() < 0.4 ? "To'y mavsumida dam olish kunlari ham ishlayman" : "",
        },
        isVerified: rnd() < 0.6,
        isAvailable: rnd() < 0.85,
        isFeatured: rnd() < 0.15,
        viewCount: between(20, 2400),
        createdAt: new Date(now - between(10, 400) * DAY),
      });
      specialistIds.push({ id: spId, userId, category });

      /* portfolio */
      const titles = pickN(PORTFOLIO_TITLES[category], between(3, 6));
      for (let k = 0; k < titles.length; k++) {
        const isVideo = ["videograf", "montajor", "motion-dizayner", "ovoz"].includes(category) && rnd() < 0.5;
        const yt = pick(YOUTUBE);
        const ytId = new URL(yt).searchParams.get("v");
        await db.insert(schema.portfolioItems).values({
          id: uid(),
          specialistId: spId,
          title: titles[k],
          type: isVideo ? "video" : "image",
          url: isVideo ? yt : `https://picsum.photos/seed/${slug}-${k}/1200/800`,
          thumbnailUrl: isVideo ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : `https://picsum.photos/seed/${slug}-${k}/600/400`,
          description: rnd() < 0.6 ? pick(BIO_BODY) : null,
          sortOrder: k,
        });
      }

      /* sharhlar */
      const authors = pickN(clientIds, Math.min(reviewCount, clientIds.length));
      let sum = 0;
      for (const authorId of authors) {
        const rating = rnd() < 0.75 ? 5 : rnd() < 0.7 ? 4 : 3;
        sum += rating;
        await db.insert(schema.reviews).values({ id: uid(), specialistId: spId, authorId, rating, text: pick(REVIEWS), createdAt: new Date(now - between(1, 300) * DAY) });
      }
      if (authors.length) {
        await db
          .update(schema.specialists)
          .set({ rating: Math.round((sum / authors.length) * 10) / 10, reviewCount: authors.length })
          .where(eq(schema.specialists.id, spId));
      }
    }
  }

  /* ---------- buyurtmalar ---------- */
  const statuses = ["new", "new", "accepted", "in_progress", "done", "done", "cancelled"] as const;
  for (let i = 0; i < 24; i++) {
    const sp = pick(specialistIds);
    const clientId = pick(clientIds);
    await db.insert(schema.orders).values({
      id: uid(),
      clientId,
      specialistId: sp.id,
      title: pick(ORDER_TITLES),
      description: `${pick(BIO_BODY)} Loyiha haqida batafsil: ${pick(ORDER_TITLES).toLowerCase()}. Iltimos, narx va muddatni ayting.`,
      budget: Math.round(between(300_000, 8_000_000) / 100_000) * 100_000,
      deadline: `${between(1, 28)}.${String(between(10, 12)).padStart(2, "0")}.2026`,
      contactPhone: `+99890${between(1000000, 9999999)}`,
      status: pick(statuses),
      createdAt: new Date(now - between(0, 60) * DAY),
    });
  }

  // Demo mutaxassisga maxsus: bir nechta yangi buyurtma
  const demoUser = await db.query.users.findFirst({ where: eq(schema.users.email, "mutaxassis@redince.uz"), with: { specialist: true } });
  if (demoUser?.specialist) {
    for (let i = 0; i < 3; i++) {
      await db.insert(schema.orders).values({
        id: uid(),
        clientId: pick(clientIds),
        specialistId: demoUser.specialist.id,
        title: pick(ORDER_TITLES),
        description: `${pick(BIO_BODY)} Muddat va narx bo'yicha kelishib olsak.`,
        budget: Math.round(between(500_000, 5_000_000) / 100_000) * 100_000,
        contactPhone: `+99890${between(1000000, 9999999)}`,
        status: "new",
        createdAt: new Date(now - i * DAY),
      });
    }
  }

  /* ---------- platforma sozlamalari ---------- */
  for (const [key, value] of Object.entries(PLATFORM_DEFAULTS)) {
    await db
      .insert(schema.platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.platformSettings.key, set: { value } });
  }

  console.log(`✓ Tayyor: ${specialistIds.length} mutaxassis, ${clientIds.length} mijoz, admin.`);
  console.log("  Demo kirishlar (parol: demo12345):");
  console.log("   • mutaxassis@redince.uz  (mutaxassis)");
  console.log("   • mijoz@redince.uz       (mijoz)");
  console.log(`   • ${process.env.ADMIN_EMAIL ?? "admin@redince.uz"}  (admin, parol: ${process.env.ADMIN_PASSWORD ?? "admin12345"})`);

  /* ---------- to'lovlar va payoutlar (eskrou namunasi) ---------- */
  // Bajarilgan buyurtmalar — to'langan va mijoz qabul qilgan (released); bittasi eskrouda (paid);
  // bittasi narx belgilangan, to'lov kutilmoqda (awaiting). Demo mutaxassisga: released + paid + payout so'rovi.
  const pct = PLATFORM_DEFAULTS.commissionPct;
  const splitSeed = (amount: number) => {
    const commissionAmount = Math.round((amount * pct) / 100);
    return { commissionPct: pct, commissionAmount, netAmount: amount - commissionAmount };
  };
  const roundAmt = (n: number) => Math.max(PLATFORM_DEFAULTS.minOrderAmount, Math.round(n / 50_000) * 50_000);
  const providersSeed = ["payme", "click", "manual"] as const;
  const seededOrders = await db.query.orders.findMany({ columns: { id: true, clientId: true, specialistId: true, status: true, budget: true, createdAt: true } });
  let paymentsMade = 0;

  for (const o of seededOrders.filter((x) => x.status === "done").slice(0, 5)) {
    const amount = roundAmt(o.budget ?? 1_000_000);
    const paidAt = new Date(o.createdAt.getTime() + 2 * DAY);
    const releasedAt = new Date(paidAt.getTime() + 5 * DAY);
    const provider = providersSeed[paymentsMade % providersSeed.length];
    await db.insert(schema.payments).values({
      id: uid(),
      orderId: o.id,
      clientId: o.clientId,
      specialistId: o.specialistId,
      amount,
      ...splitSeed(amount),
      provider,
      state: "released",
      providerTxnId: `${provider}-seed-${paymentsMade + 1}`,
      providerState: 2,
      providerCreateTime: paidAt.getTime(),
      performTime: paidAt.getTime(),
      paidAt,
      releasedAt,
      createdAt: paidAt,
      updatedAt: releasedAt,
    });
    await db.update(schema.orders).set({ amount, paymentState: "released", commissionPct: pct, completedAt: releasedAt }).where(eq(schema.orders.id, o.id));
    paymentsMade++;
  }

  const inProgressOrder = seededOrders.find((x) => x.status === "in_progress");
  if (inProgressOrder) {
    const amount = roundAmt(inProgressOrder.budget ?? 1_000_000);
    const paidAt = new Date(now - 3 * DAY);
    await db.insert(schema.payments).values({
      id: uid(),
      orderId: inProgressOrder.id,
      clientId: inProgressOrder.clientId,
      specialistId: inProgressOrder.specialistId,
      amount,
      ...splitSeed(amount),
      provider: "payme",
      state: "paid",
      providerTxnId: `payme-seed-escrow`,
      providerState: 2,
      providerCreateTime: paidAt.getTime(),
      performTime: paidAt.getTime(),
      paidAt,
      createdAt: paidAt,
      updatedAt: paidAt,
    });
    await db.update(schema.orders).set({ amount, paymentState: "paid", commissionPct: pct }).where(eq(schema.orders.id, inProgressOrder.id));
    paymentsMade++;
  }

  const acceptedOrder = seededOrders.find((x) => x.status === "accepted");
  if (acceptedOrder) {
    await db.update(schema.orders).set({ amount: roundAmt(acceptedOrder.budget ?? 800_000), paymentState: "awaiting", commissionPct: pct }).where(eq(schema.orders.id, acceptedOrder.id));
  }

  if (demoUser?.specialist) {
    const spId = demoUser.specialist.id;
    const demoClientId = clientIds[clientIds.length - 1]; // mijoz@redince.uz
    // Yakunlangan: 2 000 000 so'm → 1 800 000 balansga tushgan
    const o1 = uid();
    const paid1 = new Date(now - 12 * DAY);
    const rel1 = new Date(now - 6 * DAY);
    await db.insert(schema.orders).values({
      id: o1,
      clientId: demoClientId,
      specialistId: spId,
      title: "Reklama roligi uchun 2D motion animatsiya",
      description: "30 soniyalik reklama roligi uchun logo animatsiya, titrlar va infografika. Brend kitob bor, referenslar yuboraman.",
      budget: 2_000_000,
      deadline: "2 hafta ichida",
      contactPhone: "+998901112233",
      status: "done",
      amount: 2_000_000,
      paymentState: "released",
      commissionPct: pct,
      completedAt: rel1,
      createdAt: new Date(now - 14 * DAY),
      updatedAt: rel1,
    });
    await db.insert(schema.payments).values({
      id: uid(),
      orderId: o1,
      clientId: demoClientId,
      specialistId: spId,
      amount: 2_000_000,
      ...splitSeed(2_000_000),
      provider: "click",
      state: "released",
      providerTxnId: "click-seed-demo-1",
      providerState: 2,
      providerCreateTime: paid1.getTime(),
      performTime: paid1.getTime(),
      paidAt: paid1,
      releasedAt: rel1,
      createdAt: paid1,
      updatedAt: rel1,
    });
    // Jarayonda: 800 000 so'm eskrouda
    const o2 = uid();
    const paid2 = new Date(now - 2 * DAY);
    await db.insert(schema.orders).values({
      id: o2,
      clientId: demoClientId,
      specialistId: spId,
      title: "YouTube kanal uchun intro va outro",
      description: "Texnologiya kanali uchun 8 soniyalik intro va 15 soniyalik outro. Kanal ranglari: to'q ko'k va oq.",
      budget: 800_000,
      deadline: "1 hafta ichida",
      contactPhone: "+998901112233",
      status: "in_progress",
      amount: 800_000,
      paymentState: "paid",
      commissionPct: pct,
      createdAt: new Date(now - 4 * DAY),
      updatedAt: paid2,
    });
    await db.insert(schema.payments).values({
      id: uid(),
      orderId: o2,
      clientId: demoClientId,
      specialistId: spId,
      amount: 800_000,
      ...splitSeed(800_000),
      provider: "payme",
      state: "paid",
      providerTxnId: "payme-seed-demo-2",
      providerState: 2,
      providerCreateTime: paid2.getTime(),
      performTime: paid2.getTime(),
      paidAt: paid2,
      createdAt: paid2,
      updatedAt: paid2,
    });
    // Pul chiqarish so'rovi (admin navbatida ko'rinadi)
    await db.insert(schema.payouts).values({
      id: uid(),
      specialistId: spId,
      amount: 500_000,
      method: "card",
      details: "8600 **** **** 4321",
      state: "requested",
      createdAt: new Date(now - DAY),
    });
    paymentsMade += 2;
  }
  console.log(`  To'lovlar: ${paymentsMade} ta namuna (released/paid), 1 ta payout so'rovi, 1 ta buyurtma to'lov kutmoqda.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
