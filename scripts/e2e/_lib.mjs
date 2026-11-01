/**
 * E2E testlar umumiy kutubxonasi (kamchilik #86 — /tmp'dan repoga ko'chirildi, CI'da yuradi).
 * Sessiyalar: seed demo hisoblari bilan API orqali kirish (DEMO_PASSWORD/ADMIN_PASSWORD env);
 * lokalda kirish ishlamasa /tmp/*.jar (curl cookie jar) zaxira sifatida o'qiladi.
 * Baza: DATABASE_URL (CI'da file:./data/ci.db, lokalda file:./data/redince.db).
 */
import fs from "node:fs";
import { createClient } from "@libsql/client";

export const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
export const db = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo12345";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function jar(p) {
  try {
    return fs
      .readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l && (!l.startsWith("#") || l.startsWith("#HttpOnly_")))
      .map((l) => l.replace("#HttpOnly_", "").split("\t"))
      .filter((a) => a.length >= 7)
      .map((a) => `${a[5]}=${a[6]}`)
      .join("; ");
  } catch {
    return "";
  }
}

async function login(email, password) {
  if (!password) return "";
  try {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { Origin: BASE, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    if (!r.ok) return "";
    const list = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") ?? ""];
    return list.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

/** sp (mutaxassis), cl (mijoz), ad (admin) sessiya cookie'lari */
export async function cookies() {
  const C = {
    sp: (await login("mutaxassis@redince.uz", DEMO_PASSWORD)) || jar("/tmp/sp.jar"),
    cl: (await login("mijoz@redince.uz", DEMO_PASSWORD)) || jar("/tmp/cl.jar"),
    ad: (await login(process.env.ADMIN_EMAIL || "admin@redince.uz", ADMIN_PASSWORD)) || jar("/tmp/ad.jar"),
  };
  if (!C.cl || !C.sp) throw new Error("E2E: demo sessiyalar olinmadi — seed va DEMO_PASSWORD ni tekshiring");
  return C;
}

export function makeReq(C) {
  return (who, path, init = {}) => fetch(BASE + path, { ...init, headers: { cookie: C[who], origin: BASE, "content-type": "application/json", ...(init.headers ?? {}) } });
}

let fail = 0;
export const ok = (cond, name, extra = "") => {
  console.log((cond ? "✅" : "❌") + " " + name + (extra ? ` (${extra})` : ""));
  if (!cond) fail++;
};
export const finish = () => {
  console.log(fail ? `FAIL (${fail})` : "OK");
  process.exit(fail ? 1 : 0);
};
