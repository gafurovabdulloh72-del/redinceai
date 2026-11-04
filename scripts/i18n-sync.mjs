#!/usr/bin/env node
/**
 * AVTOMATIK RU LUG'AT SINXRONI (2026-11-04). Koddagi barcha o'zbekcha UI iboralarini (JSX matni, placeholder/title/aria-label,
 * toast/xato satrlari) TypeScript parser bilan yig'adi va `src/lib/i18n/ru-dict.json` bilan solishtiradi:
 *   - yangi (lug'atda yo'q) iboralar → GEMINI_API_KEY bo'lsa Gemini orqali tarjima qilinib lug'atga qo'shiladi;
 *   - kalit yo'q bo'lsa — ro'yxat `scripts/i18n-missing.json` ga yoziladi (Claude/tarjimon to'ldiradi, keyin `--import <fayl>`).
 *   - `--db`: bazadagi `ui_translations` (ru IS NULL) qatorlarini ham tarjima qiladi (prod keshi).
 * Ishlatish: node scripts/i18n-sync.mjs [--dry] [--db] [--import ru-extra.json]
 * db-prepare har deployda `--db`siz chaqiradi (kalit bo'lsa yangi iboralar deploy paytida tarjima bo'ladi).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = process.cwd();
const DICT = path.join(ROOT, "src/lib/i18n/ru-dict.json");
const MISSING = path.join(ROOT, "scripts/i18n-missing.json");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const withDb = args.includes("--db");
const importIdx = args.indexOf("--import");

const norm = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/[‘’ʻʼ`]/g, "'").replace(/\s+/g, " ").trim();
const UZ = /('[a-z]|\b(va|yoki|uchun|bilan|kun|soat|yo'q|bor|emas|kerak|mumkin|yangi|saqlash|bekor|o'chirish|qo'shish|ko'rish|tanlang|yuklash|xato|hali|faqat|barcha|siz|bu|shu|keyin|hozir|ta|lar|ni|ga|da|dan|ning)\b)/i;
function ok(t) {
  t = norm(t);
  if (t.length < 3 || t.length > 160) return null;
  if (/[а-яё]/i.test(t) || !/[a-zA-Z]/.test(t)) return null;
  if (/^[\w./@:#?&=%+-]+$/.test(t) && !/'/.test(t)) return null;
  if (/(^|\s)(flex|grid|text-|bg-|rounded|px-|py-|mt-|mb-|h-|w-|gap-|border|absolute|relative|inline|hidden|block|sm:|md:|lg:|max-|min-|ring-|btn-|field)/.test(t) && !/'/.test(t)) return null;
  if (/^(https?:|\/|mailto|tel:|\(max-|\(min-|\d)/.test(t)) return null;
  if (/(\d+px|\brgba?\(|var\(|env\(|min\(|max\(|color-mix|gradient|serif|\[data-|\[href\]|\[aria-|name=|^Max ·$|^— \/)/.test(t)) return null; // CSS/selektor
  if (!UZ.test(t)) {
    if (!/[xq]/i.test(t) || /\d/.test(t)) return null; // brend/jihoz nomlari (Sony FX3, Godox AD200)
  }
  return t;
}
function extract() {
  const out = new Set();
  const skip = /src[\\/]app[\\/](admin|api)[\\/]/;
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx") && !skip.test(p)) scan(p);
    }
  };
  const scan = (p) => {
    const sf = ts.createSourceFile(p, fs.readFileSync(p, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n) => {
      if (ts.isJsxText(n)) { const v = ok(n.text); if (v) out.add(v); }
      else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
        const nm = n.name.getText();
        if (!/^(className|href|src|id|type|name|rel|target|role|key|action|method|autoComplete|inputMode|enterKeyHint|style|lang|dir|value|defaultValue|htmlFor|form|accept)$/.test(nm) && !nm.startsWith("data-")) { const v = ok(n.initializer.text); if (v) out.add(v); }
      } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isImportDeclaration(n.parent)) {
        const t = n.text;
        if ((/ /.test(t) || /['‘’ʻ]/.test(t)) && !(ts.isJsxAttribute(n.parent) && /className/.test(n.parent.name.getText()))) { const v = ok(t); if (v) out.add(v); }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  };
  walk(path.join(ROOT, "src/components"));
  walk(path.join(ROOT, "src/app"));
  return [...out].sort();
}

async function gemini(texts) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || !texts.length) return null;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const SYSTEM = "Ты переводчик интерфейса веб-приложения «Kasb Egalari» (Узбекистан: маркетплейс видеографов/монтажёров/дизайнеров, соцсеть, курсы наставников, эфиры, вакансии). Переведи КАЖДУЮ строку с узбекского (латиница) на русский: коротко, как в интерфейсе, на «вы», кнопки — инфинитив. Термины: mutaxassis → специалист, ijodkor → автор, mijoz → заказчик, buyurtma → заказ, efir → эфир, ustoz → наставник, jamoa → сообщество, taklif → отклик, e'lon → объявление, so'm → сум, Kasb Egalari — без перевода. Плейсхолдеры {x} сохраняй. Не узбекскую строку верни как есть. Ответ — ТОЛЬКО JSON-массив строк той же длины и порядка.";
  const out = [];
  for (let i = 0; i < texts.length; i += 60) {
    const batch = texts.slice(i, i + 60);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(batch) }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }),
    });
    if (!r.ok) { console.warn("⚠ Gemini", r.status, (await r.text()).slice(0, 160)); return null; }
    const j = await r.json();
    const arr = JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "[]");
    if (!Array.isArray(arr) || arr.length !== batch.length) { console.warn("⚠ Gemini javobi noto'g'ri uzunlikda"); return null; }
    out.push(...arr);
    process.stdout.write(`  …${Math.min(i + 60, texts.length)}/${texts.length}\n`);
  }
  return out;
}

const dict = JSON.parse(fs.readFileSync(DICT, "utf8"));
let changed = 0;

// 1) --import: tashqi fayldan juftliklarni qo'shish (Claude/tarjimon tayyorlagan)
if (importIdx >= 0) {
  const extra = JSON.parse(fs.readFileSync(args[importIdx + 1], "utf8"));
  for (const [k, v] of Object.entries(extra)) { const key = norm(k); if (typeof v === "string" && v.trim() && !dict[key]) { dict[key] = v.trim(); changed++; } }
  console.log(`→ import: ${changed} ta yangi juftlik`);
}

// 2) koddan yangi iboralar
const phrases = extract();
const missing = phrases.filter((p) => !dict[p]);
console.log(`→ kodda ${phrases.length} ta ibora, lug'atda yo'q: ${missing.length}`);
if (missing.length && !dry) {
  const ru = await gemini(missing);
  if (ru) {
    missing.forEach((k, i) => { const v = (ru[i] ?? "").trim(); if (v && v !== k && /[а-яё]/i.test(v)) { dict[k] = v; changed++; } });
    console.log(`→ Gemini: ${changed} ta tarjima qo'shildi`);
  } else {
    fs.writeFileSync(MISSING, JSON.stringify(missing, null, 1) + "\n");
    console.log(`→ GEMINI_API_KEY yo'q — ${missing.length} ta ibora ${path.relative(ROOT, MISSING)} ga yozildi (tarjima qilib --import bilan qo'shing)`);
  }
}

// 3) --db: bazadagi tarjimasiz qatorlar (prod keshi)
if (withDb && !dry) {
  const { createClient } = await import("@libsql/client");
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
  const db = createClient({ url, authToken });
  const rows = (await db.execute("select src from ui_translations where ru is null order by hits desc limit 500")).rows.map((r) => String(r.src));
  const fromDict = rows.filter((s) => dict[s]);
  for (const s of fromDict) await db.execute({ sql: "update ui_translations set ru = ?, source = 'dict', updated_at = ? where src = ?", args: [dict[s], Date.now(), s] });
  const rest = rows.filter((s) => !dict[s]);
  const ru = rest.length ? await gemini(rest) : null;
  let n = fromDict.length;
  if (ru) for (let i = 0; i < rest.length; i++) { const v = (ru[i] ?? "").trim(); if (v && v !== rest[i] && /[а-яё]/i.test(v)) { await db.execute({ sql: "update ui_translations set ru = ?, source = 'ai', updated_at = ? where src = ?", args: [v, Date.now(), rest[i]] }); n++; } }
  console.log(`→ baza: ${rows.length} ta tarjimasiz, to'ldirildi: ${n}`);
}

if (changed && !dry) {
  const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
  fs.writeFileSync(DICT, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`✓ ru-dict.json yangilandi: ${Object.keys(sorted).length} ta ibora`);
} else console.log(dry ? "(dry) o'zgartirilmadi" : "✓ lug'at o'zgarmadi");
