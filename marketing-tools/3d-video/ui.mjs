// Telefon/monitor ekranlari uchun sahifa ko'rinishlari (sayt dizayn tizimi: krem, ink, marjon, Manrope).
// node ui.mjs screens.json outDir
// screens.json: [{ "name": "p1", "type": "chat|checklist|map|list|reels|topics|form|resume|stats|card|qa", "states": 3, ...params }]
// Qoida: hech qanday ism, reyting, ko'rish soni yo'q — faqat UI yorliqlari va skeletlar.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [specPath, outDir, W = "780", H = "1688"] = process.argv.slice(2);
const screens = JSON.parse(fs.readFileSync(specPath, "utf8"));
const FONT = [process.env.FONT_DIR, path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/fonts"), "/home/user/redinceai/src/fonts"].find(p => p && fs.existsSync(p));
const mr = fs.readFileSync(path.join(FONT, "Manrope.woff2")).toString("base64");
const sg = fs.readFileSync(path.join(FONT, "SpaceGrotesk-Bold.ttf")).toString("base64");
const regions = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "regions.json"), "utf8"));
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sk = (w, h = 18, c = "#e4ded1") => `<div class="sk" style="width:${w};height:${h}px;background:${c}"></div>`;

const CSS = `
@font-face{font-family:MR;src:url(data:font/woff2;base64,${mr}) format("woff2");font-weight:200 800}
@font-face{font-family:SG;src:url(data:font/ttf;base64,${sg});font-weight:700}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;background:#f6f4ee;color:#1a1a1c;font-family:MR,sans-serif;overflow:hidden;position:relative}
.status{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 44px;font-weight:700;font-size:26px}
.top{height:112px;display:flex;align-items:center;gap:20px;padding:0 40px;border-bottom:1.5px solid #e2ddd2}
.word{font-family:SG;font-size:40px;letter-spacing:-.02em;position:relative}
.back{width:44px;height:44px;border-radius:12px;background:#ebe6db}
h1{font-size:54px;font-weight:800;letter-spacing:-.03em;line-height:1.05;padding:36px 40px 10px}
.sub{font-size:28px;color:#5b5a57;padding:0 40px 18px;font-weight:600;line-height:1.35}
.chips{display:flex;gap:14px;padding:14px 40px;flex-wrap:wrap}
.chip{border:2px solid #d9d3c6;border-radius:12px;padding:12px 20px;font-size:26px;font-weight:700;white-space:nowrap}
.chip.on{background:#1a1a1c;color:#f6f4ee;border-color:#1a1a1c}
.card{margin:18px 40px;border:1.5px solid #e2ddd2;border-radius:24px;padding:28px;background:#fffdf8}
.row{display:flex;align-items:center;gap:22px}
.av{width:84px;height:84px;border-radius:50%;background:#e4ded1;flex:none}
.sk{border-radius:9px;margin:8px 0}
.btn{position:absolute;left:40px;right:40px;bottom:70px;height:104px;border-radius:22px;background:#1a1a1c;color:#f6f4ee;display:grid;place-items:center;font-size:34px;font-weight:800}
.btn.coral{background:#ff5a36;color:#fff}
.check{width:52px;height:52px;border-radius:50%;border:3px solid #cfc8ba;flex:none;display:grid;place-items:center}
.check.on{background:#1a1a1c;border-color:#1a1a1c}
.check.on::after{content:"";width:22px;height:12px;border-left:5px solid #f6f4ee;border-bottom:5px solid #f6f4ee;transform:rotate(-45deg) translate(2px,-2px)}
.li{display:flex;gap:24px;align-items:flex-start;padding:22px 0;border-bottom:1.5px solid #ece7dc;font-size:31px;font-weight:600;line-height:1.3}
.bub{max-width:78%;padding:22px 26px;border-radius:26px;font-size:29px;line-height:1.35;font-weight:600;margin:14px 0}
.bot{background:#ffffff;border:1.5px solid #e2ddd2;border-bottom-left-radius:8px}
.me{background:#1a1a1c;color:#f6f4ee;margin-left:auto;border-bottom-right-radius:8px}
.kb{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;max-width:82%}
.kb div{background:#ebe6db;border-radius:16px;padding:18px;text-align:center;font-size:27px;font-weight:800}
.kb div.hl{background:#ff5a36;color:#fff}
.tabs{display:flex;gap:36px;padding:20px 40px;font-size:31px;font-weight:800;color:#8b8780}
.tabs .on{color:#1a1a1c;border-bottom:5px solid #1a1a1c;padding-bottom:8px}
.badge{display:inline-flex;align-items:center;gap:10px;background:#ff5a36;color:#fff;border-radius:999px;padding:10px 20px;font-size:25px;font-weight:800}
.bar{height:22px;border-radius:11px;background:#e7e1d5;overflow:hidden;margin:10px 0 24px}
.bar>i{display:block;height:100%;background:#1a1a1c;border-radius:11px}
.field{margin:14px 40px}.field label{display:block;font-size:25px;font-weight:700;color:#6b6964;margin-bottom:10px}
.field div{border:2px solid #d9d3c6;border-radius:16px;padding:20px 22px;font-size:30px;font-weight:700;background:#fffdf8}
`;
const head = (title, back = true) => `<div class="status"><span>9:41</span><span>●●● ▮</span></div>
<div class="top">${back ? '<div class="back"></div>' : ''}<div class="word">kasb egalari</div></div>${title ? `<h1>${esc(title)}</h1>` : ""}`;

