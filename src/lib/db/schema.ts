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
    /** Bloklangan hisob: kira olmaydi, profili ro'yxatda chiqmaydi */
    isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
    bannedReason: text("banned_reason"),
    /** Email orqali bildirishnoma olishga rozi */
    notifyEmail: integer("notify_email", { mode: "boolean" }).notNull().default(true),
    /** Sessiya versiyasi: oshirilsa barcha eski JWT'lar bekor bo'ladi (parol o'zgarishi, "hamma qurilmadan chiqish") */
    sessionVersion: integer("session_version").notNull().default(1),
    passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    /** Oxirgi faollik (chat "onlayn" holati uchun) — chat so'rovlarida ~60 soniyada bir yangilanadi */
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    /** 2FA (TOTP): sir AES-GCM bilan shifrlangan (payments/crypto.ts); totpEnabled — tasdiqlangandan keyin true */
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
    /** Zaxira kodlari — faqat sha256 hashlari (bir martalik, ishlatilgani o'chiriladi) */
    recoveryCodes: text("recovery_codes", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Qabul qilingan foydalanish shartlari versiyasi (constants TERMS_VERSION) */
    termsVersion: text("terms_version"),
    termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_username_idx").on(t.username)],
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
/** Tariflar (so'm): soatbay, kunbay, loyihabay va donabay (1 dona ish — masalan, 1 ta video/fotosurat) */
export interface SpecialistRates {
  hourly?: number;
  daily?: number;
  project?: number;
  unit?: number;
}
/** Biriktirilgan fayl (buyurtma, chat xabari) */
export interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
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
  (t) => [index("orders_client_idx").on(t.clientId), index("orders_specialist_idx").on(t.specialistId)],
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
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: integer("reset_at").notNull(),
});

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
  (t) => [index("audit_actor_idx").on(t.actorId), index("audit_created_idx").on(t.createdAt)],
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("dm_messages_conv_idx").on(t.conversationId, t.createdAt)],
);

/* Shikoyatlar (mutaxassis profili yoki sharh haqida) */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["specialist", "review", "user"] }).notNull(),
    /** specialists.id, reviews.id yoki users.id (chatdagi shikoyat) */
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
