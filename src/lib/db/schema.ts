import { sql, relations } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* Foydalanuvchilar                                                    */
/* ------------------------------------------------------------------ */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["client", "specialist", "admin"] }).notNull().default("client"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    /** Jins (ixtiyoriy) — ro'yxatda saralash uchun */
    gender: text("gender", { enum: ["male", "female"] }),
    /** Chat uchun yagona taxallus (@username) — ro'yxatdan o'tishda avtomatik, sozlamalardan o'zgartiriladi */
    username: text("username"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    /** Google OAuth identifikatori (sub) — «Google bilan kirish» orqali bog'langan hisob */
    googleId: text("google_id"),
    /** Bloklangan hisob: kira olmaydi, profili ro'yxatda chiqmaydi */
    isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
    bannedReason: text("banned_reason"),
    /** Email orqali bildirishnoma olishga rozi */
    notifyEmail: integer("notify_email", { mode: "boolean" }).notNull().default(true),
    /**
     * Telegram bot ulangan chat (bildirishnomalar shu chatga ham boradi); null — ulanmagan.
     * Ulashda bitta chat faqat bitta hisobga tegishli bo'ladi (webhook eski egasidan uzib qo'yadi) —
     * unique indekssiz, dastur darajasida ta'minlanadi.
     */
    telegramChatId: text("telegram_chat_id"),
    /** Sessiya versiyasi: oshirilsa barcha eski JWT'lar bekor bo'ladi (parol o'zgarishi, "hamma qurilmadan chiqish") */
    sessionVersion: integer("session_version").notNull().default(1),
    passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    /** Oxirgi faollik (chat "onlayn" holati uchun) — chat so'rovlarida ~60 soniyada bir yangilanadi */
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    /** Maxfiylik: kim yozishi mumkin (all | following — faqat men obuna bo'lganlar | none), kim izoh yozadi (all | followers | none), onlayn holat ko'rinsinmi */
    dmPolicy: text("dm_policy", { enum: ["all", "following", "none"] }).notNull().default("all"),
    commentPolicy: text("comment_policy", { enum: ["all", "followers", "none"] }).notNull().default("all"),
    showOnline: integer("show_online", { mode: "boolean" }).notNull().default(true),
    /** Bildirishnoma sozlamalari tur-guruh bo'yicha (kabinet): { orders?: false, social?: false, ... } — yo'q kalit = yoqilgan (lib/notifications NOTIFY_GROUPS) */
    notifyPrefs: text("notify_prefs", { mode: "json" }).$type<Record<string, boolean>>().notNull().default({}),
    /** Jamlama xabarnoma (Telegram/email/sayt): off | daily | weekly. Yangi ro'yxatdan o'tganlarga weekly, eskilarga off (lib/digest.ts) */
    digestFreq: text("digest_freq", { enum: ["off", "daily", "weekly"] }).notNull().default("off"),
    /** Oxirgi jamlama yuborilgan (yoki o'tkazib yuborilgan) vaqt — keyingi jamlama oynasi shundan boshlanadi */
    digestLastAt: integer("digest_last_at", { mode: "timestamp_ms" }),
    /** Hisob pauzada (foydalanuvchi o'zi vaqtincha yashirgan): katalog/xarita/qidiruvda chiqmaydi, to'g'ridan-to'g'ri havola ochiladi */
    isPaused: integer("is_paused", { mode: "boolean" }).notNull().default(false),
    /** 2FA (TOTP): sir AES-GCM bilan shifrlangan (payments/crypto.ts); totpEnabled — tasdiqlangandan keyin true */
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
    /** Zaxira kodlari — faqat sha256 hashlari (bir martalik, ishlatilgani o'chiriladi) */
    recoveryCodes: text("recovery_codes", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Qabul qilingan foydalanish shartlari versiyasi (constants TERMS_VERSION) */
    termsVersion: text("terms_version"),
    termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
    /** Admin izohi (faqat admin panelda; foydalanuvchiga ko'rsatilmaydi) va qachon yozilgani */
    adminNote: text("admin_note"),
    adminNoteAt: integer("admin_note_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_username_idx").on(t.username), index("users_google_idx").on(t.googleId)],
);

/* ------------------------------------------------------------------ */
/* Faol sessiyalar (qurilmalar ro'yxati): id = JWT jti                  */
/* ------------------------------------------------------------------ */
export const sessions = sqliteTable(
  "sessions",
  {
    /** JWT jti */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    /** IP manzilning sha256 hashi — xom IP hech qachon saqlanmaydi */
    ipHash: text("ip_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Kunlik faollik (admin analitikasi): har «touch» (sessiya lastSeenAt ≤5 daqiqada bir yangilanganda)
 * bugungi faol daqiqa va tashrif qo'shiladi. `day` — Toshkent kun kaliti floor((ms + 5soat)/86400000).
 * Vaqt taqriban (uzluksiz touch oynalari yig'indisi) — soniyagacha aniq emas, lekin kun/hafta/oy tahlili uchun yetarli.
 */
export const userActivity = sqliteTable(
  "user_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    minutes: integer("minutes").notNull().default(0),
    visits: integer("visits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] }), index("user_activity_day_idx").on(t.day)],
);

/** Har bir shaxsiy maydon kimga ko'rinadi */
export type VisibilityLevel = "public" | "clients" | "orders" | "hidden";
export type VisibilityField = "telegram" | "instagram" | "youtube" | "website" | "phone" | "email" | "schedule" | "gender" | "city";
export type Visibility = Partial<Record<VisibilityField, VisibilityLevel>>;

/** Haftalik ish vaqti */
export interface ScheduleDay {
  enabled: boolean;
  from: string; // "09:00"
  to: string; // "18:00"
}
export interface Schedule {
  days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", ScheduleDay>;
  note?: string;
}

/** Xizmat paketi darajasi (constants PACKAGE_TIERS) */
export type PackageKey = "basic" | "standard" | "premium";
/** Xizmat paketi (Fiverr uslubi): narx so'mda, muddat kunlarda */
export interface ServicePackage {
  key: PackageKey;
  title: string;
  price: number;
  deliveryDays: number;
  revisions: number;
  features: string[];
}
/** Sertifikat / diplom */
export interface Certificate {
  title: string;
  issuer: string;
  year: number;
  url?: string;
}
/** Ish tarixi (LinkedIn uslubi): lavozim, kompaniya/loyiha, yillar (toYear null — hozirgacha). `experience` — daraja (junior…), bu boshqa maydon */
export interface WorkItem {
  role: string;
  company: string;
  fromYear: number;
  toYear?: number | null;
  description?: string;
}
/** Ta'lim: muassasa, yo'nalish/daraja, yillar */
export interface EducationItem {
  school: string;
  degree: string;
  fromYear: number;
  toYear?: number | null;
}
/** Tariflar (so'm): soatbay, kunbay, loyihabay va donabay (1 dona ish — masalan, 1 ta video/fotosurat) */
export interface SpecialistRates {
  hourly?: number;
  daily?: number;
  project?: number;
  unit?: number;
}
/** Biriktirilgan fayl (buyurtma, chat xabari) */
/** Post/story musiqasi: foydalanuvchi yuklagan audio trek (/api/upload purpose="music") va ko'rinadigan nomi */
export interface PostMusic {
  url: string;
  title: string;
  artist?: string;
  /** Trekdan qaysi soniyadan boshlab chalinadi (ixtiyoriy) */
  start?: number;
}

export interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
  /** Ovozli xabar / video davomiyligi (soniya) — klient o'lchaydi, ixtiyoriy */
  duration?: number;
  /** Video muqovasi (rasm URL) — plitka/oldindan ko'rinishda ko'rsatiladi; kompozitor kadrdan yoki yuklangan rasmdan qo'yadi */
  poster?: string;
}

/* ------------------------------------------------------------------ */
/* Mutaxassis profillari (videograf / montajor / dizayner ...)         */
/* ------------------------------------------------------------------ */
export const specialists = sqliteTable(
  "specialists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    /** Qisqa sarlavha: "To'y videografi | Sony FX3" */
    title: text("title").notNull(),
    category: text("category").notNull(),
    regionSlug: text("region_slug").notNull(),
    city: text("city").notNull(),
    bio: text("bio").notNull().default(""),
    /** Narxlar so'mda */
    priceFrom: integer("price_from").notNull().default(0),
    priceTo: integer("price_to"),
    /** Narx valyutasi: UZS (standart) yoki USD. USD bo'lsa mutaxassis dollarda ko'rsatadi (priceUsdFrom/To), priceFrom/To esa so'mdagi ekvivalent (filtr/saralash uchun) */
    priceCurrency: text("price_currency", { enum: ["UZS", "USD"] }).notNull().default("UZS"),
    priceUsdFrom: integer("price_usd_from"),
    priceUsdTo: integer("price_usd_to"),
    experience: text("experience", { enum: ["junior", "middle", "senior", "expert"] }).notNull().default("middle"),
    /** JSON massiv: ["Premiere Pro", "DaVinci"] */
    skills: text("skills", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** JSON massiv: ["uz", "ru", "en"] */
    languages: text("languages", { mode: "json" }).$type<string[]>().notNull().default(["uz"]),
    /** Jihozlar, JSON massiv: ["Sony FX3", "DJI Mavic 3"] */
    equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull().default([]),
    telegram: text("telegram"),
    instagram: text("instagram"),
    youtube: text("youtube"),
    website: text("website"),
    coverUrl: text("cover_url"),
    /** Maydonlar ko'rinishi (maxfiylik sozlamalari) */
    visibility: text("visibility", { mode: "json" }).$type<Visibility>().notNull().default({}),
    /** Ish vaqti jadvali */
    schedule: text("schedule", { mode: "json" }).$type<Schedule | null>(),
    /** Ta'tilda: shu sanagacha buyurtma qabul qilmaydi (ISO sana) */
    vacationUntil: text("vacation_until"),
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    /** Admin katalogdan yashirgan (ro'yxat/xarita/qidiruvda chiqmaydi; to'g'ridan-to'g'ri havola ochiladi) */
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    /** Denormalizatsiya: reytinglar tez o'qilishi uchun */
    rating: real("rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    /** Bajarilgan (done) buyurtmalar soni — denormalizatsiya */
    completedCount: integer("completed_count").notNull().default(0),
    /** "Top mutaxassis" nishoni (reyting + bajarilgan buyurtmalar bo'yicha) */
    topRated: integer("top_rated", { mode: "boolean" }).notNull().default(false),
    /** Xizmat paketlari (basic / standard / premium) */
    packages: text("packages", { mode: "json" }).$type<ServicePackage[]>().notNull().default([]),
    certificates: text("certificates", { mode: "json" }).$type<Certificate[]>().notNull().default([]),
    /** Profil bo'limlari (LinkedIn uslubi): ish tarixi va ta'lim */
    workHistory: text("work_history", { mode: "json" }).$type<WorkItem[]>().notNull().default([]),
    education: text("education", { mode: "json" }).$type<EducationItem[]>().notNull().default([]),
    /** Ish turlari (constants WORK_TYPES slug'lari): ["toy", "reklama"] */
    workTypes: text("work_types", { mode: "json" }).$type<string[]>().notNull().default([]),
    rates: text("rates", { mode: "json" }).$type<SpecialistRates>().notNull().default({}),
    /** Band sanalar (YYYY-MM-DD) — kalendarda belgilanadi */
    blockedDates: text("blocked_dates", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Qisqa havola kodi (6 belgi): /m/{shortCode} */
    shortCode: text("short_code"),
    /** Obuna shu vaqtgacha to'langan; null — sinov muddati createdAt'dan hisoblanadi (subscriptions/access.ts) */
    subscriptionUntil: integer("subscription_until", { mode: "timestamp_ms" }),
    /** Imtiyozli shaxs (admin belgilaydi): obuna talab qilinmaydi, profil doim ko'rinadi */
    isPrivileged: integer("is_privileged", { mode: "boolean" }).notNull().default(false),
    /** Oylik TOP mukofoti: shu vaqtgacha premium imtiyoz (limitlar yo'q); admin/obunadan mustaqil */
    awardPremiumUntil: integer("award_premium_until", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("specialists_slug_idx").on(t.slug),
    uniqueIndex("specialists_user_idx").on(t.userId),
    uniqueIndex("specialists_short_code_idx").on(t.shortCode),
    index("specialists_region_idx").on(t.regionSlug),
    index("specialists_category_idx").on(t.category),
  ],
);

/* ------------------------------------------------------------------ */
/* Portfolio                                                           */
/* ------------------------------------------------------------------ */
export const portfolioItems = sqliteTable(
  "portfolio_items",
  {
    id: text("id").primaryKey(),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type", { enum: ["image", "video", "link"] }).notNull().default("image"),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Oldin/keyin juftligi: beforeUrl — "oldin", url — "keyin" */
    beforeUrl: text("before_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("portfolio_specialist_idx").on(t.specialistId)],
);

/* ------------------------------------------------------------------ */
/* Buyurtmalar (mijoz -> mutaxassis so'rovi)                           */
/* ------------------------------------------------------------------ */
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    budget: integer("budget"),
    deadline: text("deadline"),
    contactPhone: text("contact_phone").notNull(),
    status: text("status", { enum: ["new", "accepted", "in_progress", "done", "cancelled"] })
      .notNull()
      .default("new"),
    /** Kelishilgan narx (so'm) — mutaxassis belgilaydi, mijoz to'laydi */
    amount: integer("amount"),
    /** To'lov holati: none → awaiting (to'lov kutilmoqda) → paid (eskrouda) → released (mutaxassisga o'tdi) / refunded */
    paymentState: text("payment_state", { enum: ["none", "awaiting", "paid", "released", "refunded"] }).notNull().default("none"),
    /** To'lov paytidagi platforma komissiyasi (%), snapshot */
    commissionPct: integer("commission_pct"),
    /** Bekor qilish sababi (kim bekor qilgan bo'lsa yozadi) */
    cancelReason: text("cancel_reason"),
    /** Nizo: none → open (tomonlardan biri ochdi) → resolved (admin hal qildi) */
    disputeState: text("dispute_state", { enum: ["none", "open", "resolved"] }).notNull().default("none"),
    disputeReason: text("dispute_reason"),
    /** Nizoni ochgan foydalanuvchi (users.id) */
    disputeOpenedBy: text("dispute_opened_by"),
    /** Mijoz tasdiqlamasa ham shu vaqtdan keyin eskrou avtomatik mutaxassisga o'tadi */
    autoReleaseAt: integer("auto_release_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    /** Tanlangan xizmat paketi (specialists.packages[].key) */
    packageKey: text("package_key", { enum: ["basic", "standard", "premium"] }),
    /** Shoshilinch buyurtma: urgentFee — qo'shimcha to'lov (so'm, urgentPct bo'yicha) */
    urgent: integer("urgent", { mode: "boolean" }).notNull().default(false),
    urgentFee: integer("urgent_fee"),
    /** Onlayn uchrashuv havolasi (Google Meet / Zoom) */
    meetingUrl: text("meeting_url"),
    /** Topshirish sanasi (YYYY-MM-DD) */
    dueDate: text("due_date"),
    /** Narx bo'yicha qarshi taklif: summa va kim taklif qilgan */
    counterAmount: integer("counter_amount"),
    counterBy: text("counter_by", { enum: ["client", "specialist"] }),
    attachments: text("attachments", { mode: "json" }).$type<FileAttachment[]>().notNull().default([]),
    /** E'lon / taklif orqali yaratilgan bo'lsa (jobs.id, proposals.id) */
    jobId: text("job_id"),
    proposalId: text("proposal_id"),
    /** Cron eslatmalari yuborilgan vaqt (takror yubormaslik uchun) */
    slaRemindedAt: integer("sla_reminded_at", { mode: "timestamp_ms" }),
    dueRemindedAt: integer("due_reminded_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("orders_client_idx").on(t.clientId),
    index("orders_specialist_idx").on(t.specialistId),
    // Cron (SLA, avtomatik release) va admin ro'yxatlari tez ishlashi uchun
    index("orders_status_idx").on(t.status),
    index("orders_payment_state_idx").on(t.paymentState),
    index("orders_auto_release_idx").on(t.autoReleaseAt),
    index("orders_dispute_state_idx").on(t.disputeState),
  ],
);

/* ------------------------------------------------------------------ */
/* Buyurtma tarixi (holat, narx, to'lov, nizo, izoh)                   */
/* ------------------------------------------------------------------ */
export const orderEvents = sqliteTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Kim qilgan (null = tizim, masalan avtomatik release) */
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: ["status", "amount", "payment", "dispute", "note"] }).notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/* ------------------------------------------------------------------ */
/* Sharhlar                                                            */
/* ------------------------------------------------------------------ */
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    /** Mezonlar bo'yicha baho (1–5, ixtiyoriy): constants RATING_CRITERIA */
    quality: integer("quality"),
    timeliness: integer("timeliness"),
    communication: integer("communication"),
    /** Sharhga biriktirilgan rasmlar URL'lari */
    media: text("media", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** "Tavsiya qilaman" (null — javob berilmagan) */
    recommend: integer("recommend", { mode: "boolean" }),
    /** Mutaxassisning javobi (bitta) */
    reply: text("reply"),
    replyAt: integer("reply_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("reviews_specialist_idx").on(t.specialistId), uniqueIndex("reviews_author_specialist_idx").on(t.authorId, t.specialistId)],
);

/* ------------------------------------------------------------------ */
/* To'lovlar (eskrou): mijoz → platforma → (komissiya ayrilib) mutaxassis */
/* ------------------------------------------------------------------ */
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    /** Mijoz to'lagan summa (so'm) */
    amount: integer("amount").notNull(),
    commissionPct: integer("commission_pct").notNull(),
    /** Platformaga qoladigan qism (so'm) */
    commissionAmount: integer("commission_amount").notNull(),
    /** Mutaxassisga tegishli qism (so'm) */
    netAmount: integer("net_amount").notNull(),
    provider: text("provider", { enum: ["payme", "click", "manual"] }).notNull(),
    state: text("state", { enum: ["created", "pending", "paid", "released", "cancelled", "refunded"] }).notNull().default("created"),
    /** Provayder tranzaksiya identifikatori (Payme: id, Click: click_trans_id) */
    providerTxnId: text("provider_txn_id"),
    /** Payme state: 1 (yaratildi), 2 (bajarildi), -1/-2 (bekor) */
    providerState: integer("provider_state"),
    providerCreateTime: integer("provider_create_time"),
    performTime: integer("perform_time"),
    cancelTime: integer("cancel_time"),
    cancelReason: integer("cancel_reason"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_specialist_idx").on(t.specialistId),
    index("payments_client_idx").on(t.clientId),
    index("payments_state_idx").on(t.state),
    uniqueIndex("payments_provider_txn_idx").on(t.provider, t.providerTxnId),
  ],
);

/* Mutaxassisga pul chiqarish so'rovlari */
export const payouts = sqliteTable(
  "payouts",
  {
    id: text("id").primaryKey(),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    state: text("state", { enum: ["requested", "approved", "paid", "rejected"] }).notNull().default("requested"),
    /** Karta raqami / rekvizitlar (maskalangan ko'rinishda saqlash tavsiya) */
    method: text("method", { enum: ["card", "bank", "cash"] }).notNull().default("card"),
    details: text("details").notNull(),
    /** To'liq rekvizitlar — shifrlangan (faqat admin ochadi); details — maskalangan ko'rinish */
    detailsEnc: text("details_enc"),
    note: text("note"),
    /** To'lov o'tkazmasi raqami (admin "to'landi" deb belgilaganda kiritadi) */
    reference: text("reference"),
    processedBy: text("processed_by").references(() => users.id, { onDelete: "set null" }),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("payouts_specialist_idx").on(t.specialistId)],
);

/* Platforma sozlamalari (komissiya foizi va h.k.) — key/value */
export const platformSettings = sqliteTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* Rate limiting (serverless uchun bazada) */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: integer("reset_at").notNull(),
  },
  // Cron har kuni eskirgan qatorlarni resetAt bo'yicha o'chiradi
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
);

/* Audit jurnali */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    ip: text("ip"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("audit_actor_idx").on(t.actorId), index("audit_created_idx").on(t.createdAt), index("audit_action_target_idx").on(t.action, t.targetId)],
);

/* Bir martalik tokenlar: parolni tiklash / emailni tasdiqlash (faqat hash saqlanadi) */
export const passwordResets = sqliteTable(
  "password_resets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /** reset — parolni tiklash; verify_email — emailni tasdiqlash */
    purpose: text("purpose", { enum: ["reset", "verify_email"] }).notNull().default("reset"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("password_resets_hash_idx").on(t.tokenHash), index("password_resets_user_purpose_idx").on(t.userId, t.purpose)],
);

/* Sevimlilar */
export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.specialistId] })],
);