function mapSvg(slug) {
  const paths = regions.map(r => `<path d="${r.d}" fill="${r.slug === slug ? "#ff5a36" : "#e4ded1"}" stroke="#f6f4ee" stroke-width="3"/>`).join("");
  return `<svg viewBox="0 0 1000 662" style="width:100%;display:block">${paths}</svg>`;
}
const T = {
  chat: (s, k) => `${head(null)}<div style="padding:10px 40px"><div class="row" style="padding:18px 0 22px;border-bottom:1.5px solid #e2ddd2"><div class="av" style="background:#1a1a1c"></div><div><div style="font-size:32px;font-weight:800">${esc(s.title)}</div><div style="font-size:24px;color:#6b6964;font-weight:600">bot</div></div></div>
    ${(s.messages || []).slice(0, k + 1).map(m => m.video ? `<div class="bub me" style="padding:10px"><div style="width:420px;height:300px;border-radius:18px;background:linear-gradient(135deg,#2a2c31,#0e0f12);display:grid;place-items:center;color:#f6f4ee;font-size:60px">▶</div></div>`
      : `<div class="bub ${m.from === "me" ? "me" : "bot"}">${esc(m.text)}</div>${m.buttons ? `<div class="kb">${m.buttons.map((b, i) => `<div class="${m.hl === i && k > (s.hlAfter ?? 99) ? "hl" : ""}">${esc(b)}</div>`).join("")}</div>` : ""}`).join("")}</div>`,
  checklist: (s, k) => `${head(s.title)}${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ""}<div style="padding:0 40px">${(s.items || []).map((it, i) => `<div class="li"><div class="check ${i < k + (s.preChecked || 0) ? "on" : ""}"></div><div>${esc(it)}</div></div>`).join("")}</div>${s.button ? `<div class="btn ${k >= (s.items || []).length - (s.preChecked || 0) ? "coral" : ""}">${esc(s.button)}</div>` : ""}`,
  map: (s, k) => `${head(s.title)}<div class="chips">${(s.chips || []).map((c, i) => `<div class="chip ${i < k + 1 ? "on" : ""}">${esc(c)}</div>`).join("")}</div><div style="padding:20px 40px">${mapSvg(k >= 1 ? s.region : null)}</div>
    ${[0, 1, 2].map(() => `<div class="card"><div class="row"><div class="av"></div><div style="flex:1">${sk("62%", 22)}${sk("38%", 16)}</div></div></div>`).join("")}`,
  list: (s, k) => `${head(s.title)}<div class="chips">${(s.chips || []).map(c => `<div class="chip ${c === s.active && k >= 1 ? "on" : ""}">${esc(c)}</div>`).join("")}</div>
    ${[0, 1, 2, 3].map(() => `<div class="card">${sk("70%", 26)}${sk("45%", 18)}<div style="display:flex;gap:12px;margin-top:10px">${sk("120px", 34, "#ebe6db")}${sk("160px", 34, "#ebe6db")}</div></div>`).join("")}${s.button && k >= 2 ? `<div class="btn coral">${esc(s.button)}</div>` : ""}`,
  reels: (s, k) => `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#3a3d44 0%,#121316 55%,#0a0b0d 100%)"></div>
    <div class="status" style="color:#fff;position:relative">${"<span>9:41</span><span>●●● ▮</span>"}</div>
    <div class="tabs" style="position:relative;color:rgba(255,255,255,.6)">${(s.tabs || []).map((t, i) => `<span class="${i === (k % (s.tabs || [1]).length) ? "on" : ""}" style="${i === (k % (s.tabs || [1]).length) ? "color:#fff;border-color:#fff" : ""}">${esc(t)}</span>`).join("")}</div>
    <div style="position:absolute;left:0;right:0;top:44%;text-align:center;color:#fff;font-size:120px;opacity:.85">▶</div>
    <div style="position:absolute;right:34px;bottom:330px;display:grid;gap:44px">${[0, 1, 2, 3].map(() => `<div style="width:76px;height:76px;border-radius:50%;background:rgba(255,255,255,.18)"></div>`).join("")}</div>
    <div style="position:absolute;left:40px;right:160px;bottom:200px;color:#fff"><div class="row"><div class="av" style="width:70px;height:70px;background:rgba(255,255,255,.3)"></div>${sk("220px", 22, "rgba(255,255,255,.35)")}</div>${sk("80%", 18, "rgba(255,255,255,.25)")}</div>
    <div style="position:absolute;left:0;right:0;bottom:120px;height:6px;background:rgba(255,255,255,.2)"><i style="display:block;height:100%;width:${30 + k * 25}%;background:#fff"></i></div>`,
  topics: (s, k) => `${head(null)}<div style="padding:22px 40px 8px;font-size:40px;font-weight:800">${esc(s.title)}</div><div class="chips">${(s.topics || []).map((t, i) => `<div class="chip ${i === Math.min(k, (s.topics || []).length - 1) ? "on" : ""}">${esc(t)}</div>`).join("")}</div>
    <div style="padding:10px 40px">${[0, 1, 2, 3].map(i => `<div class="bub ${i % 2 ? "me" : "bot"}" style="min-width:300px">${sk(i % 2 ? "220px" : "300px", 18, i % 2 ? "#3a3b40" : "#e4ded1")}${sk("160px", 18, i % 2 ? "#3a3b40" : "#e4ded1")}</div>`).join("")}</div>`,
  form: (s, k) => `${head(s.title)}${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ""}${(s.fields || []).map((f, i) => `<div class="field"><label>${esc(f.label)}</label><div>${i <= k ? esc(f.value) : "&nbsp;"}</div></div>`).join("")}${s.button ? `<div class="btn ${k >= (s.fields || []).length - 1 ? "coral" : ""}">${esc(s.button)}</div>` : ""}`,
  resume: (s, k) => `${head(s.title)}<div class="card"><div class="row"><div class="av" style="width:120px;height:120px"></div><div style="flex:1"><div style="font-size:36px;font-weight:800">${esc(s.role)}</div>${sk("55%", 18)}</div></div>
    <div style="margin-top:26px">${sk("92%")}${sk("84%")}${sk("60%")}</div>${s.note ? `<div style="margin-top:26px;display:flex;gap:14px;align-items:center;font-size:27px;font-weight:700;color:#5b5a57"><span style="width:40px;height:40px;border-radius:10px;background:#1a1a1c;display:inline-block"></span>${esc(s.note)}</div>` : ""}</div>${s.button && k >= 1 ? `<div class="btn coral">${esc(s.button)}</div>` : s.button ? `<div class="btn">${esc(s.button)}</div>` : ""}`,
  stats: (s, k) => `${head(s.title)}<div style="padding:10px 40px">${(s.rows || []).map((r, i) => `<div style="font-size:30px;font-weight:700">${esc(r)}</div><div class="bar"><i style="width:${Math.min(100, (k + 1) * (18 + (i * 37) % 30))}%"></i></div>`).join("")}</div>`,
  card: (s, k) => `${head(s.title)}<div class="sub" style="font-size:30px;color:#2f2e2b">${esc(s.text)}</div><div class="chips">${(s.chips || []).map(c => `<div class="chip">${esc(c)}</div>`).join("")}</div>${[0, 1].map(() => `<div class="card"><div class="row"><div class="av"></div><div style="flex:1">${sk("60%", 22)}${sk("35%", 16)}</div></div></div>`).join("")}${s.button ? `<div class="btn ${k >= 1 ? "coral" : ""}">${esc(s.button)}</div>` : ""}`,
  qa: (s, k) => `${head(s.title)}<div class="card"><div style="font-size:24px;font-weight:800;color:#8b8780;margin-bottom:10px">${esc(s.asker || "")}</div><div style="font-size:34px;font-weight:800;line-height:1.25">${esc(s.question)}</div></div>
    ${[0, 1].map(i => `<div class="card" style="margin-left:${i ? 40 : 40}px">${i === 0 && k >= 2 ? `<span class="badge">★ ${esc(s.badge || "Eng foydali")}</span>` : ""}<div class="row" style="margin-top:14px"><div class="av" style="width:64px;height:64px"></div><div style="flex:1">${sk("80%")}${sk("55%")}</div></div></div>`).join("")}${s.button ? `<div class="btn ${k >= 1 ? "coral" : ""}">${esc(s.button)}</div>` : ""}`,
};

fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: +W, height: +H } });
for (const s of screens) {
  const n = s.states || 1;
  for (let k = 0; k < n; k++) {
    const body = (T[s.type] || T.card)(s, k);
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, `${s.name}_${k}.png`) });
  }
  console.log(s.name, n, "holat");
}
await b.close();
