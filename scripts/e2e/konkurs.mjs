import { BASE, cookies, db, finish, makeReq, ok } from "./_lib.mjs";
// Konkurs E2E: admin yaratadi -> mutaxassis post qo'shadi -> mijoz ovoz beradi ->
// muddat o'tadi -> cron g'olibni tanlaydi + bildirishnoma. Oxirida tozalanadi.

const C = await cookies();
const req = makeReq(C);
const CRON = process.env.CRON_SECRET;

let chId = null;
let seededPostId = null;
try {
  // 1. Admin konkurs ochadi
  const create = await req("ad", "/api/admin/konkurs", { method: "POST", body: JSON.stringify({ title: "E2E sinov konkursi", description: "Sinov", days: 7 }) });
  ok(create.status === 201, "admin konkurs yaratdi", String(create.status));
  chId = (await create.json()).data?.id;

  // Ro'yxat va sahifalar
  const list = await fetch(BASE + "/api/konkurs");
  const items = (await list.json()).data?.items ?? [];
  ok(items.some((c) => c.id === chId && c.state === "open"), "ro'yxatda ochiq holatda");
  ok((await fetch(BASE + "/konkurs")).status === 200, "/konkurs sahifasi 200");
  ok((await fetch(BASE + `/konkurs/${chId}`)).status === 200, "/konkurs/<id> sahifasi 200");
  ok((await fetch(BASE + "/konkurs/yoq-id-123456")).status === 404, "yo'q konkurs 404");

  // 2. Mutaxassis — yaroqli postlar va ishtirok.
  // CI bazasida demo mutaxassisning media'li ommaviy profil posti bo'lmasligi mumkin —
  // test o'zi bitta post qo'shib oladi (oxirida tozalanadi), aks holda test muhitga bog'liq bo'lib qoladi.
  let el = await req("sp", `/api/konkurs/${chId}/qatnashish`);
  let posts = (await el.json()).data?.items ?? [];
  if (el.status === 200 && posts.length === 0) {
    const spRow = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: ["mutaxassis@redince.uz"] });
    seededPostId = `e2e-konkurs-${Date.now()}`;
    await db.execute({
      sql: "INSERT INTO posts (id, group_id, author_id, body, media, audience, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, 'public', ?, ?)",
      args: [seededPostId, spRow.rows[0].id, "E2E konkurs sinov posti", JSON.stringify([{ url: "/uploads/e2e-konkurs.jpg", name: "e2e.jpg", type: "image/jpeg", size: 1000 }]), Date.now(), Date.now()],
    });
    el = await req("sp", `/api/konkurs/${chId}/qatnashish`);
    posts = (await el.json()).data?.items ?? [];
  }
  ok(el.status === 200 && posts.length > 0, "yaroqli postlar bor", String(posts.length));
  const join = await req("sp", `/api/konkurs/${chId}/qatnashish`, { method: "POST", body: JSON.stringify({ postId: posts[0].id }) });
  ok(join.status === 201, "ishtirok qabul qilindi", String(join.status));
  const entryId = (await join.json()).data?.entryId;
  const dup = await req("sp", `/api/konkurs/${chId}/qatnashish`, { method: "POST", body: JSON.stringify({ postId: posts[0].id }) });
  ok(dup.status === 409, "ikkinchi ishtirok 409", String(dup.status));

  // 3. O'z ishiga ovoz — 422; mijoz ovozi — ok; qayta bosish — bekor
  const self = await req("sp", `/api/konkurs/${chId}/ovoz`, { method: "POST", body: JSON.stringify({ entryId }) });
  ok(self.status === 422, "o'z ishiga ovoz 422", String(self.status));
  const vote = await req("cl", `/api/konkurs/${chId}/ovoz`, { method: "POST", body: JSON.stringify({ entryId }) });
  ok(vote.status === 200 && (await vote.json()).data?.votedEntryId === entryId, "mijoz ovoz berdi");
  const detail = await req("cl", `/api/konkurs/${chId}`);
  const d = (await detail.json()).data;
  ok(d?.entries?.[0]?.votesCount === 1, "ovoz hisoblandi", JSON.stringify(d?.entries?.[0]?.votesCount));
  const unvote = await req("cl", `/api/konkurs/${chId}/ovoz`, { method: "POST", body: JSON.stringify({ entryId }) });
  ok((await unvote.json()).data?.votedEntryId === null, "qayta bosish — ovoz bekor");
  await req("cl", `/api/konkurs/${chId}/ovoz`, { method: "POST", body: JSON.stringify({ entryId }) }); // yana ovoz

  // 4. Muddatni o'tkazib yuborib cron'ni chaqiramiz
  await db.execute({ sql: "UPDATE challenges SET ends_at = ? WHERE id = ?", args: [Date.now() - 3600_000, chId] });
  const cron = await fetch(BASE + "/api/cron/daily", { headers: { authorization: `Bearer ${CRON}` } });
  const cj = await cron.json();
  ok(cron.status === 200 && (cj.data?.challengesClosed ?? cj.challengesClosed) >= 1, "cron g'olibni yopdi", JSON.stringify(cj.data?.challengesClosed ?? cj.challengesClosed));
  const after = await (await fetch(BASE + `/api/konkurs/${chId}`)).json();
  ok(after.data?.winner?.name, "g'olib e'lon qilindi", after.data?.winner?.name);
  ok(after.data?.entries?.[0]?.isWinner === true, "g'olib ishi belgilangan");

  // Bildirishnoma yetib bordi (mutaxassisga top_award)
  const spUser = await db.execute({ sql: "SELECT user_id FROM challenge_entries WHERE id = ?", args: [entryId] });
  const nid = await db.execute({ sql: "SELECT id FROM notifications WHERE user_id = ? AND href = ? LIMIT 1", args: [spUser.rows[0].user_id, `/konkurs/${chId}`] });
  ok(nid.rows.length === 1, "g'olibga bildirishnoma yozildi");

  // Ovoz berish yopiq konkursda rad etiladi
  const lateVote = await req("cl", `/api/konkurs/${chId}/ovoz`, { method: "POST", body: JSON.stringify({ entryId }) });
  ok(lateVote.status === 409, "yakunlangan konkursda ovoz 409", String(lateVote.status));
} finally {
  if (chId) {
    await db.execute({ sql: "DELETE FROM notifications WHERE href = ?", args: [`/konkurs/${chId}`] });
    await db.execute({ sql: "DELETE FROM challenge_votes WHERE challenge_id = ?", args: [chId] });
    await db.execute({ sql: "DELETE FROM challenge_entries WHERE challenge_id = ?", args: [chId] });
    await db.execute({ sql: "DELETE FROM challenges WHERE id = ?", args: [chId] });
    console.log("🧹 tozalandi");
  }
  if (seededPostId) await db.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [seededPostId] });
}
finish();
