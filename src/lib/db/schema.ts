import { sql, relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

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
    telegram: text("telegram"),
    instagram: text("instagram"),
    youtube: text("youtube"),
    website: text("website"),
    coverUrl: text("cover_url"),
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    /** Denormalizatsiya: reytinglar tez o'qilishi uchun */
    rating: real("rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("reviews_specialist_idx").on(t.specialistId), uniqueIndex("reviews_author_specialist_idx").on(t.authorId, t.specialistId)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */
export const usersRelations = relations(users, ({ one, many }) => ({
  specialist: one(specialists, { fields: [users.id], references: [specialists.userId] }),
  orders: many(orders),
  reviews: many(reviews),
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

export const ordersRelations = relations(orders, ({ one }) => ({
  client: one(users, { fields: [orders.clientId], references: [users.id] }),
  specialist: one(specialists, { fields: [orders.specialistId], references: [specialists.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  specialist: one(specialists, { fields: [reviews.specialistId], references: [specialists.id] }),
  author: one(users, { fields: [reviews.authorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Specialist = typeof specialists.$inferSelect;
export type PortfolioItem = typeof portfolioItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Review = typeof reviews.$inferSelect;
