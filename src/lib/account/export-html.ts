import "server-only";

/**
 * Ma'lumot eksportining O'QILADIGAN HTML varianti (kamchilik #94): JSON bilan bir xil ma'lumot,
 * lekin odam o'qiy oladigan hujjat — brauzerda ochiladi, chop etilsa PDF bo'ladi.
 * Hammasi matn sifatida ekranlanadi (xom HTML yo'q), tashqi resurs yuklanmaydi (CSP'ga mos, oflayn ochiladi).
 */

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Sana-vaqt tili (sahifa tili bo'yicha): `renderExportHtml` boshida o'rnatiladi (render sinxron — bir vaqtda bitta) */
let DATE_LOCALE: "uz-UZ" | "ru-RU" = "uz-UZ";
const dt = (v: unknown): string => {
  const d = v instanceof Date ? v : typeof v === "number" || typeof v === "string" ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(DATE_LOCALE, { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const som = (n: unknown): string => (typeof n === "number" ? `${new Intl.NumberFormat("uz-UZ").format(n)} so'm` : "—");

type Row = Record<string, unknown>;

/** Jadval: ustun sarlavhalari + qatorlar (hamma qiymat ekranlangan) */
function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return `<p class="empty">Yo'q</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function kv(pairs: Array<[string, unknown]>): string {
  return `<dl>${pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("")}</dl>`;
}

function section(title: string, body: string, count?: number): string {
  return `<section><h2>${esc(title)}${count !== undefined ? ` <span class="n">${count}</span>` : ""}</h2>${body}</section>`;
}

/** Route'dagi `data` obyekti shu funksiyaga beriladi — maydonlar himoya bilan o'qiladi */
export function renderExportHtml(data: Row, locale: "uz" | "ru" = "uz"): string {
  DATE_LOCALE = locale === "ru" ? "ru-RU" : "uz-UZ";
  const user = (data.user ?? {}) as Row;
  const sp = (data.specialist ?? null) as Row | null;
  const ordersData = (data.orders ?? {}) as { asClient?: Row[]; asSpecialist?: Row[] };
  const asClient = ordersData.asClient ?? [];
  const asSpecialist = ordersData.asSpecialist ?? [];
  const pays = (data.payments ?? []) as Row[];
  const outs = (data.payouts ?? []) as Row[];
  const reviewsData = (data.reviews ?? {}) as { written?: Row[]; received?: Row[] };
  const social = (data.social ?? {}) as { posts?: Row[]; comments?: Row[]; following?: Row[]; followers?: Row[]; groups?: Row[] };
  const favs = (data.favorites ?? []) as Row[];
  const activity = (data.activity ?? []) as Row[];
  const devices = (data.sessions ?? []) as Row[];

  const body = [
    section(
      "Hisob",
      kv([
        ["Ism", user.name],
        ["Email", user.email],
        ["Taxallus", user.username ? `@${user.username}` : ""],
        ["Telefon", user.phone],
        ["Rol", user.role],
        ["Ro'yxatdan o'tgan", dt(user.createdAt)],
      ]),
    ),
    sp
      ? section(
          "Mutaxassis profili",
          kv([
            ["Sarlavha", sp.title],
            ["Yo'nalish", sp.category],
            ["Hudud", sp.region],
            ["Tajriba", sp.experience],
            ["Narx (dan)", som(sp.priceFrom)],
            ["Reyting", sp.rating],
            ["Ko'rishlar", sp.viewCount],
            ["Tavsif", sp.bio],
          ]),
        )
      : "",
    section(
      "Buyurtmalarim (mijoz sifatida)",
      table(
        ["Sana", "Mavzu", "Mutaxassis", "Holat", "Narx"],
        asClient.map((o) => {
          const s = (o.specialist ?? {}) as Row;
          return [dt(o.createdAt), esc(o.title), esc(s.name ?? s.title ?? ""), esc(o.status), som(o.price)];
        }),
      ),
      asClient.length,
    ),
    asSpecialist.length
      ? section(
          "Kelgan buyurtmalar (mutaxassis sifatida)",
          table(
            ["Sana", "Mavzu", "Mijoz", "Holat", "Narx"],
            asSpecialist.map((o) => [dt(o.createdAt), esc(o.title), esc(((o.client ?? {}) as Row).name ?? ""), esc(o.status), som(o.price)]),
          ),
          asSpecialist.length,
        )
      : "",
    section(
      "To'lovlar",
      table(
        ["Sana", "Summa", "Komissiya", "Sof", "Provayder", "Holat"],
        pays.map((p) => [dt(p.createdAt), som(p.amount), som(p.commissionAmount), som(p.netAmount), esc(p.provider), esc(p.state)]),
      ),
      pays.length,
    ),
    outs.length
      ? section(
          "Pul chiqarishlar",
          table(["Sana", "Summa", "Usul", "Holat"], outs.map((p) => [dt(p.createdAt), som(p.amount), esc(p.method), esc(p.state)])),
          outs.length,
        )
      : "",
    section(
      "Yozgan sharhlarim",
      table(
        ["Sana", "Mutaxassis", "Baho", "Matn"],
        (reviewsData.written ?? []).map((r) => [dt(r.createdAt), esc(((r.specialist ?? {}) as Row).title ?? ""), esc(r.rating), esc(r.text)]),
      ),
      (reviewsData.written ?? []).length,
    ),
    (reviewsData.received ?? []).length
      ? section(
          "Olingan sharhlar",
          table(["Sana", "Muallif", "Baho", "Matn"], (reviewsData.received ?? []).map((r) => [dt(r.createdAt), esc(r.author), esc(r.rating), esc(r.text)])),
          (reviewsData.received ?? []).length,
        )
      : "",
    section(
      "Postlarim",
      table(
        ["Sana", "Matn", "Yoqtirish", "Izoh", "Ko'rish"],
        (social.posts ?? []).map((p) => [dt(p.createdAt), esc(String(p.body ?? "").slice(0, 200)), esc(p.likesCount), esc(p.commentsCount), esc(p.viewsCount)]),
      ),
      (social.posts ?? []).length,
    ),
    section(
      "Obunalarim",
      table(["Ism", "Taxallus", "Sana"], (social.following ?? []).map((f) => [esc(f.name), esc(f.username ? `@${f.username}` : ""), dt(f.createdAt)])),
      (social.following ?? []).length,
    ),
    section(
      "Obunachilarim",
      table(["Ism", "Taxallus", "Sana"], (social.followers ?? []).map((f) => [esc(f.name), esc(f.username ? `@${f.username}` : ""), dt(f.createdAt)])),
      (social.followers ?? []).length,
    ),
    section(
      "Jamoalarim",
      table(["Nomi", "Turi", "Rolim", "Qo'shilgan"], (social.groups ?? []).map((g) => [esc(g.name), esc(g.kind), esc(g.role), dt(g.joinedAt)])),
      (social.groups ?? []).length,
    ),
    favs.length ? section("Sevimlilar", table(["Mutaxassis", "Sana"], favs.map((f) => [esc(f.title), dt(f.createdAt)])), favs.length) : "",
    section(
      "Qurilmalar (sessiyalar)",
      table(["Qurilma", "Kirish", "Oxirgi faollik"], devices.slice(0, 30).map((s) => [esc(String(s.userAgent ?? "").slice(0, 80)), dt(s.createdAt), dt(s.lastSeenAt)])),
      devices.length,
    ),
    section(
      "Hisob faolligi (oxirgi harakatlar)",
      table(["Sana", "Harakat", "IP"], activity.slice(0, 100).map((a) => [dt(a.createdAt), esc(a.action), esc(a.ip)])),
      activity.length,
    ),
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kasb Egalari — ma'lumotlar eksporti</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.6 -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1c; background: #fff; margin: 0; padding: 32px 20px; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b6b70; font-size: 13px; margin: 0 0 24px; }
  section { margin: 0 0 28px; break-inside: avoid; }
  h2 { font-size: 15px; margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid #e6e4de; }
  h2 .n { color: #6b6b70; font-weight: 400; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; color: #6b6b70; font-weight: 600; padding: 4px 8px 4px 0; border-bottom: 1px solid #eee; }
  td { padding: 4px 8px 4px 0; border-bottom: 1px solid #f2f1ec; vertical-align: top; word-break: break-word; }
  dl { margin: 0; } dl > div { display: flex; gap: 12px; padding: 3px 0; }
  dt { width: 160px; flex: none; color: #6b6b70; } dd { margin: 0; word-break: break-word; }
  .empty { color: #9a9aa0; font-size: 13px; margin: 4px 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="wrap">
<h1>Kasb Egalari — ma'lumotlarim</h1>
<p class="sub">Eksport sanasi: ${esc(dt(data.exportedAt))} · Bu hujjatda hisobingizning shaxsiy ma'lumotlari bor — ehtiyot saqlang. To'liq texnik nusxa JSON formatida mavjud.</p>
${body}
</div>
</body>
</html>`;
}
