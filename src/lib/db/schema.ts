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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
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

/* Shikoyatlar (mutaxassis profili yoki sharh haqida) */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["specialist", "review"] }).notNull(),
    /** specialists.id yoki reviews.id */
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
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
}));

export const specialistsRelations = relations(specialists, ({ one, many }) => ({
  user: one(users, { fields: [specialists.userId], references: [users.id] }),
  portfolio: many(portfolioItems),
  orders: many(orders),
  reviews: many(reviews),
}));

export const portfolioRelations = relations(portfolioItems, ({ one }) => ({
  specialist: one(specialists, { fields: [portfolioItems.specialistId], references: [specialists.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(users, { fields: [orders.clientId], references: [users.id] }),
  specialist: one(specialists, { fields: [orders.specialistId], references: [specialists.id] }),
  payments: many(payments),
  events: many(orderEvents),
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
