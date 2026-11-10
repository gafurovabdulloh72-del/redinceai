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
  const client = createClient({ url, authToken: dbAuthToken() });
  if (!url.startsWith("file:")) return client;
  // WAL: o'quvchilar yozuvchini (va aksincha) kutmaydi; rejim faylda saqlanadi. Bajarilmasa (fayl band / faqat o'qish) — e'tiborsiz.
  void client.execute("PRAGMA journal_mode = WAL").catch(() => undefined);
  return withBusyRetry(client);
}

/**
 * LOKAL FAYL REJIMI (VPS, dev, CI) — «database is locked» himoyasi (7-audit).
 * SQLite'da bir vaqtda BITTA yozuvchi bo'ladi. Lokal mijoz har `db.transaction()` uchun alohida ulanish ochadi va kutish
 * vaqti nolga teng: tranzaksiya ochiq turgan paytda boshqa so'rovning oddiy yozuvi ham (tezlik cheklovi hisoblagichi,
 * ko'rish sanog'i…) yoki ikkinchi tranzaksiya DARHOL `SQLITE_BUSY` oladi va foydalanuvchi 500 ko'radi. Xuddi shunday —
 * bazaga boshqa jarayon yozayotganda ham (zaxira nusxa, xizmat skripti, test fixture'i).
 * Yechim: band bo'lsa qisqa (asinxron) kutib qayta urinamiz — kutish paytida voqealar halqasi bo'sh, ya'ni ochiq
 * tranzaksiya o'z ishini tugatadi. `SQLITE_BUSY` qulf OLINMAGANINI bildiradi (so'rov bajarilmagan), shuning uchun takrorlash
 * xavfsiz; tranzaksiya ICHIDAGI so'rovlar takrorlanmaydi (ular `tx` obyekti orqali ketadi, qulf allaqachon bizda).
 *
 * MUHIM — har `SQLITE_BUSY` dan keyin ulanish YANGILANADI (`reconnect`). Band bo'lib yiqilgan so'rov ulanishda «tugamagan»
 * holda qoladi; SQLite esa avtomatik commit'ni ulanishdagi OXIRGI so'rov tugagandagina qiladi. Natijada shu ulanishdagi
 * keyingi yozuvlar xatosiz «o'tadi», lekin bazaga YOZILMAYDI, navbatdagi tranzaksiya esa «cannot commit transaction —
 * SQL statements in progress» bilan yiqilib, o'sha yozuvlarni ham bekor qiladi (jimgina ma'lumot yo'qolishi — tajribada
 * tasdiqlangan: scratchpad `lock/probe3.mjs`). Yangi ulanish bu holatni tozalaydi; so'rovlar sinxron bajarilgani uchun
 * yopilayotgan ulanishda yarim yo'lda qolgan boshqa ish bo'lmaydi (tranzaksiyalar o'z ulanishida — ularga tegilmaydi).
 * Turso (masofaviy) rejimida bu qatlam yo'q — u yerda navbatni server o'zi boshqaradi.
 */
const BUSY_WAITS_MS = [15, 30, 60, 120, 240, 480];
function isBusy(e: unknown): boolean {
  const x = e as { code?: unknown; message?: unknown; cause?: unknown } | null;
  if (!x || typeof x !== "object") return false;
  if (x.code === "SQLITE_BUSY" || /SQLITE_BUSY|database is locked/i.test(String(x.message ?? ""))) return true;
  return x.cause ? isBusy(x.cause) : false;
}
const RETRIED = new Set<string | symbol>(["execute", "batch", "executeMultiple", "migrate", "transaction"]);
function withBusyRetry(client: Client): Client {
  return new Proxy(client, {
    get(target, prop) {
      // Xususiy maydonlar (#db) faqat asl obyektda ishlaydi — metodlar ham, getter'lar ham `target` nomidan chaqiriladi
      const value = Reflect.get(target, prop, target) as unknown;
      if (typeof value !== "function") return value;
      const fn = value as (...a: unknown[]) => unknown;
      if (!RETRIED.has(prop)) return fn.bind(target);
      return async (...args: unknown[]) => {
        for (let i = 0; ; i++) {
          try {
            return await fn.apply(target, args);
          } catch (e) {
            if (!isBusy(e)) throw e;
            // Avval ulanishni tozalaymiz (yuqoridagi izoh) — qayta urinish tugagan bo'lsa ham
            try {
              await (target.reconnect() as unknown as Promise<void> | void);
            } catch {
              /* yangi ulanish ochilmasa — keyingi so'rov o'zi ochadi */
            }
            if (i >= BUSY_WAITS_MS.length) throw e;
            await new Promise((r) => setTimeout(r, BUSY_WAITS_MS[i] + Math.random() * 10));
          }
        }
      };
    },
  });
}

// Dev rejimida HMR paytida ulanishlar ko'payib ketmasligi uchun globalda saqlaymiz
const client = globalForDb.__redinceClient ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForDb.__redinceClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