/* Bildirishnomalar */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/* ------------------------------------------------------------------ */
/* Ichki chat (DM): ikki foydalanuvchi o'rtasidagi suhbat               */
/* ------------------------------------------------------------------ */
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    /** Ishtirokchilar: aId < bId (bitta juftlikka bitta suhbat) */
    aId: text("a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bId: text("b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    /** Har bir tomon suhbatni oxirgi ko'rgan vaqti — o'qilmaganlar soni shundan */
    aReadAt: integer("a_read_at", { mode: "timestamp_ms" }),
    bReadAt: integer("b_read_at", { mode: "timestamp_ms" }),
    /** "Yozmoqda…" — har tomon oxirgi marta yozayotganini bildirgan vaqt (6 soniya ichida bo'lsa ko'rsatiladi) */
    aTypingAt: integer("a_typing_at", { mode: "timestamp_ms" }),
    bTypingAt: integer("b_typing_at", { mode: "timestamp_ms" }),
    /** Qadalgan xabar (bitta suhbatga bitta) — ikkala tomon ko'radi */
    pinnedMessageId: text("pinned_message_id"),
    /** Suhbatni kim ochgan — bo'sh (xabarsiz) suhbat faqat yaratuvchining ro'yxatida ko'rinadi (dm_policy chetlab o'tilmasin) */
    createdBy: text("created_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("conversations_pair_idx").on(t.aId, t.bId), index("conversations_a_idx").on(t.aId), index("conversations_b_idx").on(t.bId)],
);

export const dmMessages = sqliteTable(
  "dm_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    attachments: text("attachments", { mode: "json" }).$type<FileAttachment[]>().notNull().default([]),
    /** Javob (iqtibos): shu suhbatdagi xabar id'si; o'chirilsa iqtibos "xabar topilmadi" bo'lib qoladi */
    replyToId: text("reply_to_id"),
    /** Tahrirlangan vaqt (15 daqiqa ichida, faqat o'z xabari) */
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    /** Hamma uchun o'chirilgan — tana/biriktirmalar tozalanadi, o'rinbosar ko'rinadi */
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    /** «Men uchun o'chirish» — shu foydalanuvchilarga ko'rsatilmaydi (JSON: user id ro'yxati) */
    hiddenFor: text("hidden_for", { mode: "json" }).$type<string[]>(),
    /** Yo'naltirilgan xabar — asl muallif ismi (ko'rsatish uchun) */
    forwardedFrom: text("forwarded_from"),
    /** Qo'ng'iroq yozuvi (Telegram kabi): bo'lsa bu oddiy xabar emas, tugagan qo'ng'iroq tarixi. senderId = chaqiruvchi */
    call: text("call", { mode: "json" }).$type<import("@/lib/call/format").CallInfo>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("dm_messages_conv_idx").on(t.conversationId, t.createdAt)],
);

