/**
 * Namuna ma'lumotlar: admin, mijozlar, 14 hudud bo'ylab mutaxassislar, portfolio, sharhlar, buyurtmalar.
 * Ishga tushirish: npm run db:push && npm run db:seed
 */
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { CATEGORIES, JOB_TTL_DAYS, PLATFORM_DEFAULTS, REGIONS, SUBSCRIPTION_INVOICE_PREFIX, SUBSCRIPTION_PLANS, TERMS_VERSION, type WorkTypeSlug } from "../constants";
import { formatPrice, slugify } from "../utils";

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

/* 5-bosqich ma'lumotlari uchun ALOHIDA tasodif — rnd() ketma-ketligi (ismlar, sluglar) o'zgarmasligi uchun */
let seedState2 = 20261013;
function rnd2() {
  seedState2 |= 0;
  seedState2 = (seedState2 + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState2 ^ (seedState2 >>> 15), 1 | seedState2);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick2 = <T,>(arr: readonly T[]) => arr[Math.floor(rnd2() * arr.length)];
const pickN2 = <T,>(arr: readonly T[], n: number) => [...arr].sort(() => rnd2() - 0.5).slice(0, n);
const between2 = (a: number, b: number) => Math.floor(a + rnd2() * (b - a));
let counter2 = 0;
const uid2 = (prefix = "seed5-") => `${prefix}${(++counter2).toString(36).padStart(5, "0")}-${Math.floor(rnd2() * 1e9).toString(36)}`;

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

/* Jihozlar — rnd() ishlatilmaydi, shunda ismlar/sluglar o'zgarmay qoladi */
const EQUIPMENT: Record<string, string[]> = {
  videograf: ["Sony FX3", "Sony A7 IV", "DJI RS 3", "DJI Mavic 3", "Aputure 300d", "Rode Wireless GO II"],
  montajor: ["MacBook Pro M3", "Monitor 4K", "RTX 4070", "Stream Deck"],
  dizayner: ["MacBook Pro", "Wacom Intuos", "iPad Pro + Apple Pencil", "Monitor 4K"],
  "motion-dizayner": ["MacBook Pro M3 Max", "RTX 4080", "Wacom Cintiq", "Monitor 4K"],
  fotograf: ["Canon R5", "Sony A7R V", "Sigma 35mm f/1.4", "Godox AD600", "Profoto B10"],
  "3d-artist": ["RTX 4090", "Ryzen 9 7950X", "64GB RAM", "Wacom Intuos Pro"],
  "ui-ux": ["MacBook Pro", "iPad Pro", "Monitor 4K"],
  ovoz: ["Shure SM7B", "Neumann TLM 103", "Focusrite Scarlett", "Akustik studiya"],
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

/* Ish turlari (constants WORK_TYPES) — kategoriya bo'yicha mos keladiganlari */
const WORK_TYPES_BY_CAT: Record<string, WorkTypeSlug[]> = {
  videograf: ["toy", "reklama", "korporativ", "musiqiy-klip", "tadbir", "hujjatli"],
  montajor: ["reklama", "kontent-smm", "musiqiy-klip", "hujjatli", "talim", "toy"],
  dizayner: ["reklama", "kontent-smm", "mahsulot", "korporativ", "tadbir"],
  "motion-dizayner": ["reklama", "kontent-smm", "talim", "korporativ", "mahsulot"],
  fotograf: ["toy", "mahsulot", "tadbir", "kochmas-mulk", "kontent-smm"],
  "3d-artist": ["kochmas-mulk", "mahsulot", "reklama", "korporativ"],
  "ui-ux": ["mahsulot", "korporativ", "talim"],
  ovoz: ["reklama", "talim", "hujjatli", "kontent-smm"],
};

/* Paket imkoniyatlari: basic — 2 ta, standard — 3 ta, premium — hammasi */
const PACKAGE_FEATURES: Record<string, string[]> = {
  videograf: ["Suratga olish (2 soatgacha)", "1 daqiqalik montaj", "Rang korreksiya", "Dron kadrlari", "To'liq film + treyler"],
  montajor: ["60 soniyagacha montaj", "Musiqa va subtitr", "Rang korreksiya", "Sound design", "Vertikal + gorizontal versiya"],
  dizayner: ["2 ta konsepsiya", "Manba fayllar (AI, PDF)", "Ijtimoiy tarmoq formatlari", "Brend ranglari va shriftlar", "Mini brendbuk"],
  "motion-dizayner": ["15 soniyagacha animatsiya", "Musiqa bilan", "Logo animatsiya", "Ovoz effektlari", "4K eksport"],
  fotograf: ["1 soatlik fotosessiya", "20 ta retush qilingan surat", "Studiya yorug'ligi", "50 ta retush qilingan surat", "Joyga chiqish"],
  "3d-artist": ["1 ta render (FullHD)", "Modellashtirish", "3 xil burchakdan render", "4K render", "360° panorama"],
  "ui-ux": ["5 ta ekran dizayni", "Mobil versiya", "Interaktiv prototip", "Dizayn tizimi", "Dasturchilarga topshirish"],
  ovoz: ["30 soniyagacha diktor ovozi", "Shovqindan tozalash", "Musiqa bilan miks", "2 ta til", "Mastering"],
};
const PACKAGE_TITLES: Record<schema.PackageKey, string> = { basic: "Tezkor", standard: "Optimal", premium: "Professional" };

const CERTIFICATES: Record<string, schema.Certificate[]> = {
  videograf: [{ title: "Kinooperatorlik kursi", issuer: "IT Park Academy", year: 2021 }, { title: "Dron uchuvchisi sertifikati", issuer: "DJI Academy", year: 2023 }],
  montajor: [{ title: "Adobe Certified Professional — Premiere Pro", issuer: "Adobe", year: 2022, url: "https://certification.adobe.com" }, { title: "DaVinci Resolve Certified User", issuer: "Blackmagic Design", year: 2023 }],
  dizayner: [{ title: "Grafik dizayn asoslari", issuer: "Coursera", year: 2021, url: "https://www.coursera.org" }, { title: "Adobe Certified Professional — Illustrator", issuer: "Adobe", year: 2023 }],
  "motion-dizayner": [{ title: "After Effects motion grafika", issuer: "Domestika", year: 2022 }],
  fotograf: [{ title: "Portret fotografiya ustaxonasi", issuer: "IT Park Academy", year: 2020 }],
  "3d-artist": [{ title: "Arxitektura vizualizatsiyasi kursi", issuer: "Domestika", year: 2022 }],
  "ui-ux": [{ title: "Google UX Design Certificate", issuer: "Coursera", year: 2023, url: "https://www.coursera.org" }],
  ovoz: [{ title: "Ovoz rejissyorligi kursi", issuer: "IT Park Academy", year: 2021 }],
};

const SHORT_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/* E'lonlar (jobs) namunalari */
const JOB_TEMPLATES: Record<string, { title: string; description: string; skills: string[]; budget: [number, number]; budgetType?: "fixed" | "hourly"; deadline: string }> = {
  videograf: { title: "To'y uchun videograf kerak (2 kun)", description: "Noyabr oyida Samarqandda to'y bo'ladi: nikoh va to'y kuni. Cinematic film (5–7 daqiqa) va to'liq versiya kerak. Dron kadrlari bo'lsa yaxshi.", skills: ["Wedding", "Cinematic", "Dron DJI Mavic"], budget: [4_000_000, 6_000_000], deadline: "Noyabr o'rtasi" },
  montajor: { title: "Instagram Reels montaji — oyiga 12 ta", description: "Kafe tarmog'i uchun har hafta 3 ta Reels (30–45 soniya). Xom videolarni biz beramiz, subtitr va musiqa sizdan. Uzoq muddatli hamkorlik.", skills: ["Reels/TikTok", "Premiere Pro", "Subtitr"], budget: [60_000, 90_000], budgetType: "hourly", deadline: "Doimiy" },
  dizayner: { title: "Kafe uchun logo va brending", description: "Yangi ochilayotgan qahvaxona uchun logo, ranglar palitrasi, menyu va stakan dizayni. Zamonaviy, minimalistik uslub. Referenslar bor.", skills: ["Logo", "Brending", "Adobe Illustrator"], budget: [1_000_000, 2_500_000], deadline: "3 hafta ichida" },
  "motion-dizayner": { title: "Fintech ilova uchun 60 soniyalik explainer video", description: "Mobil to'lov ilovasining imkoniyatlarini tushuntiruvchi 2D animatsion video. Ssenariy tayyor, ovoz yozib beramiz. O'zbek va rus tillarida.", skills: ["After Effects", "2D animatsiya", "Infografika"], budget: [2_000_000, 4_000_000], deadline: "1 oy ichida" },
  fotograf: { title: "Mahsulot fotosessiyasi — 40 ta kosmetika", description: "Onlayn do'kon uchun oq fonda va lifestyle uslubida mahsulot suratlari. Har bir mahsulotdan 2–3 ta kadr, retush bilan.", skills: ["Mahsulot", "Studiya yorug'ligi", "Retush"], budget: [1_500_000, 3_000_000], deadline: "2 hafta ichida" },
  "3d-artist": { title: "Turar-joy majmuasi uchun eksteryer render", description: "Farg'onadagi 9 qavatli turar-joy majmuasi: 4 ta kunduzgi va 2 ta kechki render. Arxitektura chizmalari (DWG) mavjud.", skills: ["3ds Max", "Corona", "Eksteryer"], budget: [3_000_000, 6_000_000], deadline: "3 hafta ichida" },
  "ui-ux": { title: "Yetkazib berish ilovasi uchun UI dizayn", description: "Oziq-ovqat yetkazib berish mobil ilovasi: 25–30 ta ekran, dizayn tizimi va Figma prototip. iOS va Android uchun.", skills: ["Figma", "Mobil UI", "Prototip"], budget: [8_000_000, 15_000_000], deadline: "6 hafta ichida" },
  "musiqiy-klip": { title: "Musiqiy klip suratga olish va montaj", description: "Yosh ijrochi uchun 3–4 daqiqalik musiqiy klip: 1 kunlik suratga olish (2 lokatsiya), montaj va rang korreksiya. Ssenariy va g'oya bor.", skills: ["Cinematic", "Yorug'lik", "Rang korreksiya"], budget: [3_000_000, 7_000_000], deadline: "Dekabr boshigacha" },
  ovoz: { title: "Reklama roligi uchun diktor ovozi (uz/ru)", description: "30 soniyalik televizion reklama uchun erkak diktor ovozi, o'zbek va rus tillarida. Matn tayyor, studiya sifatida yozuv kerak.", skills: ["Diktor", "Mastering"], budget: [400_000, 900_000], deadline: "1 hafta ichida" },
};

const PROPOSAL_LETTERS = [
  "Assalomu alaykum! Loyihangiz menga juda qiziq. Shunga o'xshash ishlarim portfolioda bor — ko'rib chiqing. Barcha bosqichlarni o'zim nazorat qilaman va muddatga rioya qilaman.",
  "Salom! Bu yo'nalishda 5 yildan ortiq tajribam bor. Avval qisqa qo'ng'iroqda talablarni aniqlashtirib olsak, birinchi variantni tez tayyorlab beraman.",
  "Yaxshi kun! Tavsifni diqqat bilan o'qidim. Narxga 2 ta tuzatish kiradi, manba fayllarni ham topshiraman. Savollaringiz bo'lsa — yozing.",
  "Assalomu alaykum. Shu kabi loyihalarni yirik brendlar uchun bajarganman. Ish rejasini va oraliq natijalarni har 2–3 kunda yuborib boraman.",
];

const ORDER_TITLES = ["To'y uchun videograf kerak", "Instagram uchun 10 ta Reels montaji", "Kafe uchun logo va menyu dizayni", "Mahsulot fotosessiyasi (30 ta mahsulot)", "YouTube kanal uchun intro", "Interyer 3D render — 2 xona", "Ilova uchun UI dizayn", "Reklama roligiga diktor ovozi"];

function catLabel(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)?.name.toLowerCase() ?? slug;
}

async function main() {
  if (process.argv.includes("--if-empty")) {
    const [row] = await db.select({ n: count() }).from(schema.users);
    const [spRow] = await db.select({ n: count() }).from(schema.specialists);
    // Birorta ham foydalanuvchi bo'lsa — HECH NARSA o'chirilmaydi va seed o'tkazib yuboriladi
    // (avval "katalog bo'sh" holatida 1–20 foydalanuvchili baza ham tozalanib ketar edi).
    // Qayta yuklashni faqat SEED_FORCE=1 bilan ongli ravishda majburlash mumkin.
    if (row.n > 0 && process.env.SEED_FORCE !== "1") {
      console.log(`→ Bazada ${row.n} ta foydalanuvchi (${spRow.n} ta mutaxassis) bor — seed o'tkazib yuborildi. Qayta yuklash uchun: SEED_FORCE=1`);
      return;
    }
    if (row.n > 0) console.warn(`! SEED_FORCE=1 — bazadagi ${row.n} ta foydalanuvchi bilan birga BARCHA ma'lumotlar o'chirilib, demo qayta yuklanadi.`);
  }

  // Production (Vercel/Railway) birinchi deploy: hammaga ma'lum parollar bilan admin/demo hisob yaratilmasin
  const prod = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT);
  const adminPassword = process.env.ADMIN_PASSWORD;
  // Productionda ADMIN_PASSWORD bo'lmasa build TO'XTAMAYDI (avval to'xtar edi va sayt eski versiyada qolib ketdi):
  // admin tasodifiy (noma'lum) parol bilan yaratiladi; ADMIN_PASSWORD env berib qayta deploy qilinsa,
  // scripts/db-prepare.mjs admin parolini shunga o'rnatadi.
  const adminPasswordUsable = Boolean(adminPassword && adminPassword !== "admin12345");
  if (prod && !adminPasswordUsable) {
    console.warn("! ADMIN_PASSWORD berilmagan yoki namunaviy — admin tasodifiy parol bilan yaratiladi (env berib qayta deploy qiling).");
  }
  // Demo hisoblar xaritani to'ldiradi; productionda DEMO_PASSWORD berilmasa parol tasodifiy (kirish mumkin emas)
  const demoPassword = process.env.DEMO_PASSWORD || (prod ? randomBytes(18).toString("base64url") : "demo12345");
  console.log("→ Eski ma'lumotlar tozalanmoqda...");
  await db.delete(schema.messages);
  await db.delete(schema.proposals);
  await db.delete(schema.jobs);
  await db.delete(schema.subscriptionInvoices);
  await db.delete(schema.sessions);
  await db.delete(schema.notifications);
  await db.delete(schema.savedSearches);
  await db.delete(schema.reports);
  await db.delete(schema.favorites);
  await db.delete(schema.payouts);
  await db.delete(schema.payments);
  await db.delete(schema.auditLogs);
  await db.delete(schema.passwordResets);
  await db.delete(schema.reviews);
  await db.delete(schema.orderEvents);
  await db.delete(schema.orders);
  await db.delete(schema.portfolioItems);
  await db.delete(schema.specialists);
  await db.delete(schema.users);

  const pass = await bcrypt.hash(demoPassword, 10);
  const adminPass = await bcrypt.hash(
    prod ? (adminPasswordUsable ? adminPassword! : randomBytes(24).toString("base64url")) : adminPassword || "admin12345",
    10,
  );
  const now = Date.now();
  const DAY = 86_400_000;

  /* ---------- admin ---------- */
  const adminId = uid();
  await db.insert(schema.users).values({
    id: adminId,
    name: "Kasb Egalari Admin",
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
    // Telefon raqam yozilmaydi — namuna ma'lumotlarda haqiqiyga o'xshash raqamlar bo'lmasin
    await db.insert(schema.users).values({ id, name, email, passwordHash: pass, role: "client", gender: /a$/.test(name.split(" ")[0]) ? "female" : "male", createdAt: new Date(now - between(5, 180) * DAY) });
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
      // Telefon va avatar yozilmaydi: haqiqiyga o'xshash raqamlar bo'lmasin, avatar o'rniga bosh harflar chiqadi
      await db.insert(schema.users).values({
        id: userId,
        name,
        email: isDemo ? "mutaxassis@redince.uz" : email,
        passwordHash: pass,
        role: "specialist",
        gender: female ? "female" : "male",
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
        equipment: EQUIPMENT[category].slice(0, 2 + (i % 3)),
        languages: rnd() < 0.6 ? ["uz", "ru"] : rnd() < 0.5 ? ["uz", "ru", "en"] : ["uz"],
        // Telegram/Instagram yozilmaydi — namuna profillar begona (mavjud bo'lishi mumkin) hisoblarga ishora qilmasin
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
  // Parollar jurnalga chiqarilmaydi (faqat dev standarti)
  const demoHint = process.env.DEMO_PASSWORD ? "DEMO_PASSWORD env" : prod ? "tasodifiy — kirish uchun DEMO_PASSWORD env bering" : demoPassword;
  console.log(`  Demo kirishlar (parol: ${demoHint}):`);
  console.log("   • mutaxassis@redince.uz  (mutaxassis)");
  console.log("   • mijoz@redince.uz       (mijoz)");
  console.log(`   • ${process.env.ADMIN_EMAIL ?? "admin@redince.uz"}  (admin, parol: ${adminPassword ? "ADMIN_PASSWORD env" : "admin12345"})`);

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

  let demoInProgressOrderId: string | null = null;
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
    demoInProgressOrderId = o2;
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
    // Buyurtma tarixi (order_events) — demo buyurtmalar uchun namuna
    const specUserId = demoUser.id;
    await db.insert(schema.orderEvents).values([
      { id: uid(), orderId: o1, actorId: demoClientId, type: "status", toStatus: "new", createdAt: new Date(now - 14 * DAY) },
      { id: uid(), orderId: o1, actorId: specUserId, type: "status", fromStatus: "new", toStatus: "accepted", createdAt: new Date(now - 13 * DAY) },
      { id: uid(), orderId: o1, actorId: specUserId, type: "amount", note: "Narx belgilandi: 2 000 000 so'm", createdAt: new Date(now - 13 * DAY) },
      { id: uid(), orderId: o1, actorId: demoClientId, type: "payment", note: "Click orqali to'landi — eskrouda", createdAt: paid1 },
      { id: uid(), orderId: o1, actorId: specUserId, type: "status", fromStatus: "accepted", toStatus: "in_progress", createdAt: new Date(now - 11 * DAY) },
      { id: uid(), orderId: o1, actorId: specUserId, type: "status", fromStatus: "in_progress", toStatus: "done", createdAt: new Date(now - 7 * DAY) },
      { id: uid(), orderId: o1, actorId: demoClientId, type: "payment", note: "Mijoz tasdiqladi — mablag' mutaxassisga o'tdi", createdAt: rel1 },
      { id: uid(), orderId: o2, actorId: demoClientId, type: "status", toStatus: "new", createdAt: new Date(now - 4 * DAY) },
      { id: uid(), orderId: o2, actorId: specUserId, type: "status", fromStatus: "new", toStatus: "accepted", createdAt: new Date(now - 3 * DAY) },
      { id: uid(), orderId: o2, actorId: specUserId, type: "amount", note: "Narx belgilandi: 800 000 so'm", createdAt: new Date(now - 3 * DAY) },
      { id: uid(), orderId: o2, actorId: demoClientId, type: "payment", note: "Payme orqali to'landi — eskrouda", createdAt: paid2 },
      { id: uid(), orderId: o2, actorId: specUserId, type: "status", fromStatus: "accepted", toStatus: "in_progress", createdAt: paid2 },
    ]);
    // Sharhga mutaxassis javobi (namuna)
    const demoReview = await db.query.reviews.findFirst({ where: eq(schema.reviews.specialistId, spId) });
    if (demoReview) {
      await db
        .update(schema.reviews)
        .set({ reply: "Rahmat! Siz bilan ishlash juda yoqimli bo'ldi — yana kutib qolaman.", replyAt: new Date(demoReview.createdAt.getTime() + DAY) })
        .where(eq(schema.reviews.id, demoReview.id));
    }
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

  /* ---------- bajarilgan buyurtmalar soni (denormalizatsiya) + "Top mutaxassis" nishoni ---------- */
  const doneCounts = await db
    .select({ specialistId: schema.orders.specialistId, n: count() })
    .from(schema.orders)
    .where(eq(schema.orders.status, "done"))
    .groupBy(schema.orders.specialistId);
  for (const row of doneCounts) {
    await db.update(schema.specialists).set({ completedCount: row.n }).where(eq(schema.specialists.id, row.specialistId));
  }
  // Namuna qoidasi: reyting 4.8+ va kamida 3 ta sharh
  const top = await db
    .update(schema.specialists)
    .set({ topRated: true })
    .where(and(gte(schema.specialists.rating, 4.8), gte(schema.specialists.reviewCount, 3)))
    .returning({ id: schema.specialists.id });
  console.log(`  Bajarilgan buyurtmalar: ${doneCounts.length} ta mutaxassisda, Top mutaxassis: ${top.length} ta.`);

  /* ================================================================== */
  /* 5-bosqich: qisqa kod, ish turlari, paketlar, obuna, e'lonlar, chat  */
  /* (faqat rnd2/uid2 — yuqoridagi deterministik ma'lumotlar o'zgarmaydi) */
  /* ================================================================== */
  const demoSpId = demoUser?.specialist?.id ?? null;
  const demoClientId = clientIds[clientIds.length - 1]; // mijoz@redince.uz
  const spRows = await db.query.specialists.findMany({
    columns: { id: true, userId: true, category: true, regionSlug: true, priceFrom: true, priceTo: true, createdAt: true },
  });
  const spById = new Map(spRows.map((r) => [r.id, r]));
  const ordered = specialistIds.map((x) => spById.get(x.id)).filter((x): x is (typeof spRows)[number] => Boolean(x));
  const byRegion = (slug: string) => ordered.filter((x) => x.regionSlug === slug);
  // Aynan 2 ta mutaxassis obunasi grace'dan ham o'tib ketgan (katalogdan yashirin), 1 tasi grace'da
  const expiredDaysAgo = new Map<string, number>();
  for (const [sp, days] of [[byRegion("toshkent-shahri")[3], 12], [byRegion("samarqand")[2], 30]] as const) if (sp) expiredDaysAgo.set(sp.id, days);
  const expiredIds = new Set(expiredDaysAgo.keys());
  const graceId = byRegion("buxoro")[1]?.id ?? null;
  // Sinov holatini ko'rsatish uchun bitta yangi profil (12 kun oldin ro'yxatdan o'tgan, hali to'lamagan)
  const trialSeedId = byRegion("toshkent-viloyati")[1]?.id ?? null;
  const round50 = (n: number) => Math.max(50_000, Math.round(n / 50_000) * 50_000);
  const usedCodes = new Set<string>();
  const trialIds: string[] = [];
  const subTrialMs = PLATFORM_DEFAULTS.subscriptionTrialDays * DAY;

  for (const sp of ordered) {
    let shortCode = "";
    do {
      shortCode = Array.from({ length: 6 }, () => pick2([...SHORT_CODE_ALPHABET])).join("");
    } while (usedCodes.has(shortCode));
    usedCodes.add(shortCode);

    const isDemoSp = sp.id === demoSpId;
    const workTypes = pickN2(WORK_TYPES_BY_CAT[sp.category] ?? [], between2(2, 5));

    let packages: schema.ServicePackage[] = [];
    if (isDemoSp || rnd2() < 0.33) {
      const feats = PACKAGE_FEATURES[sp.category] ?? [];
      const tiers: { key: schema.PackageKey; mult: number; days: number; revisions: number; n: number }[] = [
        { key: "basic", mult: 1, days: 3, revisions: 1, n: 2 },
        { key: "standard", mult: 1.8, days: 7, revisions: 3, n: 3 },
        { key: "premium", mult: 3, days: 14, revisions: 5, n: feats.length },
      ];
      packages = tiers.map((t) => ({
        key: t.key,
        title: PACKAGE_TITLES[t.key],
        price: t.key === "premium" ? round50(Math.max(sp.priceTo ?? 0, sp.priceFrom * t.mult)) : round50(sp.priceFrom * t.mult),
        deliveryDays: t.days,
        revisions: t.revisions,
        features: feats.slice(0, t.n),
      }));
    }

    const certificates: schema.Certificate[] = isDemoSp || rnd2() < 0.3 ? pickN2(CERTIFICATES[sp.category] ?? [], between2(1, 3)).map((c) => ({ ...c, year: c.year + between2(0, 3) })) : [];

    let rates: schema.SpecialistRates = {};
    if (isDemoSp || rnd2() < 0.4) {
      rates = { hourly: Math.max(50_000, Math.round(sp.priceFrom / 16 / 10_000) * 10_000), daily: round50(sp.priceFrom) };
      if (rnd2() < 0.6) rates.project = round50(sp.priceTo ?? sp.priceFrom * 3);
    }

    // Obuna: demo — 5 kun qoldi (banner/eslatmalar ko'rinsin); 2 ta — muddati o'tgan; 1 ta — grace;
    // 30 kundan yangi profillar — sinov (null); qolganlari — 20..90 kun oldinga to'langan
    let subscriptionUntil: Date | null;
    const createdAt = sp.id === trialSeedId ? new Date(now - 12 * DAY) : sp.createdAt;
    if (isDemoSp) subscriptionUntil = new Date(now + 5 * DAY);
    else if (expiredDaysAgo.has(sp.id)) subscriptionUntil = new Date(now - (expiredDaysAgo.get(sp.id) ?? 30) * DAY);
    else if (sp.id === graceId) subscriptionUntil = new Date(now - DAY);
    else if (now - createdAt.getTime() < subTrialMs - 3 * DAY) subscriptionUntil = null;
    else subscriptionUntil = new Date(now + between2(20, 91) * DAY);
    if (!isDemoSp && subscriptionUntil === null) trialIds.push(sp.id);

    const blockedDates = isDemoSp ? [3, 4, 10].map((d) => new Date(now + d * DAY).toISOString().slice(0, 10)) : [];

    await db
      .update(schema.specialists)
      .set({ shortCode, workTypes, packages, certificates, rates, subscriptionUntil, blockedDates, createdAt })
      .where(eq(schema.specialists.id, sp.id));
  }

  /* Demo mutaxassisning obuna to'lovlari (2 ta, to'langan) */
  const subscriptionsMade: number[] = [];
  if (demoUser?.specialist) {
    const unit = PLATFORM_DEFAULTS.subscriptionPrice;
    const invoices: { months: number; provider: "payme" | "click"; start: number; end: number }[] = [
      { months: 3, provider: "payme", start: now - 117 * DAY, end: now - 26 * DAY },
      { months: 1, provider: "click", start: now - 26 * DAY, end: now + 5 * DAY },
    ];
    for (const [k, inv] of invoices.entries()) {
      const discountPct = SUBSCRIPTION_PLANS.find((p) => p.months === inv.months)?.discountPct ?? 0;
      const amount = Math.round((unit * inv.months * (100 - discountPct)) / 100 / 1000) * 1000;
      const paidAt = new Date(inv.start - 2 * 3_600_000);
      await db.insert(schema.subscriptionInvoices).values({
        id: uid2(SUBSCRIPTION_INVOICE_PREFIX),
        specialistId: demoUser.specialist.id,
        userId: demoUser.id,
        months: inv.months,
        amount,
        provider: inv.provider,
        state: "paid",
        providerTxnId: `${inv.provider}-seed-sub-${k + 1}`,
        providerState: 2,
        providerCreateTime: paidAt.getTime(),
        performTime: paidAt.getTime(),
        periodStart: new Date(inv.start),
        periodEnd: new Date(inv.end),
        meta: { unitPrice: unit, discountPct },
        paidAt,
        createdAt: paidAt,
        updatedAt: paidAt,
      });
      subscriptionsMade.push(amount);
    }
  }

  /* E'lonlar (8 ta ochiq + 1 ta yollangan) va takliflar */
  const visible = ordered.filter((x) => !expiredIds.has(x.id) && x.id !== demoSpId);
  const demoSp = ordered.find((x) => x.id === demoSpId) ?? null;
  const demoCat = demoSp?.category ?? "motion-dizayner";
  const jobPlan: { clientId: string; category: string; regionSlug: string | null; proposals: number; withDemo?: boolean; hired?: boolean; template?: string }[] = [
    { clientId: demoClientId, category: demoCat, regionSlug: "toshkent-shahri", proposals: 2, withDemo: true },
    { clientId: demoClientId, category: "videograf", regionSlug: "samarqand", proposals: 2 },
    { clientId: clientIds[0], category: "dizayner", regionSlug: null, proposals: 3 },
    { clientId: clientIds[1], category: "montajor", regionSlug: null, proposals: 1 },
    { clientId: clientIds[2], category: "fotograf", regionSlug: "toshkent-shahri", proposals: 1 },
    { clientId: clientIds[3], category: "3d-artist", regionSlug: "fargona", proposals: 0 },
    { clientId: clientIds[4], category: "ui-ux", regionSlug: null, proposals: 2 },
    { clientId: clientIds[0], category: "videograf", regionSlug: "andijon", proposals: 0, template: "musiqiy-klip" },
    { clientId: demoClientId, category: "ovoz", regionSlug: null, proposals: 2, hired: true },
  ];
  let jobsMade = 0;
  let proposalsMade = 0;
  let hiredOrderId: string | null = null;
  for (const [k, plan] of jobPlan.entries()) {
    const tpl = JOB_TEMPLATES[plan.template ?? plan.category] ?? JOB_TEMPLATES.dizayner;
    const jobId = uid2();
    const createdAt = new Date(now - (plan.hired ? 9 : k) * DAY - between2(1, 20) * 3_600_000);
    const pool = visible.filter((x) => x.category === plan.category);
    const proposers = pickN2(pool.length ? pool : visible, plan.proposals).map((x) => ({ sp: x, demo: false }));
    if (plan.withDemo && demoSp) proposers.unshift({ sp: demoSp, demo: true });
    await db.insert(schema.jobs).values({
      id: jobId,
      clientId: plan.clientId,
      title: tpl.title,
      description: tpl.description,
      category: plan.category,
      regionSlug: plan.regionSlug,
      budgetMin: tpl.budget[0],
      budgetMax: tpl.budget[1],
      budgetType: tpl.budgetType ?? "fixed",
      deadline: tpl.deadline,
      skills: tpl.skills,
      status: plan.hired ? "hired" : "open",
      proposalsCount: proposers.length,
      viewCount: between2(8, 160),
      expiresAt: new Date(createdAt.getTime() + JOB_TTL_DAYS * DAY),
      createdAt,
      updatedAt: createdAt,
    });
    jobsMade++;

    for (const [j, p] of proposers.entries()) {
      const proposalId = uid2();
      const amount =
        tpl.budgetType === "hourly" ? Math.round(between2(tpl.budget[0], tpl.budget[1] + 1) / 5_000) * 5_000 : round50(between2(tpl.budget[0], tpl.budget[1] + 1));
      const deliveryDays = between2(3, 21);
      const pCreated = new Date(createdAt.getTime() + (j + 1) * 5 * 3_600_000);
      let status: schema.ProposalStatus = "pending";
      let orderId: string | null = null;
      if (plan.hired) {
        status = j === 0 ? "accepted" : "declined";
        if (j === 0) orderId = uid2();
      } else if (!p.demo && j === 1) status = "shortlisted";

      if (orderId) {
        // E'lon orqali yollangan: buyurtma qabul qilingan, narx belgilangan — to'lov kutilmoqda
        const hiredAt = new Date(pCreated.getTime() + DAY);
        await db.insert(schema.orders).values({
          id: orderId,
          clientId: plan.clientId,
          specialistId: p.sp.id,
          title: tpl.title,
          description: tpl.description,
          budget: amount,
          deadline: tpl.deadline,
          dueDate: new Date(hiredAt.getTime() + deliveryDays * DAY).toISOString().slice(0, 10),
          contactPhone: "+998901112233",
          status: "accepted",
          amount,
          paymentState: "awaiting",
          commissionPct: pct,
          jobId,
          proposalId,
          createdAt: hiredAt,
          updatedAt: hiredAt,
        });
        await db.insert(schema.orderEvents).values([
          { id: uid2(), orderId, actorId: plan.clientId, type: "status", toStatus: "new", note: "E'lon orqali taklif qabul qilindi", createdAt: hiredAt },
          { id: uid2(), orderId, actorId: p.sp.userId, type: "status", fromStatus: "new", toStatus: "accepted", createdAt: hiredAt },
          { id: uid2(), orderId, actorId: p.sp.userId, type: "amount", note: `Narx belgilandi: ${formatPrice(amount)}`, createdAt: hiredAt },
        ]);
        hiredOrderId = orderId;
      }

      await db.insert(schema.proposals).values({
        id: proposalId,
        jobId,
        specialistId: p.sp.id,
        coverLetter: p.demo
          ? "Assalomu alaykum! Aynan shunday loyihalar bilan ishlayman — portfolioda o'xshash ishlarim bor. Birinchi eskizni 3 kunda yuboraman, 2 ta tuzatish narxga kiradi."
          : pick2(PROPOSAL_LETTERS),
        amount,
        deliveryDays,
        status,
        orderId,
        createdAt: pCreated,
        updatedAt: pCreated,
      });
      proposalsMade++;
    }
    if (plan.hired && hiredOrderId) {
      await db.update(schema.jobs).set({ hiredOrderId, updatedAt: new Date(now - 7 * DAY) }).where(eq(schema.jobs.id, jobId));
    }
  }

  /* Demo jarayondagi buyurtma: topshirish sanasi + qisqa chat */
  let messagesMade = 0;
  if (demoInProgressOrderId && demoUser) {
    await db
      .update(schema.orders)
      .set({ dueDate: new Date(now + 4 * DAY).toISOString().slice(0, 10) })
      .where(eq(schema.orders.id, demoInProgressOrderId));
    const t0 = now - 2 * DAY;
    const H = 3_600_000;
    const thread: { senderId: string | null; body: string; at: number; read: boolean; attachments?: schema.FileAttachment[] }[] = [
      { senderId: null, body: "To'lov eskrouda saqlanmoqda. Mutaxassis ishni boshladi.", at: t0, read: true },
      {
        senderId: demoClientId,
        body: "Assalomu alaykum! Kanal logotipi va ranglar kodlarini yubordim, ko'rib chiqing.",
        at: t0 + 1 * H,
        read: true,
        attachments: [{ url: "https://picsum.photos/seed/redince-brand/1200/800", name: "brend-ranglari.png", size: 248_000, type: "image/png" }],
      },
      { senderId: demoUser.id, body: "Va alaykum assalom! Oldim, rahmat. Ertaga intro uchun 2 ta eskiz yuboraman.", at: t0 + 2 * H, read: true },
      {
        senderId: demoUser.id,
        body: "Eskizlar tayyor — qaysi biri ko'proq yoqdi?",
        at: t0 + 26 * H,
        read: true,
        attachments: [
          { url: "https://picsum.photos/seed/redince-eskiz-1/1280/720", name: "eskiz-1.jpg", size: 312_000, type: "image/jpeg" },
          { url: "https://picsum.photos/seed/redince-eskiz-2/1280/720", name: "eskiz-2.jpg", size: 298_000, type: "image/jpeg" },
        ],
      },
      { senderId: demoClientId, body: "Ikkinchisi juda zo'r! Faqat shriftni biroz qalinroq qilsak bo'ladimi?", at: t0 + 30 * H, read: false },
    ];
    for (const m of thread) {
      await db.insert(schema.messages).values({
        id: uid2(),
        orderId: demoInProgressOrderId,
        senderId: m.senderId,
        body: m.body,
        attachments: m.attachments ?? [],
        readAt: m.read ? new Date(m.at + 30 * 60_000) : null,
        createdAt: new Date(m.at),
      });
      messagesMade++;
    }
  }

  /* Seed foydalanuvchilari joriy shartlarni qabul qilgan (demo kirishda qayta so'ralmasin) */
  await db.update(schema.users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: sql`${schema.users.createdAt}` });

  console.log(
    `  Obuna: ${ordered.length - expiredIds.size} faol/sinov/grace, ${expiredIds.size} muddati o'tgan, ${trialIds.length} sinovda; demo to'lovlar: ${subscriptionsMade.join(" + ")} so'm.`,
  );
  console.log(`  E'lonlar: ${jobsMade} ta (1 tasi yollangan → buyurtma), takliflar: ${proposalsMade} ta, chat xabarlari: ${messagesMade} ta.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
