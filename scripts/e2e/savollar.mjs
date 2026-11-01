import { BASE, cookies, db, finish, makeReq, ok } from "./_lib.mjs";
// Savol-javob E2E: mijoz savol beradi -> mutaxassis javob -> admin «Foydali» ->
// mijoz «Eng foydali» -> bildirishnomalar -> cheklovlar -> tozalash
const C = await cookies();
const req = makeReq(C);

let qid = null;
try {
  // Mehmon: savol 401
  ok((await fetch(BASE + "/api/savollar", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ title: "Mehmon savoli bu yerda" }) })).status === 401, "mehmon savol 401");

  // 1. Mijoz savol beradi
  const askRes = await req("cl", "/api/savollar", { method: "POST", body: JSON.stringify({ title: "E2E: narxni qanday asoslab beraman?", body: "Mijoz narx tushirishni so'rayapti.", category: "video" }) });
  ok(askRes.status === 201, "savol joylandi", String(askRes.status));
  qid = (await askRes.json()).data?.id;
  ok((await fetch(BASE + `/savollar/${qid}`)).status === 200, "savol sahifasi 200");
  ok((await fetch(BASE + "/savollar/yoq-savol-12345")).status === 404, "yo'q savol 404");

  // Qisqa savol 422
  const short = await req("cl", "/api/savollar", { method: "POST", body: JSON.stringify({ title: "qisqa" }) });
  ok(short.status === 422, "qisqa savol 422", String(short.status));

  // 2. O'z savoliga javob — 422; mutaxassis javobi — 201; takror — 409
  const self = await req("cl", `/api/savollar/${qid}/javob`, { method: "POST", body: JSON.stringify({ body: "O'zimga javob yozyapman o'zi" }) });
  ok(self.status === 422, "o'z savoliga javob 422", String(self.status));
  const ans = await req("sp", `/api/savollar/${qid}/javob`, { method: "POST", body: JSON.stringify({ body: "Portfolio va natijalar bilan asoslang: oldingi ishlar, ko'rishlar, mijoz sharhlari." }) });
  ok(ans.status === 201, "javob joylandi", String(ans.status));
  const aid = (await ans.json()).data?.id;
  const dup = await req("sp", `/api/savollar/${qid}/javob`, { method: "POST", body: JSON.stringify({ body: "Ikkinchi javob yozib ko'raman" }) });
  ok(dup.status === 409, "ikkinchi javob 409", String(dup.status));

  // Savol egasiga bildirishnoma
  const ownerId = (await db.execute({ sql: "SELECT user_id FROM questions WHERE id = ?", args: [qid] })).rows[0].user_id;
  const n1 = await db.execute({ sql: "SELECT id FROM notifications WHERE user_id = ? AND href = ?", args: [ownerId, `/savollar/${qid}`] });
  ok(n1.rows.length >= 1, "egasiga javob bildirishnomasi");

  // 3. «Foydali»: o'z javobiga 422, admin toggle
  const selfVote = await req("sp", `/api/javoblar/${aid}/ovoz`, { method: "POST" });
  ok(selfVote.status === 422, "o'z javobiga foydali 422", String(selfVote.status));
  const v1 = await (await req("ad", `/api/javoblar/${aid}/ovoz`, { method: "POST" })).json();
  ok(v1.data?.voted === true && v1.data?.upvotesCount === 1, "foydali +1");
  const v2 = await (await req("ad", `/api/javoblar/${aid}/ovoz`, { method: "POST" })).json();
  ok(v2.data?.voted === false && v2.data?.upvotesCount === 0, "qayta bosish — bekor");
  await req("ad", `/api/javoblar/${aid}/ovoz`, { method: "POST" });

  // 4. «Eng foydali»: begona 403, egasi — ok, javob egasiga bildirishnoma
  const stranger = await req("sp", `/api/savollar/${qid}/qabul`, { method: "POST", body: JSON.stringify({ answerId: aid }) });
  ok(stranger.status === 403, "begona qabul 403", String(stranger.status));
  const acc = await (await req("cl", `/api/savollar/${qid}/qabul`, { method: "POST", body: JSON.stringify({ answerId: aid }) })).json();
  ok(acc.data?.acceptedAnswerId === aid, "eng foydali belgilandi");
  const spId = (await db.execute({ sql: "SELECT user_id FROM question_answers WHERE id = ?", args: [aid] })).rows[0].user_id;
  const n2 = await db.execute({ sql: "SELECT id FROM notifications WHERE user_id = ? AND href = ?", args: [spId, `/savollar/${qid}`] });
  ok(n2.rows.length >= 1, "javob egasiga qabul bildirishnomasi");

  // Ro'yxat filtri: answered'da ko'rinadi
  const lst = await (await fetch(BASE + "/api/savollar?tab=answered")).json();
  ok((lst.data?.items ?? []).some((x) => x.id === qid && x.answered), "answered filtrida bor");

  // 5. O'chirish: begona 403, javob o'chsa qabul belgisi tozalanadi, egasi savolni o'chiradi
  ok((await req("sp", `/api/savollar/${qid}`, { method: "DELETE" })).status === 403, "begona savol o'chirish 403");
  ok((await req("sp", `/api/javoblar/${aid}`, { method: "DELETE" })).status === 200, "javob egasi o'chirdi");
  const qrow = (await db.execute({ sql: "SELECT accepted_answer_id, answers_count FROM questions WHERE id = ?", args: [qid] })).rows[0];
  ok(qrow.accepted_answer_id === null && Number(qrow.answers_count) === 0, "qabul belgisi va hisob tozalandi");
  ok((await req("cl", `/api/savollar/${qid}`, { method: "DELETE" })).status === 200, "egasi savolni o'chirdi");
  qid = null;
} finally {
  if (qid) {
    await db.execute({ sql: "DELETE FROM questions WHERE id = ?", args: [qid] });
  }
  await db.execute({ sql: "DELETE FROM notifications WHERE href LIKE '/savollar/%'", args: [] });
  console.log("🧹 tozalandi");
}
finish();