/** DM xabariga emoji reaksiya — bitta foydalanuvchi = bitta reaksiya (almashtiriladi) */
export const dmMessageReactions = sqliteTable(
  "dm_message_reactions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => dmMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("dm_message_reactions_pair_idx").on(t.messageId, t.userId)],
);

/**
 * Video qo'ng'iroq takliflari (Telegram uslubi signalizatsiya): A chaqiradi → B'da jiringlash ekrani.
 * Holat: ringing (jiringlamoqda) → accepted (qabul) | declined (rad) | cancelled (chaqiruvchi bekor qildi)
 *        | missed (javobsiz, ~45s) | ended (tugadi). Jonli jiringlash — bu jadvalni klient polling qiladi.
 */
export const callInvites = sqliteTable(
  "call_invites",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    callerId: text("caller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calleeId: text("callee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** LiveKit xona nomi (dm_<conversationId>) */
    room: text("room").notNull(),
    /** Chaqiruv turi: true = video qo'ng'iroq (kamera yoqilgan), false = oddiy ovozli qo'ng'iroq */
    video: integer("video", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: ["ringing", "accepted", "declined", "cancelled", "missed", "ended"] })
      .notNull()
      .default("ringing"),
    /** Javob berilgan (qabul qilingan) vaqt — davomiylik hisobi uchun */
    answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
    /** Qo'ng'iroq tugagan vaqt */
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    /** Chat tarixiga yozilgan xabar id'si (bir marta yoziladi — CAS) */
    messageId: text("message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("call_invites_callee_idx").on(t.calleeId, t.status), index("call_invites_caller_idx").on(t.callerId, t.status)],
);

/** Suhbat bo'yicha shaxsiy sozlamalar: arxiv, ovozsiz, ro'yxatda qadash — har tomon o'ziniki */
export const dmConversationPrefs = sqliteTable(
  "dm_conversation_prefs",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("dm_conversation_prefs_pair_idx").on(t.conversationId, t.userId)],
);

/* Shikoyatlar (mutaxassis profili yoki sharh haqida) */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["specialist", "review", "user", "post", "comment", "message"] }).notNull(),
    /** specialists.id, reviews.id, users.id (chatdagi shikoyat), posts.id, post_comments.id yoki dm/group xabari id */
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    /** Yopgan admin (users.id) */
    resolvedBy: text("resolved_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("reports_target_idx").on(t.targetType, t.targetId), index("reports_status_idx").on(t.status)],
);

