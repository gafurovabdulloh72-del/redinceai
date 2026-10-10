import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __redinceClient?: Client };

/** DATABASE_URL yoki Vercel Turso integratsiyasi beradigan TURSO_DATABASE_URL */
export function dbUrl() {
  return process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
}
export function dbAuthToken() {
  return process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
}

function makeClient(): Client {
  const url = dbUrl();
  // Lokal fayl bo'lsa papkasi mavjudligini ta'minlaymiz (build va birinchi ishga tushishda)
  if (url.startsWith("file:")) {
    try {
      mkdirSync(path.dirname(url.slice(5)), { recursive: true });
    } catch {
      /* read-only FS bo'lsa e'tiborsiz — ulanishda xato chiqadi */
    }
  }
  return createClient({ url, authToken: dbAuthToken() });
}

// Dev rejimida HMR paytida ulanishlar ko'payib ketmasligi uchun globalda saqlaymiz
const client = globalForDb.__redinceClient ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.__redinceClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
