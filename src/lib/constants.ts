/**
 * Loyihaning asosiy lug'atlari: hududlar va mutaxassislik kategoriyalari.
 * Bu yerdagi slug'lar bazada saqlanadi — o'zgartirishda ehtiyot bo'ling.
 */

export interface Region {
  slug: string;
  name: string;
  short: string;
  capital: string;
  /** Hudud ichidagi yirik shaharlar (profilda "shahar" tanlovi uchun) */
  cities: string[];
}

export const REGIONS: Region[] = [
  { slug: "toshkent-shahri", name: "Toshkent shahri", short: "Toshkent sh.", capital: "Toshkent", cities: ["Toshkent"] },
  { slug: "toshkent-viloyati", name: "Toshkent viloyati", short: "Toshkent vil.", capital: "Nurafshon", cities: ["Nurafshon", "Chirchiq", "Angren", "Olmaliq", "Bekobod", "Yangiyo'l", "Parkent"] },
  { slug: "andijon", name: "Andijon viloyati", short: "Andijon", capital: "Andijon", cities: ["Andijon", "Asaka", "Xonobod", "Shahrixon", "Qo'rg'ontepa"] },
  { slug: "fargona", name: "Farg'ona viloyati", short: "Farg'ona", capital: "Farg'ona", cities: ["Farg'ona", "Qo'qon", "Marg'ilon", "Quvasoy", "Rishton"] },
  { slug: "namangan", name: "Namangan viloyati", short: "Namangan", capital: "Namangan", cities: ["Namangan", "Chust", "Pop", "Kosonsoy", "Uchqo'rg'on"] },
  { slug: "samarqand", name: "Samarqand viloyati", short: "Samarqand", capital: "Samarqand", cities: ["Samarqand", "Kattaqo'rg'on", "Urgut", "Ishtixon", "Jomboy"] },
  { slug: "buxoro", name: "Buxoro viloyati", short: "Buxoro", capital: "Buxoro", cities: ["Buxoro", "Kogon", "G'ijduvon", "Vobkent", "Romitan"] },
  { slug: "navoiy", name: "Navoiy viloyati", short: "Navoiy", capital: "Navoiy", cities: ["Navoiy", "Zarafshon", "Uchquduq", "Nurota", "Karmana"] },
  { slug: "qashqadaryo", name: "Qashqadaryo viloyati", short: "Qashqadaryo", capital: "Qarshi", cities: ["Qarshi", "Shahrisabz", "Kitob", "G'uzor", "Koson"] },
  { slug: "surxondaryo", name: "Surxondaryo viloyati", short: "Surxondaryo", capital: "Termiz", cities: ["Termiz", "Denov", "Sho'rchi", "Boysun", "Jarqo'rg'on"] },
  { slug: "jizzax", name: "Jizzax viloyati", short: "Jizzax", capital: "Jizzax", cities: ["Jizzax", "G'allaorol", "Zomin", "Paxtakor", "Do'stlik"] },
  { slug: "sirdaryo", name: "Sirdaryo viloyati", short: "Sirdaryo", capital: "Guliston", cities: ["Guliston", "Yangiyer", "Shirin", "Sirdaryo", "Boyovut"] },
  { slug: "xorazm", name: "Xorazm viloyati", short: "Xorazm", capital: "Urganch", cities: ["Urganch", "Xiva", "Xonqa", "Shovot", "Pitnak"] },
  { slug: "qoraqalpogiston", name: "Qoraqalpog'iston Respublikasi", short: "Qoraqalpog'iston", capital: "Nukus", cities: ["Nukus", "Xo'jayli", "Beruniy", "To'rtko'l", "Taxiatosh", "Mo'ynoq"] },
];

export const REGION_BY_SLUG: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.slug, r]));

export interface Category {
  slug: string;
  name: string;
  plural: string;
  description: string;
  /** lucide icon nomi (UI tomonda map qilinadi) */
  icon: "video" | "scissors" | "palette" | "camera" | "sparkles" | "box" | "mic" | "pen-tool";
  accent: string;
}

export const CATEGORIES: Category[] = [
  { slug: "videograf", name: "Videograf", plural: "Videograflar", description: "To'y, reklama, event va korporativ suratga olish", icon: "video", accent: "#f97316" },
  { slug: "montajor", name: "Montajor", plural: "Montajorlar", description: "Video montaj, rang korreksiya, ovoz dizayni", icon: "scissors", accent: "#8b5cf6" },
  { slug: "dizayner", name: "Grafik dizayner", plural: "Dizaynerlar", description: "Logo, brending, poster, SMM dizayn", icon: "palette", accent: "#ec4899" },
  { slug: "motion-dizayner", name: "Motion dizayner", plural: "Motion dizaynerlar", description: "2D/3D animatsiya, intro, infografika", icon: "sparkles", accent: "#06b6d4" },
  { slug: "fotograf", name: "Fotograf", plural: "Fotograflar", description: "Portret, mahsulot, to'y va event fotosessiya", icon: "camera", accent: "#eab308" },
  { slug: "3d-artist", name: "3D artist", plural: "3D artistlar", description: "3D modellashtirish, render, vizualizatsiya", icon: "box", accent: "#22c55e" },
  { slug: "ui-ux", name: "UI/UX dizayner", plural: "UI/UX dizaynerlar", description: "Sayt va mobil ilova interfeyslari", icon: "pen-tool", accent: "#3b82f6" },
  { slug: "ovoz", name: "Ovoz rejissyori", plural: "Ovoz rejissyorlari", description: "Dublyaj, ovoz yozish, musiqa montaji", icon: "mic", accent: "#f43f5e" },
];

export const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

export const ORDER_STATUSES = ["new", "accepted", "in_progress", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Yangi",
  accepted: "Qabul qilindi",
  in_progress: "Jarayonda",
  done: "Bajarildi",
  cancelled: "Bekor qilindi",
};

export const EXPERIENCE_LEVELS = [
  { value: "junior", label: "Boshlang'ich (1 yilgacha)" },
  { value: "middle", label: "O'rta (1–3 yil)" },
  { value: "senior", label: "Tajribali (3–6 yil)" },
  { value: "expert", label: "Ekspert (6+ yil)" },
] as const;

export const SITE = {
  name: "Redince",
  tagline: "O'zbekistonning ijodiy mutaxassislar xaritasi",
  description:
    "Redince — O'zbekistonning barcha viloyatlaridagi videograf, montajor, dizayner va boshqa ijodkorlarni bir joyda topish platformasi. Xaritadan hududni tanlang va o'zingizga mos mutaxassisni toping.",
};