/* Saqlangan qidiruvlar (/mutaxassislar filtrlari) */
export const savedSearches = sqliteTable(
  "saved_searches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Serializatsiya qilingan querystring: "category=videograf&region=samarqand" */
    query: text("query").notNull(),
    /** Yangi mos mutaxassislar haqida bildirishnoma yuborilsinmi */
    notify: integer("notify", { mode: "boolean" }).notNull().default(true),
    /** Xabar chastotasi: daily — har kunlik cron'da; weekly — oxirgi xabardan 7 kun o'tgach */
    frequency: text("frequency", { enum: ["daily", "weekly"] }).notNull().default("daily"),
    lastNotifiedAt: integer("last_notified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* E'lonlar (mijoz loyiha joylaydi, mutaxassislar taklif yuboradi)     */
/* ------------------------------------------------------------------ */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** Kategoriya slug'i (constants CATEGORIES) */
    category: text("category").notNull(),
    /** null — masofadan / istalgan hudud */
    regionSlug: text("region_slug"),
    /** Byudjet (so'm); budgetType=hourly bo'lsa — soatbay */
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    budgetType: text("budget_type", { enum: ["fixed", "hourly"] }).notNull().default("fixed"),
    deadline: text("deadline"),
    skills: text("skills", { mode: "json" }).$type<string[]>().notNull().default([]),
    status: text("status", { enum: ["open", "hired", "closed"] }).notNull().default("open"),
    /** Denormalizatsiya: takliflar soni */
    proposalsCount: integer("proposals_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    /** Yollangan bo'lsa — yaratilgan buyurtma (orders.id) */
    hiredOrderId: text("hired_order_id"),
    /** Shu vaqtdan keyin e'lon avtomatik yopiladi (JOB_TTL_DAYS) */
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("jobs_status_idx").on(t.status),
    index("jobs_category_idx").on(t.category),
    index("jobs_region_idx").on(t.regionSlug),
    index("jobs_client_idx").on(t.clientId),
  ],
);

/* Takliflar (mutaxassis → e'lon) */
export const proposals = sqliteTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    coverLetter: text("cover_letter").notNull(),
    /** Taklif qilingan narx (so'm) */
    amount: integer("amount").notNull(),
    deliveryDays: integer("delivery_days").notNull(),
    status: text("status", { enum: ["pending", "shortlisted", "accepted", "declined", "withdrawn"] }).notNull().default("pending"),
    /** Qabul qilinganda yaratilgan buyurtma (orders.id) */
    orderId: text("order_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("proposals_job_specialist_idx").on(t.jobId, t.specialistId),
    index("proposals_job_idx").on(t.jobId),
    index("proposals_specialist_idx").on(t.specialistId),
  ],
);

