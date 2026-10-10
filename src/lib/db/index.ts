import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __redinceClient?: Client };

function makeClient(): Client {
  const url = process.env.DATABASE_URL ?? "file:./data/redince.db";
  // Lokal fayl bo'lsa papkasi mavjudligini ta'minlaymiz (build va birinchi ishga tushishda)
  if (url.startsWith("file:")) {
    try {
      mkdirSync(path.dirname(url.slice(5)), { recursive: true });
    } catch {
      /* read-only FS bo'lsa e'tiborsiz — ulanishda xato chiqadi */
    }
  }
  return createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
}

// Dev rejimida HMR paytida ulanishlar ko'payib ketmasligi uchun globalda saqlaymiz
const client = globalForDb.__redinceClient ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.__redinceClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
