/**
 * Kasblar (mutaxassislik yo'nalishlari) — Upwork uslubida guruhlangan katalog.
 * DIQQAT: slug'lar bazada saqlanadi (specialists.category, jobs.category, groups.category) — mavjud slug'larni o'zgartirmang,
 * faqat yangi qo'shing. Dastlabki 8 ta (videograf … ovoz) o'z rangi bilan saqlangan; qolganlari guruh rangini oladi.
 */

export type CategoryIconName =
  | "video" | "scissors" | "palette" | "camera" | "sparkles" | "box" | "mic" | "pen-tool"
  | "clapperboard" | "film" | "plane" | "code" | "smartphone" | "globe" | "bot" | "terminal" | "database" | "shield"
  | "bug" | "megaphone" | "target" | "search" | "share" | "mail" | "trending" | "pen-line" | "languages" | "book"
  | "file-text" | "music" | "headphones" | "image" | "layers" | "brush" | "wand" | "printer" | "package" | "presentation"
  | "building" | "home" | "gamepad" | "glasses" | "briefcase" | "users" | "calculator" | "clipboard" | "headset" | "graduation"
  | "brain" | "cpu" | "keyboard" | "radio" | "podcast" | "type" | "message" | "handshake" | "scale" | "banknote" | "shirt"
  | "ruler" | "layout" | "aperture" | "newspaper" | "captions" | "cuboid" | "blocks" | "workflow" | "server" | "rocket"
  | "lightbulb" | "store" | "shopping-bag" | "user-check" | "bar-chart" | "pie-chart" | "sheet" | "pencil" | "crop" | "tv" | "cast";

export interface Category {
  slug: string;
  name: string;
  plural: string;
  description: string;
  /** lucide icon (UI tomonda CategoryIcon map qiladi) */
  icon: CategoryIconName;
  accent: string;
  /** CATEGORY_GROUPS kaliti */
  group: CategoryGroupSlug;
}

export const CATEGORY_GROUPS = [
  { slug: "video", name: "Video va animatsiya", icon: "clapperboard", accent: "#df7a5a" },
  { slug: "dizayn", name: "Dizayn va brending", icon: "palette", accent: "#d4709a" },
  { slug: "foto", name: "Foto va retush", icon: "camera", accent: "#cfa24e" },
  { slug: "uch-d", name: "3D, arxitektura va o'yin", icon: "box", accent: "#6aa884" },
  { slug: "audio", name: "Audio va musiqa", icon: "headphones", accent: "#a3729b" },
  { slug: "dasturlash", name: "Dasturlash va IT", icon: "code", accent: "#5f87d6" },
  { slug: "marketing", name: "Marketing va SMM", icon: "megaphone", accent: "#e0875a" },
  { slug: "yozuv", name: "Yozuv va tarjima", icon: "pen-line", accent: "#7d8fa8" },
  { slug: "biznes", name: "Biznes va boshqaruv", icon: "briefcase", accent: "#8a7b64" },
  { slug: "data", name: "Ma'lumotlar va AI", icon: "brain", accent: "#4fa3ad" },
  { slug: "talim", name: "Ta'lim va murabbiylik", icon: "graduation", accent: "#7aa45c" },
] as const satisfies ReadonlyArray<{ slug: string; name: string; icon: CategoryIconName; accent: string }>;

export type CategoryGroupSlug = (typeof CATEGORY_GROUPS)[number]["slug"];
export const CATEGORY_GROUP_BY_SLUG = Object.fromEntries(CATEGORY_GROUPS.map((g) => [g.slug, g])) as Record<CategoryGroupSlug, (typeof CATEGORY_GROUPS)[number]>;

type Row = [slug: string, name: string, plural: string, description: string, icon: CategoryIconName, accent?: string];

const build = (group: CategoryGroupSlug, rows: Row[]): Category[] =>
  rows.map(([slug, name, plural, description, icon, accent]) => ({ slug, name, plural, description, icon, accent: accent ?? CATEGORY_GROUP_BY_SLUG[group].accent, group }));