/* Buyurtma chati */
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** null — tizim xabari */
    senderId: text("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    attachments: text("attachments", { mode: "json" }).$type<FileAttachment[]>().notNull().default([]),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("messages_order_created_idx").on(t.orderId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Mutaxassis obunasi: oylik to'lov hisoblari (pul jurnali — o'chirilmaydi) */
/* ------------------------------------------------------------------ */
export const subscriptionInvoices = sqliteTable(
  "subscription_invoices",
  {
    id: text("id").primaryKey(),
    /** Mutaxassis o'chirilsa ham yozuv qoladi (SET NULL) */
    specialistId: text("specialist_id").references(() => specialists.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    months: integer("months").notNull(),
    /** To'lanadigan summa (so'm) */
    amount: integer("amount").notNull(),
    provider: text("provider", { enum: ["payme", "click", "manual"] }).notNull(),
    state: text("state", { enum: ["created", "pending", "paid", "cancelled", "refunded"] }).notNull().default("created"),
    /** Provayder tranzaksiya identifikatori (Payme: id, Click: click_trans_id) */
    providerTxnId: text("provider_txn_id"),
    /** Payme state: 1 (yaratildi), 2 (bajarildi), -1/-2 (bekor) */
    providerState: integer("provider_state"),
    providerCreateTime: integer("provider_create_time"),
    performTime: integer("perform_time"),
    cancelTime: integer("cancel_time"),
    cancelReason: integer("cancel_reason"),
    /** To'langanda qo'shilgan davr */
    periodStart: integer("period_start", { mode: "timestamp_ms" }),
    periodEnd: integer("period_end", { mode: "timestamp_ms" }),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("subscription_invoices_provider_txn_idx").on(t.provider, t.providerTxnId),
    index("subscription_invoices_specialist_idx").on(t.specialistId),
  ],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */
export const usersRelations = relations(users, ({ one, many }) => ({
  specialist: one(specialists, { fields: [users.id], references: [specialists.userId] }),
  orders: many(orders),
  reviews: many(reviews),
  orderEvents: many(orderEvents),
  reports: many(reports),
  savedSearches: many(savedSearches),
  sessions: many(sessions),
  jobs: many(jobs),
  messages: many(messages),
  subscriptionInvoices: many(subscriptionInvoices),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const specialistsRelations = relations(specialists, ({ one, many }) => ({
  user: one(users, { fields: [specialists.userId], references: [users.id] }),
  portfolio: many(portfolioItems),
  orders: many(orders),
  reviews: many(reviews),
  proposals: many(proposals),
  subscriptionInvoices: many(subscriptionInvoices),
}));

export const portfolioRelations = relations(portfolioItems, ({ one }) => ({
  specialist: one(specialists, { fields: [portfolioItems.specialistId], references: [specialists.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(users, { fields: [orders.clientId], references: [users.id] }),
  specialist: one(specialists, { fields: [orders.specialistId], references: [specialists.id] }),
  payments: many(payments),
  events: many(orderEvents),
  messages: many(messages),
  job: one(jobs, { fields: [orders.jobId], references: [jobs.id] }),
  proposal: one(proposals, { fields: [orders.proposalId], references: [proposals.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
  actor: one(users, { fields: [orderEvents.actorId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  client: one(users, { fields: [payments.clientId], references: [users.id] }),
  specialist: one(specialists, { fields: [payments.specialistId], references: [specialists.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  specialist: one(specialists, { fields: [payouts.specialistId], references: [specialists.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  specialist: one(specialists, { fields: [favorites.specialistId], references: [specialists.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  specialist: one(specialists, { fields: [reviews.specialistId], references: [specialists.id] }),
  author: one(users, { fields: [reviews.authorId], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, { fields: [savedSearches.userId], references: [users.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(users, { fields: [jobs.clientId], references: [users.id] }),
  proposals: many(proposals),
  hiredOrder: one(orders, { fields: [jobs.hiredOrderId], references: [orders.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one }) => ({
  job: one(jobs, { fields: [proposals.jobId], references: [jobs.id] }),
  specialist: one(specialists, { fields: [proposals.specialistId], references: [specialists.id] }),
  order: one(orders, { fields: [proposals.orderId], references: [orders.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  order: one(orders, { fields: [messages.orderId], references: [orders.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const subscriptionInvoicesRelations = relations(subscriptionInvoices, ({ one }) => ({
  specialist: one(specialists, { fields: [subscriptionInvoices.specialistId], references: [specialists.id] }),
  user: one(users, { fields: [subscriptionInvoices.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Specialist = typeof specialists.$inferSelect;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type OrderEventType = OrderEvent["type"];
export type DisputeState = Order["disputeState"];
export type Review = typeof reviews.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type UserSession = typeof sessions.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobStatus = Job["status"];
export type JobBudgetType = Job["budgetType"];
export type Proposal = typeof proposals.$inferSelect;
export type ProposalStatus = Proposal["status"];
export type OrderMessage = typeof messages.$inferSelect;
export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
export type SubscriptionInvoiceState = SubscriptionInvoice["state"];

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  a: one(users, { fields: [conversations.aId], references: [users.id] }),
  b: one(users, { fields: [conversations.bId], references: [users.id] }),
  messages: many(dmMessages),
}));

export const dmMessagesRelations = relations(dmMessages, ({ one }) => ({
  conversation: one(conversations, { fields: [dmMessages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [dmMessages.senderId], references: [users.id] }),
}));

export type Conversation = typeof conversations.$inferSelect;
export type DmMessage = typeof dmMessages.$inferSelect;
export type CallInvite = typeof callInvites.$inferSelect;

/* ------------------------------------------------------------------ */
/* Jamoalar — ijodkorlar hamjamiyati (guruh, lenta, chat, obuna)        */
/* ------------------------------------------------------------------ */
export const groups = sqliteTable(
  "groups",
  {
    id: text("id").primaryKey(),
    /** URL: /jamoalar/<slug> — nomdan translit + qisqa suffiks */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Yo'nalish (CATEGORIES slug) va hudud (REGIONS slug) — filtr uchun, ikkalasi ixtiyoriy */
    category: text("category"),
    region: text("region"),
    coverUrl: text("cover_url"),
    /** Yopiq jamoa: qo'shilish so'rovi egasi/admin tasdiqlagach faollashadi */
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
    /** Turi: group — hamma a'zo yozadi; channel — faqat egasi/adminlar post yozadi, a'zolar o'qiydi/izoh qoldiradi */
    kind: text("kind", { enum: ["group", "channel"] }).notNull().default("group"),
    /** Rasmiy kanal: har bir ro'yxatdan o'tgan foydalanuvchi avtomatik a'zo, tepada qadalgan, chiqib bo'lmaydi */
    isOfficial: integer("is_official", { mode: "boolean" }).notNull().default(false),
    /** Taklif havolasi kodi (?invite=CODE) — yopiq jamoaga so'rovsiz, darhol a'zo qiladi; egasi yangilay oladi */
    inviteCode: text("invite_code"),
    /** Taklif havolasi muddati va limiti (null — cheksiz); ishlatilgan soni (null = 0) */
    inviteExpiresAt: integer("invite_expires_at", { mode: "timestamp_ms" }),
    inviteMaxUses: integer("invite_max_uses"),
    inviteUses: integer("invite_uses"),
    /** Jamoa qoidalari (markdown-lite: "- " ro'yxat, **qalin**) — egasi yozadi, «Haqida»da chiqadi */
    rules: text("rules"),
    /** Yangi a'zoga xush kelibsiz matni (qo'shilganda bildirishnoma) */
    welcomeText: text("welcome_text"),
    /** Muqova vertikal joylashuvi, 0–100 % (object-position); null = 50 */
    coverPosition: integer("cover_position"),
    /** Slug o'zgartirilganda eski manzil (yo'naltirish uchun) */
    prevSlug: text("prev_slug"),
    /** Chatda qadalgan xabar (group_messages.id) */
    pinnedMessageId: text("pinned_message_id"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Denormalizatsiya: faol a'zolar va postlar soni (ro'yxatda tez ko'rsatish uchun) */
    membersCount: integer("members_count").notNull().default(1),
    postsCount: integer("posts_count").notNull().default(0),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("groups_slug_idx").on(t.slug), index("groups_owner_idx").on(t.ownerId), index("groups_category_idx").on(t.category), index("groups_region_idx").on(t.region)],
);

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull().default("member"),
    /** pending — yopiq jamoaga so'rov; banned — chiqarib yuborilgan (qayta so'rov yubora olmaydi) */
    status: text("status", { enum: ["active", "pending", "banned"] }).notNull().default("active"),
    /** Guruh chatini oxirgi ko'rgan vaqti — o'qilmaganlar soni shundan */
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }),
    /** Bildirishnomalar o'chirilgan (kanal posti/efir xabari kelmaydi; a'zolik saqlanadi) */
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    /** Guruh chatida "yozmoqda…" — oxirgi yozish signali vaqti */
    typingAt: integer("typing_at", { mode: "timestamp_ms" }),
    /** Vaqtincha jim: shu vaqtgacha bildirishnoma kelmaydi (muted=false bo'lsa ham) */
    mutedUntil: integer("muted_until", { mode: "timestamp_ms" }),
    /** Efir eslatmalari (live_event) — null = yoqilgan */
    eventReminders: integer("event_reminders", { mode: "boolean" }),
    /** Yopiq jamoaga so'rov yuborishdagi qisqa izoh — boshqaruvchi ko'radi */
    joinNote: text("join_note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("group_members_pair_idx").on(t.groupId, t.userId), index("group_members_user_idx").on(t.userId)],
);

export const groupMessages = sqliteTable(
  "group_messages",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    attachments: text("attachments", { mode: "json" }).$type<FileAttachment[]>().notNull().default([]),
    /** Javob (iqtibos): shu guruhdagi xabar id'si */
    replyToId: text("reply_to_id"),
    /** Soft delete: o'chirilgan xabar o'rnida «Xabar o'chirilgan» qoladi (javoblar buzilmaydi) */
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    /** Tahrirlangan vaqti («tahrirlangan» belgisi) */
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("group_messages_group_idx").on(t.groupId, t.createdAt)],
);

/** Guruh chati xabariga emoji reaksiya — bitta foydalanuvchi = bitta reaksiya (almashtiriladi), DM bilan bir xil */
export const groupMessageReactions = sqliteTable(
  "group_message_reactions",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => groupMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("group_message_reactions_pair_idx").on(t.messageId, t.userId)],
);

/* Postlar — jamoa lentasi (groupId) yoki shaxsiy devor (groupId null, keyingi bosqich) */
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Efir eslatmalari yuborilganmi: 1 = 1 soat oldin, 2 = 10 daqiqa oldin (bit maska) */
    reminderFlags: integer("reminder_flags").notNull().default(0),
    /** Mentor kanalida: faqat oylik obunachilar (va mentorning o'zi) ko'radi */
    subscribersOnly: integer("subscribers_only", { mode: "boolean" }).notNull().default(false),
    /** Rasm/video biriktirmalari (/api/upload natijalari) */
    media: text("media", { mode: "json" }).$type<FileAttachment[]>().notNull().default([]),
    /** Musiqa (rasmli post/reels ustida chalinadi) — null: yo'q */
    music: text("music", { mode: "json" }).$type<PostMusic | null>(),
    likesCount: integer("likes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    /** Ko'rishlar (noyob: foydalanuvchi yoki mehmon xeshi, kuniga 1 marta — post_views) */
    viewsCount: integer("views_count").notNull().default(0),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    /** Jonli efir / yig'ilish e'loni: vaqti va havolasi (Zoom, Meet, YouTube, Telegram); null — oddiy post */
    eventAt: integer("event_at", { mode: "timestamp_ms" }),
    eventUrl: text("event_url"),
    /** Matn tahrirlangan vaqt (null — tahrirlanmagan). `updatedAt` izoh qo'shilganda ham o'zgaradi, bu ustun — faqat tahrirda */
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("posts_group_idx").on(t.groupId, t.createdAt), index("posts_author_idx").on(t.authorId)],
);

export const postLikes = sqliteTable(
  "post_likes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Reaksiya turi: heart ❤️ (standart), fire 🔥, clap 👏, haha 😂, wow 😮, like 👍 — bitta foydalanuvchi = bitta reaksiya */
    reaction: text("reaction").notNull().default("heart"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("post_likes_pair_idx").on(t.postId, t.userId)],
);

/** Ko'rishlar dedupe jurnali: (post, ko'ruvchi kaliti, kun) — kalit `u:<userId>` yoki `a:<ip+ua xeshi>` */
export const postViews = sqliteTable(
  "post_views",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    viewerKey: text("viewer_key").notNull(),
    /** YYYY-MM-DD (UTC) */
    day: text("day").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("post_views_unique_idx").on(t.postId, t.viewerKey, t.day), index("post_views_day_idx").on(t.day)],
);

/** Saqlangan postlar (bookmark) — faqat egasiga ko'rinadi: /kabinet/saqlanganlar */
export const postSaves = sqliteTable(
  "post_saves",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("post_saves_pair_idx").on(t.postId, t.userId), index("post_saves_user_idx").on(t.userId, t.createdAt)],
);

export const postComments = sqliteTable(
  "post_comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Javob berilgan izoh (1 daraja; shu postdagi izoh) — null: oddiy izoh */
    replyToId: text("reply_to_id"),
    /** Muallif tahrirlagan vaqt (null — tahrirlanmagan) */
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("post_comments_post_idx").on(t.postId, t.createdAt)],
);

/** Izohga yoqtirish (❤️): bitta foydalanuvchi — bitta izoh uchun bitta yurak */
export const commentLikes = sqliteTable(
  "comment_likes",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => postComments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("comment_likes_pair_idx").on(t.commentId, t.userId)],
);

/* ------------------------------------------------------------------ */
/* Lenta qo'shimchalari: so'rovnoma, «qiziq emas», muallifni yashirish  */
/* ------------------------------------------------------------------ */
/** Post so'rovnomasi — bitta post = bitta so'rovnoma; variantlar JSON (2–4 ta matn) */
export const postPolls = sqliteTable(
  "post_polls",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** Variantlar matni (tartib — indeks) */
    options: text("options", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Tugash vaqti (null — muddatsiz) */
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("post_polls_post_idx").on(t.postId)],
);

/** So'rovnoma ovozi — bir foydalanuvchi = bitta variant (qayta bosilsa almashadi/qaytariladi) */
export const postPollVotes = sqliteTable(
  "post_poll_votes",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => postPolls.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionIdx: integer("option_idx").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("post_poll_votes_pair_idx").on(t.pollId, t.userId)],
);

/** «Qiziq emas» — foydalanuvchi lentasidan yashirilgan postlar */
export const postHides = sqliteTable(
  "post_hides",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("post_hides_pair_idx").on(t.postId, t.userId), index("post_hides_user_idx").on(t.userId)],
);

/** Lentada muallifni yashirish (mute) — obuna/blokka tegmaydi, faqat bosh sahifa lentasi */
export const feedMutes = sqliteTable(
  "feed_mutes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("feed_mutes_pair_idx").on(t.userId, t.authorId)],
);

/* Story (Instagram uslubi): 24 soat yashaydigan rasm/video/matn + ixtiyoriy musiqa. Limit: oddiy — sutkasiga 4 ta, premium — cheksiz (lib/social) */
export const stories = sqliteTable(
  "stories",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Rasm yoki video; null — faqat matnli story (rangli fon) */
    media: text("media", { mode: "json" }).$type<FileAttachment | null>(),
    caption: text("caption"),
    /** Matnli story foni (CSS rang/gradient kaliti) */
    bg: text("bg"),
    music: text("music", { mode: "json" }).$type<PostMusic | null>(),
    viewsCount: integer("views_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("stories_author_idx").on(t.authorId, t.createdAt), index("stories_expires_idx").on(t.expiresAt)],
);

/** Story ko'rishlari: kim ko'rgan (muallifga ro'yxat) va halqa «ko'rilgan» holati — bir foydalanuvchi bir marta */
export const storyViews = sqliteTable(
  "story_views",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("story_views_pair_idx").on(t.storyId, t.viewerId), index("story_views_viewer_idx").on(t.viewerId)],
);

/* Oylik TOP g'oliblari: har oyning oxirgi kuni e'lon qilinadi; g'oliblar keyingi oy uchun premium oladi */
export const topAwards = sqliteTable(
  "top_awards",
  {
    id: text("id").primaryKey(),
    /** Oy: YYYY-MM (Toshkent vaqti) */
    month: text("month").notNull(),
    rank: integer("rank").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    views: integer("views").notNull().default(0),
    followers: integer("followers").notNull().default(0),
    /** Premium berilgan muddat (ms) */
    premiumUntil: integer("premium_until", { mode: "timestamp_ms" }),
    publishedAt: integer("published_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("top_awards_month_rank_idx").on(t.month, t.rank), uniqueIndex("top_awards_month_user_idx").on(t.month, t.userId)],
);

/* Musiqa kutubxonasi (ommaviy qidiruv): yuklangan treklar ro'yxatga olinadi, hamma story/postga qo'sha oladi */
export const musicTracks = sqliteTable(
  "music_tracks",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    artist: text("artist"),
    uploaderId: text("uploader_id").references(() => users.id, { onDelete: "set null" }),
    usesCount: integer("uses_count").notNull().default(0),
    isHidden: integer("is_hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("music_tracks_url_idx").on(t.url), index("music_tracks_uses_idx").on(t.usesCount)],
);

/* Obuna (follow): followerId → followingId foydalanuvchini kuzatadi */
export const follows = sqliteTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("follows_pair_idx").on(t.followerId, t.followingId), index("follows_following_idx").on(t.followingId)],
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, { fields: [groups.ownerId], references: [users.id] }),
  members: many(groupMembers),
  posts: many(posts),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(groups, { fields: [groupMessages.groupId], references: [groups.id] }),
  sender: one(users, { fields: [groupMessages.senderId], references: [users.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  group: one(groups, { fields: [posts.groupId], references: [groups.id] }),
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  comments: many(postComments),
}));

/** Bloklash: blocker → blocked (bir tomonlama yozuv, ta'siri ikki tomonlama) */
export const userBlocks = sqliteTable(
  "user_blocks",
  {
    id: text("id").primaryKey(),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("user_blocks_pair_idx").on(t.blockerId, t.blockedId), index("user_blocks_blocked_idx").on(t.blockedId)],
);
export type UserBlock = typeof userBlocks.$inferSelect;

export const postSavesRelations = relations(postSaves, ({ one }) => ({
  post: one(posts, { fields: [postSaves.postId], references: [posts.id] }),
  user: one(users, { fields: [postSaves.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(posts, { fields: [postComments.postId], references: [posts.id] }),
  author: one(users, { fields: [postComments.authorId], references: [users.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id] }),
  following: one(users, { fields: [follows.followingId], references: [users.id] }),
}));

export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type PostSave = typeof postSaves.$inferSelect;
export type PostPoll = typeof postPolls.$inferSelect;
export type PostPollVote = typeof postPollVotes.$inferSelect;

/* ------------------------------------------------------------------ */
/* Vakansiyalar: ish beruvchi e'lonlari, rezyumelar, arizalar          */
/* Barcha onlayn kasblar uchun, to'lovsiz. Kasblar ro'yxati:           */
/* src/lib/vacancies/format.ts (PROFESSIONS)                           */
/* ------------------------------------------------------------------ */
export const vacancies = sqliteTable(
  "vacancies",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Kompaniya / jamoa nomi (ixtiyoriy — shaxs ham e'lon bera oladi) */
    company: text("company").notNull().default(""),
    /** Kasb slug'i (PROFESSIONS) */
    profession: text("profession").notNull(),
    description: text("description").notNull(),
    requirements: text("requirements").notNull().default(""),
    format: text("format", { enum: ["remote", "hybrid", "office"] }).notNull().default("remote"),
    employment: text("employment", { enum: ["full", "part", "project", "internship"] }).notNull().default("full"),
    experience: text("experience", { enum: ["none", "junior", "middle", "senior"] }).notNull().default("none"),
    /** Maosh (so'm/oy); ikkalasi null — "Kelishiladi" */
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    /** null — istalgan hudud (masofaviy) */
    regionSlug: text("region_slug"),
    skills: text("skills", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Tashqi ariza havolasi (hh.uz, Google Form…) — ixtiyoriy; asosiy yo'l sayt ichidagi ariza */
    applyUrl: text("apply_url"),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    applicationsCount: integer("applications_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    /** Tashqi ariza havolasi (applyUrl) bosilishlari — faqat egasiga ko'rinadi */
    applyClicks: integer("apply_clicks").notNull().default(0),
    /** Shu vaqtdan keyin ro'yxatda chiqmaydi (VACANCY_TTL_DAYS); egasi uzaytira oladi */
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    /** Muddat tugashi haqida egasiga eslatma yuborilgan vaqt (cron, bir marta; uzaytirilganda tozalanadi) */
    expireRemindedAt: integer("expire_reminded_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("vacancies_status_idx").on(t.status), index("vacancies_profession_idx").on(t.profession), index("vacancies_author_idx").on(t.authorId)],
);

/** Rezyume — har bir foydalanuvchida bittadan; ommaviy bo'lsa /rezyumelar katalogida chiqadi */
export const resumes = sqliteTable(
  "resumes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Izlanayotgan lavozim: "Frontend dasturchi", "SMM menejer" */
    title: text("title").notNull(),
    profession: text("profession").notNull(),
    summary: text("summary").notNull().default(""),
    skills: text("skills", { mode: "json" }).$type<string[]>().notNull().default([]),
    experience: text("experience", { enum: ["none", "junior", "middle", "senior"] }).notNull().default("none"),
    expectedSalary: integer("expected_salary"),
    format: text("format", { enum: ["any", "remote", "hybrid", "office"] }).notNull().default("any"),
    regionSlug: text("region_slug"),
    /** Portfolio / LinkedIn / GitHub / Behance havolalari */
    links: text("links", { mode: "json" }).$type<Array<{ label: string; url: string }>>().notNull().default([]),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    /** Ommaviy sahifa ko'rishlari (egasi va botlar sanalmaydi) — faqat egasiga ko'rinadi */
    viewCount: integer("view_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("resumes_user_uq").on(t.userId), index("resumes_profession_idx").on(t.profession)],
);

/** Ariza (nomzod → vakansiya); bitta vakansiyaga bir marta */
export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coverLetter: text("cover_letter").notNull().default(""),
    status: text("status", { enum: ["new", "viewed", "shortlisted", "rejected", "hired"] }).notNull().default("new"),
    /** Ish beruvchi arizani birinchi marta ochgan vaqt — nomzodga «Ko'rildi: …» deb ko'rinadi */
    viewedAt: integer("viewed_at", { mode: "timestamp_ms" }),
    /** Ish beruvchining shaxsiy eslatmasi (nomzodga ko'rinmaydi) */
    employerNote: text("employer_note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("applications_vacancy_user_uq").on(t.vacancyId, t.userId), index("applications_user_idx").on(t.userId)],
);

/** Saqlangan vakansiya qidiruvi: nomzodga yangi mos vakansiya chiqqanda bildirishnoma (cron) */
export const vacancyAlerts = sqliteTable(
  "vacancy_alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Kanonik querystring: "profession=video&format=remote&min=3000000" */
    query: text("query").notNull(),
    notify: integer("notify", { mode: "boolean" }).notNull().default(true),
    lastNotifiedAt: integer("last_notified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("vacancy_alerts_user_idx").on(t.userId)],
);
export type VacancyAlert = typeof vacancyAlerts.$inferSelect;

/** Saqlangan vakansiyalar (bookmark) */
export const vacancySaves = sqliteTable(
  "vacancy_saves",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("vacancy_saves_uq").on(t.userId, t.vacancyId)],
);

export type Vacancy = typeof vacancies.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type Application = typeof applications.$inferSelect;

/* ------------------------------------------------------------------ */
/* Profil ko'rishlari (batch-800, profile): kunlik noyob — bir ko'ruvchi (u:<id> / a:<ip+ua xeshi>) bir kunda bir marta.
   specialists.viewCount shu yerda noyob yozuv qo'shilgandagina oshadi. 30 kundan eski qatorlar cron bilan tozalanadi. */
/* ------------------------------------------------------------------ */
export const profileViews = sqliteTable(
  "profile_views",
  {
    id: text("id").primaryKey(),
    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, { onDelete: "cascade" }),
    /** "u:<userId>" yoki "a:<sha256(ip+ua) qisqasi>" */
    viewerKey: text("viewer_key").notNull(),
    /** YYYY-MM-DD (Toshkent) */
    day: text("day").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("profile_views_uq").on(t.specialistId, t.viewerKey, t.day), index("profile_views_sp_day_idx").on(t.specialistId, t.day)],
);

/** Sharh «Foydali» ovozlari (batch-800, profile): bir foydalanuvchi — bir sharhga bir ovoz */
export const reviewVotes = sqliteTable(
  "review_votes",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("review_votes_uq").on(t.reviewId, t.userId), index("review_votes_review_idx").on(t.reviewId)],
);

/* ================================================================== */
/* MENTORLIK (2026-10): ustozlar dars beradi — kurslar, darslar, yozilish, progress, sharhlar.
   Mentor = tasdiqlangan foydalanuvchi (admin). Kurs → darslar (video/matn). Yozilgan talaba progressni yuritadi. */
/* ================================================================== */

/** Mentor (ustoz): dars beruvchi foydalanuvchi — admin tasdig'idan keyin ko'rinadi */
export const mentors = sqliteTable(
  "mentors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Qisqa unvon: "10 yillik montajchi · Premiere Pro ustasi" */
    headline: text("headline").notNull(),
    bio: text("bio").notNull().default(""),
    /** Yo'nalishlar (teglar): JSON string[] — ["montaj","color","motion"] */
    expertise: text("expertise", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Admin tasdig'i: faqat tasdiqlangan mentorlar katalogda va kurs ocha oladi */
    isApproved: integer("is_approved", { mode: "boolean" }).notNull().default(false),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    /** Ommaviy sahifa manzili: /mentorlik/ustoz/{slug} */
    slug: text("slug"),
    /** Katta portret rasm (sahifa hero'sida), muqova va rol yorlig'i ("Modul ustozi") */
    photoUrl: text("photo_url"),
    coverUrl: text("cover_url"),
    roleLabel: text("role_label"),
    /** Ma'lumot kartalari: [{ title, text }] — sahifada "Nima o'rgatadi", yutuqlar va h.k. */
    highlights: text("highlights", { mode: "json" }).$type<Array<{ title: string; text: string }>>().notNull().default([]),
    /** Mentorning kanali (groups, kind=channel): postlar, jonli efir, obunachilar */
    channelId: text("channel_id"),
    /** Oylik obuna narxi (so'm): 0 = o'chiq. Obunachilar yopiq postlarni ko'radi */
    subPrice: integer("sub_price").notNull().default(0),
    /** Tavsiya (referral) chegirmasi foizi: yangi talaba shu foiz chegirma oladi, tavsiya qilgan — shuncha kredit */
    refPercent: integer("ref_percent").notNull().default(10),
    coursesCount: integer("courses_count").notNull().default(0),
    studentsCount: integer("students_count").notNull().default(0),
    rating: real("rating").notNull().default(0),
    reviewsCount: integer("reviews_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("mentors_slug_uq").on(t.slug), uniqueIndex("mentors_user_uq").on(t.userId), index("mentors_approved_idx").on(t.isApproved)],
);

/** Kurs: mentor yaratadi, darslardan iborat */
export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    coverUrl: text("cover_url"),
    /** Kasb/yo'nalish: montaj | videografiya | dizayn | motion | foto | boshqa */
    category: text("category").notNull().default("boshqa"),
    level: text("level", { enum: ["boshlangich", "orta", "pro"] }).notNull().default("boshlangich"),
    /** Narx so'mda; 0 = bepul */
    priceFrom: integer("price_from").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    lessonsCount: integer("lessons_count").notNull().default(0),
    /** Kurs sahifasi ko'rilishlari (tahlil uchun) */
    viewsCount: integer("views_count").notNull().default(0),
    studentsCount: integer("students_count").notNull().default(0),
    rating: real("rating").notNull().default(0),
    reviewsCount: integer("reviews_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("courses_slug_uq").on(t.slug), index("courses_mentor_idx").on(t.mentorId), index("courses_published_idx").on(t.isPublished, t.category)],
);

/** Dars: kurs ichida tartiblangan (video va/yoki matn) */
export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Tartib raqami (1,2,3…) */
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    videoUrl: text("video_url"),
    durationMin: integer("duration_min").notNull().default(0),
    /** Bepul namuna — yozilmasdan ham ko'rsa bo'ladi */
    isPreview: integer("is_preview", { mode: "boolean" }).notNull().default(false),
    /** Dars materiallari (fayllar): preset, loyiha fayli, PDF — faqat yozilganlarga */
    materials: text("materials", { mode: "json" }).$type<Array<{ name: string; url: string; size?: number }>>().notNull().default([]),
    /** Video vaqt belgilari: t — soniya */
    chapters: text("chapters", { mode: "json" }).$type<Array<{ t: number; title: string }>>().notNull().default([]),
    /** Dars testi: o'tish foizi va savollar (to'g'ri javob indeksi faqat serverda) */
    quiz: text("quiz", { mode: "json" }).$type<{ passPct: number; questions: Array<{ q: string; options: string[]; correct: number }> } | null>(),
    /** Uy vazifasi topshirig'i (bo'sh = vazifa yo'q) */
    assignment: text("assignment").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("lessons_course_idx").on(t.courseId, t.position)],
);

/** Yozilish: talaba kursga yozildi (progress bilan) */
export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastLessonId: text("last_lesson_id"),
    /** 0–100 */
    progressPct: integer("progress_pct").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("enrollments_uq").on(t.courseId, t.userId), index("enrollments_user_idx").on(t.userId)],
);

/** Tugatilgan dars: bir foydalanuvchi — bir darsni bir marta */
export const lessonCompletions = sqliteTable(
  "lesson_completions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("lesson_completions_uq").on(t.userId, t.lessonId), index("lesson_completions_course_idx").on(t.courseId, t.userId)],
);

/** Kurs sharhi: yozilgan talaba baho va fikr qoldiradi (bir marta) */
export const courseReviews = sqliteTable(
  "course_reviews",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull().default(5),
    body: text("body").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("course_reviews_uq").on(t.courseId, t.userId), index("course_reviews_course_idx").on(t.courseId)],
);

export const mentorsRelations = relations(mentors, ({ one, many }) => ({
  user: one(users, { fields: [mentors.userId], references: [users.id] }),
  courses: many(courses),
}));
export const coursesRelations = relations(courses, ({ one, many }) => ({
  mentor: one(mentors, { fields: [courses.mentorId], references: [mentors.id] }),
  lessons: many(lessons),
  enrollments: many(enrollments),
  reviews: many(courseReviews),
}));
export const lessonsRelations = relations(lessons, ({ one }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
}));
export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
}));

/** Platforma ichidagi jonli efir (LiveKit): jamoa/kanal egasi translyatsiya qiladi, a'zolar tomosha qiladi. Bir jamoada bir vaqtda bitta jonli efir */
export const liveStreams = sqliteTable(
  "live_streams",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** LiveKit xona nomi (live_<id>) */
    room: text("room").notNull(),
    status: text("status", { enum: ["live", "ended"] }).notNull().default("live"),
    /** Eng ko'p bir vaqtdagi tomoshabin (host yuboradi) */
    peakViewers: integer("peak_viewers").notNull().default(0),
    /** Efir chiptasi narxi (so'm): 0 = bepul. Narxli efir va yozuvni faqat chipta/obuna egalari ko'radi */
    priceSom: integer("price_som").notNull().default(0),
    /** Yozuv (LiveKit Egress → R2): none → recording → processing → ready | failed */
    recordingStatus: text("recording_status", { enum: ["none", "recording", "processing", "ready", "failed"] }).notNull().default("none"),
    recordingEgressId: text("recording_egress_id"),
    recordingUrl: text("recording_url"),
    recordingSeconds: integer("recording_seconds"),
    /** Yozuv muqovasi (mentor tahrirlaydi) */
    coverUrl: text("cover_url"),
    /** Mentor yozuvni ommaviy ro'yxatdan yashirgan */
    recordingHidden: integer("recording_hidden", { mode: "boolean" }).notNull().default(false),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("live_streams_group_idx").on(t.groupId, t.status)],
);


/* ------------------------------------------------------------------ */
/* Mentorlik: pul oqimi (kurs/chipta/obuna/konsultatsiya)             */
/* ------------------------------------------------------------------ */

/** Mentor promokodi: foiz chegirma (kursga bog'langan yoki mentorning barcha pulli mahsulotlariga) */
export const promoCodes = sqliteTable(
  "promo_codes",
  {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    /** Katta harflar, bo'shliqsiz (noyob) */
    code: text("code").notNull(),
    percent: integer("percent").notNull(),
    courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("promo_codes_code_uq").on(t.code), index("promo_codes_mentor_idx").on(t.mentorId)],
);

/** Mentor daromadi: har to'langan sotuv — bir yozuv. pending (7 kun ushlab turiladi) → available → paid_out; qaytarilsa refunded */
export const mentorEarnings = sqliteTable(
  "mentor_earnings",
  {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull(),
    kind: text("kind", { enum: ["course", "ticket", "sub", "consult"] }).notNull(),
    title: text("title").notNull().default(""),
    gross: integer("gross").notNull(),
    fee: integer("fee").notNull(),
    net: integer("net").notNull(),
    status: text("status", { enum: ["pending", "available", "paid_out", "refunded"] }).notNull().default("pending"),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    payoutId: text("payout_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("mentor_earnings_invoice_uq").on(t.invoiceId), index("mentor_earnings_mentor_idx").on(t.mentorId, t.status)],
);

/** Mentorning yechib olish so'rovi (admin kartaga o'tkazib «to'landi» deb belgilaydi) */
export const mentorPayouts = sqliteTable(
  "mentor_payouts",
  {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    card: text("card").notNull(),
    status: text("status", { enum: ["requested", "paid", "rejected"] }).notNull().default("requested"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("mentor_payouts_mentor_idx").on(t.mentorId, t.status)],
);

/** Mentor obunachisi (oylik obuna): until gacha yopiq postlar, narxli efirlar ochiq */
export const mentorSubs = sqliteTable(
  "mentor_subs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    until: integer("until", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("mentor_subs_pair_uq").on(t.userId, t.mentorId)],
);

/** 1:1 konsultatsiya vaqtlari: mentor ochadi, talaba band qiladi va to'laydi */
export const mentorSlots = sqliteTable(
  "mentor_slots",
  {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    priceSom: integer("price_som").notNull().default(0),
    note: text("note").notNull().default(""),
    /** open (bo'sh) → held (to'lov kutilmoqda, 20 daq) → booked (to'langan) | cancelled */
    status: text("status", { enum: ["open", "held", "booked", "cancelled"] }).notNull().default("open"),
    bookedBy: text("booked_by").references(() => users.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id"),
    heldUntil: integer("held_until", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("mentor_slots_mentor_idx").on(t.mentorId, t.startsAt), index("mentor_slots_buyer_idx").on(t.bookedBy)],
);

/** Tavsif kodi: har foydalanuvchida bitta (do'stini kursga olib kelish uchun) */
export const refCodes = sqliteTable(
  "ref_codes",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
  },
  (t) => [uniqueIndex("ref_codes_code_uq").on(t.code)],
);

/** Tavsiya mukofoti: do'sti to'lagach tavsiya qilganga kredit (keyingi xaridda chegirma) */
export const referralRewards = sqliteTable(
  "referral_rewards",
  {
    id: text("id").primaryKey(),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").references(() => users.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id").notNull(),
    amount: integer("amount").notNull(),
    /** Ishlatilgan (yoki band qilingan) hisob */
    consumedInvoiceId: text("consumed_invoice_id"),
    voided: integer("voided", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("referral_rewards_invoice_uq").on(t.invoiceId), index("referral_rewards_ref_idx").on(t.referrerId)],
);


/* ------------------------------------------------------------------ */
/* Mentorlik: o'qitish (test, vazifa, savol-javob, sertifikat, yo'l xaritasi) */
/* ------------------------------------------------------------------ */
export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    scorePct: integer("score_pct").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("quiz_attempts_user_lesson_idx").on(t.userId, t.lessonId)],
);

/** Uy vazifasi: talaba topshiradi, mentor baholaydi; showcase — «Talabalar ishi» bo'limida ko'rsatish */
export const assignmentSubmissions = sqliteTable(
  "assignment_submissions",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    fileUrl: text("file_url"),
    status: text("status", { enum: ["pending", "reviewed", "needs_work"] }).notNull().default("pending"),
    grade: integer("grade"),
    feedback: text("feedback").notNull().default(""),
    showcase: integer("showcase", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("assignment_submissions_uq").on(t.lessonId, t.userId), index("assignment_submissions_course_idx").on(t.courseId, t.status)],
);

/** Dars ostidagi savol-javob: savol (parentId yo'q) va javoblar; mentor «foydali» deb belgilaydi */
export const lessonComments = sqliteTable(
  "lesson_comments",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    isHelpful: integer("is_helpful", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("lesson_comments_lesson_idx").on(t.lessonId, t.createdAt)],
);

/** Sertifikat: kurs to'liq tugatilganda (barcha darslar + testlar) beriladi; ommaviy tekshiriladi */
export const certificates = sqliteTable(
  "certificates",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("certificates_code_uq").on(t.code), uniqueIndex("certificates_pair_uq").on(t.userId, t.courseId)],
);

/** Yo'l xaritasi: mentor kurslarini ketma-ketlikka yig'adi */
export const roadmaps = sqliteTable(
  "roadmaps",
  {
    id: text("id").primaryKey(),
    mentorId: text("mentor_id")
      .notNull()
      .references(() => mentors.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Kurs id'lari tartib bilan */
    courseIds: text("course_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("roadmaps_mentor_idx").on(t.mentorId)],
);


/* ------------------------------------------------------------------ */
/* Jonli efir: savollar va so'rovnoma                                  */
/* ------------------------------------------------------------------ */
export const liveQuestions = sqliteTable(
  "live_questions",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    votes: integer("votes").notNull().default(0),
    answered: integer("answered", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("live_questions_stream_idx").on(t.streamId, t.votes)],
);

export const liveQuestionVotes = sqliteTable(
  "live_question_votes",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => liveQuestions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("live_question_votes_pair_idx").on(t.questionId, t.userId)],
);

/** Efirdagi so'rovnoma: bir vaqtda bitta ochiq; variantlar JSON, ovozlar alohida jadvalda */
export const livePolls = sqliteTable(
  "live_polls",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: text("options", { mode: "json" }).$type<string[]>().notNull(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("live_polls_stream_idx").on(t.streamId)],
);

export const livePollVotes = sqliteTable(
  "live_poll_votes",
  {
    pollId: text("poll_id")
      .notNull()
      .references(() => livePolls.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionIdx: integer("option_idx").notNull(),
  },
  (t) => [uniqueIndex("live_poll_votes_pair_idx").on(t.pollId, t.userId)],
);

export const mentorSlotsRelations = relations(mentorSlots, ({ one }) => ({
  mentor: one(mentors, { fields: [mentorSlots.mentorId], references: [mentors.id] }),
}));
export const mentorPayoutsRelations = relations(mentorPayouts, ({ one }) => ({
  mentor: one(mentors, { fields: [mentorPayouts.mentorId], references: [mentors.id] }),
}));

export type Mentor = typeof mentors.$inferSelect;
/** Efir chati tarixi (kech kirganlar ko'radi; realtime LiveKit data kanalida) */
export const liveMessages = sqliteTable(
  "live_messages",
  {
    id: text("id").primaryKey(),
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("live_messages_stream_idx").on(t.streamId, t.createdAt)],
);

/** Efirdan chiqarib yuborilgan tomoshabinlar (shu efirga qayta kira olmaydi) */
export const liveBans = sqliteTable(
  "live_bans",
  {
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("live_bans_pair_idx").on(t.streamId, t.userId)],
);

/** Sahnaga chiqarilgan tomoshabinlar — qayta ulanganda (token qayta olinganda) ruxsat saqlanadi */
export const liveStage = sqliteTable(
  "live_stage",
  {
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("live_stage_pair_idx").on(t.streamId, t.userId)],
);

/** Narxli efir chiptalari (to'langan) */
export const liveTickets = sqliteTable(
  "live_tickets",
  {
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("live_tickets_pair_idx").on(t.streamId, t.userId)],
);

export type LiveStream = typeof liveStreams.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type CourseReview = typeof courseReviews.$inferSelect;