export const CATEGORIES: Category[] = [
  // — Video va animatsiya —
  ...build("video", [
    ["videograf", "Videograf", "Videograflar", "To'y, reklama, event va korporativ suratga olish", "video", "#df7a5a"],
    ["montajor", "Montajor", "Montajorlar", "Video montaj, rang korreksiya, ovoz dizayni", "scissors", "#8b7fd1"],
    ["motion-dizayner", "Motion dizayner", "Motion dizaynerlar", "2D/3D animatsiya, intro, infografika", "sparkles", "#4fa3ad"],
    ["reels-maker", "Reels / Shorts yaratuvchi", "Reels yaratuvchilar", "Qisqa vertikal videolar: Instagram, TikTok, YouTube Shorts", "film"],
    ["dronograf", "Dronograf", "Dronograflar", "Dron bilan havodan suratga olish", "plane"],
    ["animator", "2D animator", "2D animatorlar", "Multfilm, personaj va izohlovchi animatsiya", "pencil"],
    ["kolorist", "Kolorist", "Koloristlar", "Rang korreksiya va grading (DaVinci, Premiere)", "aperture"],
    ["vfx-artist", "VFX / kompozitor", "VFX artistlar", "Vizual effektlar, kompozitsiya, rotoskoping", "wand"],
    ["video-prodyuser", "Video prodyuser", "Video prodyuserlar", "Loyihani boshidan oxirigacha boshqarish: g'oya, syomka, montaj", "clapperboard"],
    ["jonli-efir", "Jonli efir rejissyori", "Jonli efir rejissyorlari", "Onlayn translyatsiya, vMix/OBS, multikamera", "cast"],
  ]),
  // — Dizayn va brending —
  ...build("dizayn", [
    ["dizayner", "Grafik dizayner", "Dizaynerlar", "Logo, brending, poster, SMM dizayn", "palette", "#d4709a"],
    ["ui-ux", "UI/UX dizayner", "UI/UX dizaynerlar", "Sayt va mobil ilova interfeyslari", "pen-tool", "#6b8fcf"],
    ["logo-brending", "Logo va brend dizayner", "Brend dizaynerlar", "Logotip, brendbuk, korporativ uslub", "lightbulb"],
    ["illyustrator", "Illyustrator", "Illyustratorlar", "Raqamli va qo'lda chizilgan illyustratsiyalar, personajlar", "brush"],
    ["veb-dizayner", "Veb-dizayner", "Veb-dizaynerlar", "Landing, internet-do'kon va sayt dizayni (Figma, Tilda)", "globe"],
    ["smm-dizayner", "SMM dizayner", "SMM dizaynerlar", "Ijtimoiy tarmoq postlari, storis, banner, karusel", "layout"],
    ["prezentatsiya", "Prezentatsiya dizayner", "Prezentatsiya dizaynerlari", "Taqdimot, pitch-deck, hisobot dizayni", "presentation"],
    ["infografika", "Infografika dizayner", "Infografika dizaynerlari", "Ma'lumotni tushunarli vizual ko'rinishga keltirish", "pie-chart"],
    ["poligrafiya", "Poligrafiya dizayner", "Poligrafiya dizaynerlari", "Buklet, vizitka, menyu, katalog maketi", "printer"],
    ["qadoq-dizayner", "Qadoq dizayner", "Qadoq dizaynerlari", "Mahsulot qadoqi, etiketka, packaging", "package"],
    ["kiyim-dizayner", "Kiyim va merch dizayner", "Kiyim dizaynerlari", "Kiyim eskizi, bosma (print), merch", "shirt"],
    ["shrift-dizayner", "Tipografiya / shrift dizayner", "Shrift dizaynerlari", "Lettering, kalligrafiya, shrift yaratish", "type"],
  ]),
  // — Foto va retush —
  ...build("foto", [
    ["fotograf", "Fotograf", "Fotograflar", "Portret, mahsulot, to'y va event fotosessiya", "camera", "#cfa24e"],
    ["toy-fotograf", "To'y va event fotografi", "To'y fotograflari", "To'y, nikoh, tug'ilgan kun va tadbirlar", "aperture"],
    ["mahsulot-fotograf", "Mahsulot fotografi", "Mahsulot fotograflari", "Internet-do'kon, marketplace va katalog uchun", "shopping-bag"],
    ["portret-fotograf", "Portret / lifestyle fotograf", "Portret fotograflari", "Shaxsiy brend, oilaviy, love-story", "image"],
    ["retusher", "Retusher", "Retusherlar", "Foto retush, rang, restavratsiya", "crop"],
    ["ugc-kreator", "UGC kreator", "UGC kreatorlar", "Brendlar uchun tabiiy ko'rinishdagi foto/video kontent", "smartphone"],
  ]),
  // — 3D, arxitektura va o'yin —
  ...build("uch-d", [
    ["3d-artist", "3D artist", "3D artistlar", "3D modellashtirish, render, vizualizatsiya", "box", "#6aa884"],
    ["3d-modeler", "3D modeler", "3D modelerlar", "Mahsulot, personaj va ob'ekt modellari (Blender, Maya)", "cuboid"],
    ["arxitektura-vizual", "Arxitektura vizualizatori", "Arxitektura vizualizatorlari", "Bino va loyihalarning fotorealistik renderi", "building"],
    ["interyer-dizayner", "Interyer dizayner", "Interyer dizaynerlar", "Xona va ofis interyeri loyihasi, 3D vizualizatsiya", "home"],
    ["cad-chizmachi", "CAD / chizma mutaxassisi", "CAD chizmachilar", "AutoCAD, Revit, texnik chizmalar", "ruler"],
    ["ar-vr", "AR / VR ishlab chiquvchi", "AR/VR mutaxassislari", "Kengaytirilgan va virtual reallik tajribalari", "glasses"],
    ["game-artist", "O'yin artisti", "O'yin artistlari", "O'yin uchun personaj, muhit, UI va aktivlar", "gamepad"],
    ["3d-animator", "3D animator", "3D animatorlar", "Personaj va mahsulot 3D animatsiyasi, rigging", "blocks"],
  ]),
  // — Audio va musiqa —
  ...build("audio", [
    ["ovoz", "Ovoz rejissyori", "Ovoz rejissyorlari", "Dublyaj, ovoz yozish, musiqa montaji", "mic", "#a3729b"],
    ["diktor", "Diktor / ovoz aktyori", "Diktorlar", "Reklama, audiokitob va video uchun ovoz", "mic"],
    ["dublyaj", "Dublyaj aktyori", "Dublyaj aktyorlari", "Kino va seriallarni o'zbek/rus tillariga ovozlash", "headphones"],
    ["musiqa-prodyuser", "Musiqa prodyuseri", "Musiqa prodyuserlari", "Beat, aranjirovka, miksing va mastering", "music"],
    ["bastakor", "Bastakor", "Bastakorlar", "Reklama, kino va o'yin uchun original musiqa", "music"],
    ["saund-dizayner", "Saund dizayner", "Saund dizaynerlar", "Ovoz effektlari, atmosfera, foley", "radio"],
    ["podkast-muharrir", "Podkast muharriri", "Podkast muharrirlari", "Podkast yozish, tozalash va montaj", "podcast"],
  ]),
  // — Dasturlash va IT —
  ...build("dasturlash", [
    ["frontend", "Frontend dasturchi", "Frontend dasturchilar", "React, Vue, Next.js — sayt interfeysi", "code"],
    ["backend", "Backend dasturchi", "Backend dasturchilar", "Node.js, Python, PHP, Go — server va API", "server"],
    ["fullstack", "Full-stack dasturchi", "Full-stack dasturchilar", "Frontend va backend birga: boshidan oxirigacha", "terminal"],
    ["mobil-dasturchi", "Mobil ilova dasturchisi", "Mobil dasturchilar", "iOS, Android, Flutter, React Native", "smartphone"],
    ["wordpress", "WordPress / Tilda mutaxassisi", "WordPress mutaxassislari", "Tayyor platformalarda sayt va do'kon", "globe"],
    ["telegram-bot", "Telegram bot dasturchisi", "Bot dasturchilar", "Telegram botlar, mini-ilovalar, avtomatlashtirish", "bot"],
    ["game-dev", "O'yin dasturchisi", "O'yin dasturchilari", "Unity, Unreal, Godot", "gamepad"],
    ["1c-dasturchi", "1C dasturchisi", "1C dasturchilar", "1C sozlash, hisobotlar va integratsiya", "database"],
    ["qa-tester", "QA tester", "QA testerlar", "Qo'lda va avtomatik testlash, xatolarni topish", "bug"],
    ["devops", "DevOps muhandisi", "DevOps muhandislar", "Server, CI/CD, bulutli infratuzilma", "workflow"],
    ["kiber-xavfsizlik", "Kiber xavfsizlik mutaxassisi", "Kiber xavfsizlik mutaxassislari", "Xavfsizlik auditi, pentest, himoya", "shield"],
    ["no-code", "No-code ishlab chiquvchi", "No-code mutaxassislar", "Bubble, Webflow, Airtable, Zapier", "blocks"],
  ]),
  // — Marketing va SMM —
  ...build("marketing", [
    ["smm-menejer", "SMM menejer", "SMM menejerlar", "Ijtimoiy tarmoqlarni yuritish, kontent-reja", "share"],
    ["targetolog", "Targetolog", "Targetologlar", "Instagram/Facebook/TikTok target reklama", "target"],
    ["kontekst-reklama", "Google Ads mutaxassisi", "Kontekst reklama mutaxassislari", "Google Ads, YouTube va Yandex reklama", "search"],
    ["seo", "SEO mutaxassisi", "SEO mutaxassislari", "Saytni qidiruvda ko'tarish, texnik audit", "trending"],
    ["marketolog", "Marketolog", "Marketologlar", "Strategiya, voronka, tahlil", "bar-chart"],
    ["kontent-menejer", "Kontent menejer", "Kontent menejerlar", "Kontent strategiyasi, nashr, hamjamiyat boshqaruvi", "newspaper"],
    ["email-marketing", "Email marketing mutaxassisi", "Email marketologlar", "Xat-jo'natmalar, avtomatik ketma-ketliklar", "mail"],
    ["brend-strateg", "Brend strateg", "Brend strateglar", "Joylashuv, ohang, brend platformasi", "lightbulb"],
    ["influencer-menejer", "Influencer marketing menejeri", "Influencer menejerlar", "Bloggerlar bilan ishlash, kampaniyalar", "users"],
    ["pr-menejer", "PR menejer", "PR menejerlar", "OAV bilan aloqa, press-reliz, obro'", "megaphone"],
  ]),
  // — Yozuv va tarjima —
  ...build("yozuv", [
    ["kopirayter", "Kopirayter", "Kopirayterlar", "Sotuvchi matnlar, reklama, saytlar uchun", "pen-line"],
    ["kontent-yozuvchi", "Kontent yozuvchi", "Kontent yozuvchilar", "Maqola, blog, post va ssenariylar", "file-text"],
    ["ssenarist", "Ssenarist", "Ssenaristlar", "Video, reklama va qisqa filmlar ssenariysi", "clapperboard"],
    ["tarjimon", "Tarjimon", "Tarjimonlar", "Yozma tarjima: o'zbek, rus, ingliz va boshqa tillar", "languages"],
    ["sinxron-tarjimon", "Og'zaki / sinxron tarjimon", "Sinxron tarjimonlar", "Tadbir va uchrashuvlarda og'zaki tarjima", "message"],
    ["muharrir", "Muharrir / korrektor", "Muharrirlar", "Matnni tahrirlash, imlo va uslub tekshiruvi", "pencil"],
    ["texnik-yozuvchi", "Texnik yozuvchi", "Texnik yozuvchilar", "Yo'riqnoma, hujjatlar, dokumentatsiya", "book"],
    ["subtitr", "Subtitr va transkripsiya", "Subtitr mutaxassislari", "Video subtitrlari, audio → matn", "captions"],
  ]),
  // — Biznes va boshqaruv —
  ...build("biznes", [
    ["virtual-assistent", "Virtual assistent", "Virtual assistentlar", "Pochta, kalendar, hujjatlar, masofaviy yordam", "user-check"],
    ["loyiha-menejer", "Loyiha menejeri", "Loyiha menejerlari", "Loyihani rejalash, jamoa va muddatlar", "clipboard"],
    ["mahsulot-menejer", "Mahsulot menejeri", "Mahsulot menejerlari", "Product management, roadmap, foydalanuvchi tadqiqoti", "layers"],
    ["sotuv-menejer", "Sotuv menejeri", "Sotuv menejerlari", "B2B/B2C sotuv, savdo skriptlari, CRM", "store"],
    ["mijozlar-xizmati", "Mijozlar xizmati / support", "Mijozlar xizmati mutaxassislari", "Chat, qo'ng'iroq va pochta orqali qo'llab-quvvatlash", "headset"],
    ["buxgalter", "Buxgalter", "Buxgalterlar", "Hisob-kitob, soliq, hisobotlar", "calculator"],
    ["moliya-tahlilchi", "Moliyaviy tahlilchi", "Moliyaviy tahlilchilar", "Byudjet, biznes-reja, moliyaviy model", "banknote"],
    ["hr-mutaxassis", "HR mutaxassisi", "HR mutaxassislari", "Xodim qidirish, intervyu, adaptatsiya", "users"],
    ["biznes-konsultant", "Biznes konsultant", "Biznes konsultantlar", "Jarayonlar, strategiya, o'sish rejasi", "handshake"],
    ["huquqshunos", "Yurist / huquqshunos", "Huquqshunoslar", "Shartnomalar, ro'yxatdan o'tkazish, maslahat", "scale"],
  ]),
  // — Ma'lumotlar va AI —
  ...build("data", [
    ["data-analitik", "Data analitik", "Data analitiklar", "Ma'lumotlarni tahlil qilish, hisobotlar, dashboardlar", "bar-chart"],
    ["bi-dashboard", "BI / dashboard mutaxassisi", "BI mutaxassislari", "Power BI, Looker, Tableau", "pie-chart"],
    ["ai-muhandis", "AI / ML muhandisi", "AI muhandislar", "Mashinaviy o'rganish, modellar, integratsiya", "cpu"],
    ["prompt-muhandis", "Prompt muhandisi / AI avtomatlashtirish", "Prompt muhandislar", "ChatGPT/Claude yechimlari, AI agentlar, avtomatlashtirish", "brain"],
    ["malumot-kiritish", "Ma'lumot kiritish operatori", "Ma'lumot kiritish operatorlari", "Jadval, katalog va bazalarni to'ldirish", "keyboard"],
    ["excel-mutaxassis", "Excel / Google Sheets mutaxassisi", "Excel mutaxassislari", "Formulalar, makroslar, hisobot shablonlari", "sheet"],
  ]),
  // — Ta'lim va murabbiylik —
  ...build("talim", [
    ["repetitor", "Repetitor", "Repetitorlar", "Fan va imtihonlarga tayyorlash (onlayn/oflayn)", "book"],
    ["til-oqituvchi", "Til o'qituvchisi", "Til o'qituvchilari", "Ingliz, rus, koreys va boshqa tillar", "languages"],
    ["kurs-muallifi", "Onlayn kurs muallifi", "Kurs mualliflari", "Video-kurs yaratish, dasturini tuzish", "graduation"],
    ["mentor-trener", "Mentor / trener", "Mentorlar", "Kasbiy mentorlik, biznes va ijodiy treninglar", "users"],
    ["kasbiy-ustoz", "Kasbiy ustoz (dizayn/video/IT)", "Kasbiy ustozlar", "Amaliy mahorat darslari: montaj, dizayn, dasturlash", "rocket"],
  ]),
];

export const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

/** Guruhlangan ko'rinish (menyu uchun): [{ group, items }] — CATEGORIES tartibida */
export const CATEGORIES_BY_GROUP = CATEGORY_GROUPS.map((g) => ({ group: g, items: CATEGORIES.filter((c) => c.group === g.slug) }));

/**
 * Chiplar ro'yxati uchun: mutaxassisi bor (yoki tanlangan) kasblar, soni bo'yicha kamayish tartibida, `limit` ta.
 * Kasblar ko'p bo'lgani uchun hammasini chip qilib chiqarish mumkin emas — qolganlari CategoryPicker orqali.
 */
export function topCategories(counts: Record<string, number>, active?: string | null, limit = 10): Category[] {
  const list = CATEGORIES.filter((c) => (counts[c.slug] ?? 0) > 0 || c.slug === active);
  list.sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0));
  const top = list.slice(0, limit);
  if (active && !top.some((c) => c.slug === active)) {
    const a = CATEGORY_BY_SLUG[active];
    if (a) top.push(a);
  }
  return top;
}
