/**
 * CHAT regressiya testlari (QA2 hisobotidagi kamchiliklar: A1–A22, B*, C*) — HTTP darajasida tekshiriladiganlari.
 * Ishga tushirish: dev/prod server ishlab turganda `node --test scripts/e2e/chat.mjs`
 * (BASE_URL, DATABASE_URL, DEMO_PASSWORD, ADMIN_PASSWORD — scripts/e2e/_lib.mjs bilan bir xil).
 * Test o'zi yaratgan suhbat/guruh/xabarlarni oxirida o'chiradi; limit hisoblagichlarini faqat test hisoblari uchun tozalaydi.
 */
import { BASE, cookies, db, finish, makeReq, ok } from "./_lib.mjs";

const C = await cookies();
const req = makeReq(C);
const TAG = `E2E-chat-${Date.now().toString(36)}`;
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (who, path, body, method = "POST") => req(who, path, { method, body: JSON.stringify(body ?? {}) });

/* ------------------------------------------------------------------ */
/* Tayyorgarlik: test hisoblari, limitlar, uchinchi foydalanuvchi       */
/* ------------------------------------------------------------------ */
const userByEmail = async (email) => (await db.execute({ sql: "select id, username, name from users where email = ?", args: [email] })).rows[0];
const SP = await userByEmail("mutaxassis@redince.uz");
const CL = await userByEmail("mijoz@redince.uz");
// Uchinchi hisob (begona foydalanuvchi tekshiruvlari): seed'dagi boshqa mutaxassis — kira olmasa shu testlar o'tkazib yuboriladi
const third = await (async () => {
  const row = (await db.execute("select id, email, username, name from users where role = 'specialist' and is_banned = 0 and email not in ('mutaxassis@redince.uz') and username is not null order by email limit 1")).rows[0];
  if (!row) return null;
  try {
    const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body: JSON.stringify({ email: row.email, password: process.env.DEMO_PASSWORD || "demo12345" }), redirect: "manual" });
    if (!r.ok) return null;
    const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return { ...row, cookie };
  } catch {
    return null;
  }
})();
if (third) C.x = third.cookie;
const ids = [SP.id, CL.id, third?.id].filter(Boolean);
for (const id of ids) await db.execute({ sql: "delete from rate_limits where key in (?, ?, ?, ?, ?, ?)", args: [`messages:${id}`, `social:${id}`, `dmEdit:${id}`, `typing:${id}`, `groups:${id}`, `blocks:${id}`] });
// Toza holat: avvalgi yiqilgan ishga tushirishdan qolgan blok yozuvlari testni buzmasin
await db.execute({ sql: "delete from user_blocks where (blocker_id = ? and blocked_id = ?) or (blocker_id = ? and blocked_id = ?)", args: [SP.id, CL.id, CL.id, SP.id] });

const created = { groups: [], folders: [] };
let convId = null;

try {
  /* ---------------------------------------------------------------- */
  /* Kirish huquqi                                                     */
  /* ---------------------------------------------------------------- */
  ok((await fetch(`${BASE}/api/chat/unread`)).status === 401, "mehmon /api/chat/unread 401");
  ok((await fetch(`${BASE}/api/chat/stream`)).status === 401, "mehmon /api/chat/stream 401");

  /* ---------------------------------------------------------------- */
  /* Suhbat: bo'sh suhbat ro'yxatda yo'q; birinchi xabardan keyin bor   */
  /* ---------------------------------------------------------------- */
  const start = await J(await post("sp", "/api/chat", { to: CL.username }));
  convId = start.data?.conversationId;
  ok(start.status === 201 && Boolean(convId), "suhbat ochildi (taxallus bo'yicha)", String(start.status));
  // Avvalgi ishga tushirishlardan qolgan xabarlar bo'lsa tozalaymiz — test toza suhbatdan boshlanadi
  await db.execute({ sql: "delete from dm_messages where conversation_id = ?", args: [convId] });
  await db.execute({ sql: "update conversations set last_message_at = null, a_read_at = null, b_read_at = null, pinned_message_id = null, ttl_seconds = 0, a_typing_at = null, b_typing_at = null where id = ?", args: [convId] });
  await db.execute({ sql: "delete from dm_conversation_prefs where conversation_id = ?", args: [convId] });

  let list = await J(await req("sp", "/api/chat"));
  ok(!list.data.items.some((c) => c.id === convId), "xabarsiz suhbat ochgan tomon ro'yxatida ham YO'Q (bo'sh qator qolmaydi)");
  ok(!(await J(await req("cl", "/api/chat"))).data.items.some((c) => c.id === convId), "xabarsiz suhbat qarshi tomonda ham yo'q");
  ok((await J(await req("sp", `/api/chat/${convId}`))).status === 200, "bo'sh suhbat manzil orqali ochiladi");

  const send = async (who, body, extra = {}) => J(await post(who, `/api/chat/${convId}`, { body, ...extra }));
  const m1 = await send("sp", `${TAG} salom`);
  ok(m1.status === 201 && m1.data.mine === true, "xabar yuborildi");
  list = await J(await req("cl", "/api/chat"));
  const row = list.data.items.find((c) => c.id === convId);
  ok(Boolean(row) && row.unread === 1 && row.last?.body === `${TAG} salom`, "qabul qiluvchi ro'yxatida suhbat + 1 o'qilmagan");

  /* A16: ro'yxat API maxfiylik maydonlarini sizdirmaydi, vaqtlar ms */
  ok(row && !("showOnline" in row.peer) && !("dmPolicy" in row.peer) && !("lastLoginAt" in row.peer) && !("role" in row.peer), "A16: ro'yxatda showOnline/dmPolicy/lastLoginAt/role chiqmaydi");
  ok(row && (row.peer.lastSeenAt === null || typeof row.peer.lastSeenAt === "number"), "A16: lastSeenAt — ms (son) yoki null", typeof row?.peer.lastSeenAt);
  await db.execute({ sql: "update users set show_online = 0 where id = ?", args: [SP.id] });
  const hidden = (await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId);
  ok(hidden.peer.lastSeenAt === null && hidden.peer.lastActiveAt === null, "A16: showOnline=false — ro'yxatda faollik vaqti yashirin");
  const hiddenThread = await J(await req("cl", `/api/chat/${convId}?read=0`));
  ok(hiddenThread.data.peer.lastSeenAt === null && hiddenThread.data.peer.lastActiveAt === null, "A16: suhbat sarlavhasida ham yashirin");
  await db.execute({ sql: "update users set show_online = 1 where id = ?", args: [SP.id] });

  /* A22: faqat ko'rinmas belgilardan iborat xabar — bo'sh */
  const zw = String.fromCharCode(0x200b, 0x200d, 0xfeff, 0x2060);
  ok((await send("sp", zw)).status === 422, "A22: zero-width belgilardan iborat xabar rad etiladi (422)");
  ok((await send("sp", "   ")).status === 422, "bo'sh (bo'shliq) xabar 422");

  /* ---------------------------------------------------------------- */
  /* A1: o'qildi belgisi shartli; kuzatuvchi o'z o'qishimni qaytarmaydi */
  /* ---------------------------------------------------------------- */
  const readAtOf = async () => (await db.execute({ sql: "select a_id, a_read_at, b_read_at, last_message_at from conversations where id = ?", args: [convId] })).rows[0];
  await req("cl", `/api/chat/${convId}`); // mijoz o'qidi
  const r1 = await readAtOf();
  await sleep(30);
  await req("cl", `/api/chat/${convId}?after=${m1.data.id}&sync=1`); // yana polling
  await req("cl", `/api/chat/${convId}`);
  const r2 = await readAtOf();
  const clRead = (r) => (r.a_id === CL.id ? r.a_read_at : r.b_read_at);
  ok(clRead(r1) != null && clRead(r1) === clRead(r2), "A1: yangi xabar bo'lmasa qayta o'qish read_at ni O'ZGARTIRMAYDI", `${clRead(r1)} → ${clRead(r2)}`);
  ok((await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId).unread === 0, "o'qilgach unread 0");

  // SSE: 4 soniya bo'sh turganda faol suhbat uchun hodisa kelmasligi kerak (ilgari soniyasiga 1 ta kelardi)
  const sse = async (who, qs, ms, during) => {
    const ac = new AbortController();
    const res = await fetch(`${BASE}/api/chat/stream${qs}`, { headers: { cookie: C[who] }, signal: ac.signal });
    const events = [];
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const pump = (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = /^event: (.+)$/m.exec(block)?.[1];
            if (ev) events.push({ ev, at: Date.now() });
          }
        }
      } catch {
        /* abort */
      }
    })();
    if (during) await during(events);
    await sleep(ms);
    ac.abort();
    await pump;
    return events;
  };
  // Avval «isitish»: ulanishdagi birinchi tekshiruv oxirgi 12 soniyadagi o'zgarishlarni bir marta qaytaradi
  await sleep(1200);
  const idle = await sse("cl", `?conv=${convId}`, 4500, async () => {
    // Mijoz suhbatni o'qib turibdi (GET), yangi xabar yo'q
    await sleep(1500);
    await req("cl", `/api/chat/${convId}?after=${m1.data.id}&sync=1`);
    await sleep(1200);
    await req("cl", `/api/chat/${convId}?after=${m1.data.id}&sync=1`);
  });
  const idleDm = idle.filter((e) => e.ev === "dm").length;
  ok(idleDm <= 1, "A1: bo'sh suhbatda SSE `dm` hodisalari takrorlanmaydi (o'z o'qishim aks-sado bermaydi)", `dm=${idleDm}, jami=${idle.length}`);

  // SSE: reaksiya va qadoq faol suhbatga `dm` hodisasi bilan keladi (ilgari faqat 1 soniyalik sikl tufayli ko'rinardi)
  const live = await sse("cl", `?conv=${convId}`, 2600, async (events) => {
    await sleep(2300);
    events.length = 0;
    await post("sp", `/api/chat/${convId}/messages/${m1.data.id}/reaction`, { emoji: "👍" }, "PUT");
  });
  ok(live.some((e) => e.ev === "dm"), "A1/B7: qarshi tomon reaksiyasi SSE `dm` bilan keladi", JSON.stringify(live.map((e) => e.ev)));
  const livePin = await sse("cl", `?conv=${convId}`, 2600, async (events) => {
    await sleep(2300);
    events.length = 0;
    await post("sp", `/api/chat/${convId}/pin`, { messageId: m1.data.id }, "PUT");
  });
  ok(livePin.some((e) => e.ev === "dm"), "A1: qadoq SSE `dm` bilan keladi", JSON.stringify(livePin.map((e) => e.ev)));
  await post("sp", `/api/chat/${convId}/pin`, { messageId: null }, "PUT");

  /* ---------------------------------------------------------------- */
  /* B11: read=0 — o'qildi belgilanmaydi                               */
  /* ---------------------------------------------------------------- */
  const m2 = await send("sp", `${TAG} ikkinchi`);
  await req("cl", `/api/chat/${convId}?after=${m1.data.id}&sync=1&read=0`);
  ok((await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId).unread === 1, "B11: read=0 bilan o'qilmagan saqlanadi");
  const spView = await J(await req("sp", `/api/chat/${convId}?read=0`));
  ok(spView.data.peerReadAt < m2.data.at, "B11: yuboruvchida ✓✓ chiqmaydi (peerReadAt eski)");
  await req("cl", `/api/chat/${convId}?after=${m1.data.id}&sync=1`);
  ok((await J(await req("sp", `/api/chat/${convId}?read=0`))).data.peerReadAt >= m2.data.at, "o'qilgach peerReadAt yangilanadi");

  /* ---------------------------------------------------------------- */
  /* A19: «men uchun o'chirish» — ro'yxatda oldingi ko'rinadigan xabar  */
  /* ---------------------------------------------------------------- */
  const del = await req("sp", `/api/chat/${convId}/messages/${m2.data.id}?scope=me`, { method: "DELETE" });
  ok(del.status === 200, "men uchun o'chirildi");
  const afterDel = (await J(await req("sp", "/api/chat"))).data.items.find((c) => c.id === convId);
  ok(afterDel?.last?.body === `${TAG} salom` && afterDel.sortAt === m1.data.at, "A19: ro'yxat qatori oldingi ko'rinadigan xabarni ko'rsatadi", afterDel?.last?.body);
  ok((await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId)?.last?.body === `${TAG} ikkinchi`, "qarshi tomonda xabar o'z joyida");

  /* C6: biriktirmasiz xabarni bo'sh qilib tahrirlab bo'lmaydi; A22 zero-width tahrir */
  ok((await J(await post("sp", `/api/chat/${convId}/messages/${m1.data.id}`, { body: zw }, "PATCH"))).status === 422, "tahrirda ham ko'rinmas matn 422");
  const ed = await J(await post("sp", `/api/chat/${convId}/messages/${m1.data.id}`, { body: `${TAG} salom (tahrir)` }, "PATCH"));
  ok(ed.status === 200 && ed.data.editedAt > 0, "tahrir ishlaydi");

  /* ---------------------------------------------------------------- */
  /* A10: yo'qoladigan xabar muddati o'tgach hech qayerdan chiqmaydi    */
  /* ---------------------------------------------------------------- */
  ok((await J(await post("sp", `/api/chat/${convId}/ttl`, { seconds: 3600 }, "PATCH"))).status === 200, "yo'qolish muddati yoqildi (1 soat)");
  ok((await J(await req("cl", `/api/chat/${convId}?read=0`))).data.ttlSeconds === 3600, "A10: qarshi tomon javobida ttlSeconds ko'rinadi");
  ok((await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId)?.ttlSeconds === 3600, "A10: ro'yxat qatorida ham ttlSeconds");
  const secret = await send("sp", `${TAG} MAXFIY-yoqoladi`);
  ok(secret.status === 201 && secret.data.expiresAt > Date.now(), "yo'qoladigan xabar expiresAt bilan qaytadi");
  const reply = await send("cl", `${TAG} javob`, { replyToId: secret.data.id });
  await post("sp", `/api/chat/${convId}/pin`, { messageId: secret.data.id }, "PUT");
  // Muddatni o'tmishga suramiz (cron hali o'chirmagan holat)
  await db.execute({ sql: "update dm_messages set expires_at = ? where id in (?, ?)", args: [Date.now() - 1000, secret.data.id, reply.data.id] });
  const th = await J(await req("cl", `/api/chat/${convId}?read=0`));
  ok(!th.data.items.some((m) => m.id === secret.data.id), "A10: suhbatda ko'rinmaydi");
  ok(th.data.pinned === null, "A10: qadalgan xabar sifatida ko'rinmaydi");
  for (const who of ["sp", "cl"]) {
    const prev = (await J(await req(who, "/api/chat"))).data.items.find((c) => c.id === convId);
    ok(!String(prev?.last?.body ?? "").includes("MAXFIY"), `A10: ro'yxat parchasida chiqmaydi (${who})`, prev?.last?.body);
  }
  const srch = await J(await req("cl", `/api/chat/${convId}/search?q=MAXFIY`));
  ok(srch.status === 200 && srch.data.items.length === 0, "A10: qidiruvda chiqmaydi");
  ok((await send("cl", `${TAG} iqtibos`, { replyToId: secret.data.id })).status === 422, "A10: muddati o'tgan xabarga javob berib bo'lmaydi");
  ok((await J(await post("cl", `/api/chat/${convId}/pin`, { messageId: secret.data.id }, "PUT"))).status === 404, "A10: qadab bo'lmaydi");
  ok((await J(await post("cl", `/api/chat/${convId}/forward`, { messageId: secret.data.id, to: convId }))).status === 404, "A10: yo'naltirib bo'lmaydi");
  ok((await J(await post("cl", `/api/chat/${convId}/messages/${secret.data.id}/reaction`, { emoji: "👍" }, "PUT"))).status === 404, "A10: reaksiya qo'yib bo'lmaydi");
  await post("sp", `/api/chat/${convId}/ttl`, { seconds: 0 }, "PATCH");
  await post("sp", `/api/chat/${convId}/pin`, { messageId: null }, "PUT");

  /* ---------------------------------------------------------------- */
  /* C1: eski tarixni sahifalab yuklash va sakrash                      */
  /* ---------------------------------------------------------------- */
  const base = Date.now() - 3_600_000;
  const bulk = [];
  for (let i = 0; i < 130; i++) bulk.push({ sql: "insert into dm_messages (id, conversation_id, sender_id, body, attachments, created_at) values (?, ?, ?, ?, '[]', ?)", args: [`${TAG}-h${String(i).padStart(3, "0")}`, convId, i % 2 ? SP.id : CL.id, `${TAG} tarix ${i}`, base + i * 1000] });
  await db.batch(bulk);
  const first = await J(await req("sp", `/api/chat/${convId}?read=0`));
  ok(first.data.items.length === 80 && first.data.hasMore === true, "C1: birinchi sahifa 80 ta, hasMore=true", `${first.data.items.length}/${first.data.hasMore}`);
  const older = await J(await req("sp", `/api/chat/${convId}?before=${first.data.items[0].id}`));
  ok(older.status === 200 && older.data.items.length > 0 && older.data.items[older.data.items.length - 1].at <= first.data.items[0].at, "C1: ?before= eskiroq sahifani beradi", String(older.data.items?.length));
  const seenIds = new Set([...first.data.items, ...older.data.items].map((m) => m.id));
  ok(seenIds.size === first.data.items.length + older.data.items.length, "C1: sahifalar orasida takror yo'q");
  const jump = await J(await req("sp", `/api/chat/${convId}?from=${TAG}-h003&read=0`));
  ok(jump.status === 200 && jump.data.items.some((m) => m.id === `${TAG}-h003`) && jump.data.items[jump.data.items.length - 1].id === first.data.items[first.data.items.length - 1].id, "C1: ?from= nishondan eng yangisigacha yuklaydi");
  const sr = await J(await req("sp", `/api/chat/${convId}/search?q=${encodeURIComponent("tarix 3")}`));
  ok(sr.data.items.some((m) => m.id === `${TAG}-h003`), "qidiruv eski xabarni topadi");

  /* ---------------------------------------------------------------- */
  /* A15: blok — tahrir/qadoq/yozmoqda/onlayn yopiq                     */
  /* ---------------------------------------------------------------- */
  const mine = await send("cl", `${TAG} blokdan oldin`);
  ok((await req("sp", `/api/blocks/${encodeURIComponent(CL.id)}`, { method: "POST" })).ok, "mutaxassis mijozni blokladi");
  ok((await send("cl", `${TAG} blokdan keyin`)).status === 403, "bloklangan odam yoza olmaydi (403)");
  ok((await J(await post("cl", `/api/chat/${convId}/messages/${mine.data.id}`, { body: "o'zgartirildi" }, "PATCH"))).status === 403, "A15: bloklangan odam eski xabarini TAHRIRLAY olmaydi");
  ok((await J(await post("cl", `/api/chat/${convId}/pin`, { messageId: mine.data.id }, "PUT"))).status === 403, "A15: bloklangan odam QADAY olmaydi");
  ok((await J(await post("cl", `/api/chat/${convId}/typing`, { typing: true }))).status === 403, "A15: bloklangan odam «yozmoqda» yubora olmaydi");
  ok((await J(await post("cl", `/api/chat/${convId}/ttl`, { seconds: 3600 }, "PATCH"))).status === 403, "A15: bloklangan odam yo'qolish muddatini o'zgartira olmaydi");
  await db.execute({ sql: "update users set last_seen_at = ? where id = ?", args: [Date.now(), SP.id] });
  const blockedView = await J(await req("cl", `/api/chat/${convId}?read=0`));
  ok(blockedView.data.blocked.me === true && blockedView.data.peer.lastSeenAt === null && blockedView.data.peer.lastActiveAt === null, "A15: bloklangan odam onlayn holatini ko'rmaydi (suhbat)");
  const blockedRow = (await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId);
  ok(blockedRow.peer.lastSeenAt === null && blockedRow.peerTyping === false, "A15: ro'yxatda ham onlayn/yozmoqda yashirin");
  ok((await req("cl", `/api/chat/${convId}/messages/${mine.data.id}?scope=all`, { method: "DELETE" })).status === 200, "blokda ham o'z xabarini o'chirish mumkin");
  ok((await req("sp", `/api/blocks/${encodeURIComponent(CL.id)}`, { method: "DELETE" })).ok, "blokdan chiqarildi");

  /* ---------------------------------------------------------------- */
  /* Begona foydalanuvchi: suhbatga kira olmaydi                        */
  /* ---------------------------------------------------------------- */
  if (third) {
    ok((await req("x", `/api/chat/${convId}`)).status === 404, "begona foydalanuvchi suhbatni o'qiy olmaydi (404)");
    ok((await post("x", `/api/chat/${convId}`, { body: "x" })).status === 404, "begona foydalanuvchi yoza olmaydi (404)");
    ok((await req("x", `/api/chat/${convId}`, { method: "DELETE" })).status === 404, "begona foydalanuvchi suhbatni o'chira olmaydi (404)");
    ok((await req("x", `/api/chat/${convId}?before=${TAG}-h050`)).status === 404, "begona foydalanuvchi tarixni sahifalay olmaydi (404)");
  }

  /* ---------------------------------------------------------------- */
  /* A22: papkalar — takror nom, guruh hisobi, o'chirilganda tozalash   */
  /* ---------------------------------------------------------------- */
  const f1 = await J(await post("sp", "/api/chat/papkalar", { name: `${TAG.slice(-8)} Ish` }));
  created.folders.push(f1.data?.id);
  ok(f1.status === 200 && Boolean(f1.data?.id), "papka yaratildi");
  ok((await J(await post("sp", "/api/chat/papkalar", { name: `${TAG.slice(-8)} ISH` }))).status === 409, "A22: bir xil nomli papka (harf registriga qaramay) 409");

  /* ---------------------------------------------------------------- */
  /* C3: suhbatni men uchun o'chirish                                   */
  /* ---------------------------------------------------------------- */
  const wipe = await J(await req("sp", `/api/chat/${convId}`, { method: "DELETE" }));
  ok(wipe.status === 200 && wipe.data.hidden > 0, "C3: suhbat men uchun o'chirildi", String(wipe.data?.hidden));
  ok(!(await J(await req("sp", "/api/chat"))).data.items.some((c) => c.id === convId), "C3: ro'yxatimdan yo'qoldi");
  ok((await J(await req("sp", `/api/chat/${convId}?read=0`))).data.items.length === 0, "C3: tarix menda bo'sh");
  ok((await J(await req("cl", `/api/chat/${convId}?read=0`))).data.items.length > 0, "C3: suhbatdoshda tarix joyida");
  ok(Boolean((await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId)), "C3: suhbatdosh ro'yxatida qoladi");
  const back = await send("cl", `${TAG} qaytdi`);
  const again = (await J(await req("sp", "/api/chat"))).data.items.find((c) => c.id === convId);
  ok(back.status === 201 && again?.last?.body === `${TAG} qaytdi` && again.unread === 1, "C3: yangi xabar kelsa suhbat faqat yangi xabar bilan qaytadi");
  ok((await J(await req("sp", `/api/chat/${convId}?read=0`))).data.items.length === 1, "C3: eski tarix qaytmaydi");

  /* ---------------------------------------------------------------- */
  /* A2/B6: nishon so'rovi — yagona yig'indi                            */
  /* ---------------------------------------------------------------- */
  const un = await J(await req("sp", "/api/chat/unread"));
  ok(un.status === 200 && typeof un.data.total === "number" && un.data.dm >= 1 && un.data.total === un.data.dm + un.data.groups + un.data.orders, "A2: /api/chat/unread yig'indisi (dm + groups + orders)", JSON.stringify({ dm: un.data.dm, g: un.data.groups, o: un.data.orders, t: un.data.total }));
  const lastSeenBefore = (await db.execute({ sql: "select last_seen_at from users where id = ?", args: [CL.id] })).rows[0].last_seen_at;
  await db.execute({ sql: "update users set last_seen_at = ? where id = ?", args: [Date.now() - 600_000, CL.id] });
  await req("cl", "/api/chat/unread");
  const lastSeenAfter = (await db.execute({ sql: "select last_seen_at from users where id = ?", args: [CL.id] })).rows[0].last_seen_at;
  ok(Date.now() - Number(lastSeenAfter) > 500_000, "A2: nishon so'rovi foydalanuvchini «onlayn» qilmaydi (hech narsa yozmaydi)");
  await db.execute({ sql: "update users set last_seen_at = ? where id = ?", args: [lastSeenBefore, CL.id] });

  /* ================================================================ */
  /* GURUH CHATI                                                       */
  /* ================================================================ */
  const mk = await J(await post("sp", "/api/groups", { name: `${TAG} guruh`, description: "E2E chat sinovi", kind: "group", isPrivate: false }));
  const G = mk.data?.slug;
  ok(mk.status === 201 && Boolean(G), "guruh yaratildi", String(mk.status));
  created.groups.push(G);
  const gid = mk.data.id;
  const gchat = `/api/groups/${encodeURIComponent(G)}/chat`;
  ok((await req("cl", gchat)).status === 403, "a'zo bo'lmagan guruh chatini o'qiy olmaydi (403)");
  ok((await J(await post("cl", `/api/groups/${encodeURIComponent(G)}/join`, {}))).data?.membership === "member", "mijoz guruhga qo'shildi");
  // Inbox keshi a'zolik o'zgarganini darhol ko'radi (chiqish/qo'shilish boshqa modulda — kalit imzosi orqali)
  ok((await J(await req("cl", "/api/chat"))).data.groups.some((g) => g.slug === G), "A4/A7: qo'shilgach guruh qatori inbox'da darhol paydo bo'ladi");

  /* A8: o'qilganlik — yolg'on ✓✓ yo'q, polling'da yo'qolmaydi */
  const g1 = await J(await post("sp", gchat, { body: `${TAG} g-birinchi` }));
  ok(g1.status === 201, "guruhga xabar yuborildi");
  let gv = await J(await req("sp", `${gchat}?after=${g1.data.id}&changedSince=${Date.now() - 1000}`));
  ok(gv.data.seen?.messageId === g1.data.id && gv.data.seen.count === 0 && gv.data.readUpTo < g1.data.at, "A8: hech kim o'qimaganda seen.count=0 va readUpTo eski (✓✓ chiqmaydi)", JSON.stringify({ seen: gv.data.seen, readUpTo: gv.data.readUpTo }));
  await req("cl", gchat); // mijoz o'qidi
  gv = await J(await req("sp", `${gchat}?after=${g1.data.id}&changedSince=${Date.now() - 1000}`));
  ok(gv.data.items.length === 0 && gv.data.seen?.messageId === g1.data.id && gv.data.seen.count >= 1 && gv.data.readUpTo >= g1.data.at, "A8: a'zo o'qigach POLLING javobida seen.count≥1 va readUpTo yangilanadi", JSON.stringify({ seen: gv.data.seen }));

  /* A1 (guruh): o'qildi belgisi shartli — polling a'zolar o'rtasida ping-pong qilmaydi */
  const lr = async (uid) => (await db.execute({ sql: "select last_read_at from group_members where group_id = ? and user_id = ?", args: [gid, uid] })).rows[0]?.last_read_at;
  const lr1 = await lr(CL.id);
  await sleep(20);
  await req("cl", `${gchat}?after=${g1.data.id}`);
  await req("cl", gchat);
  ok((await lr(CL.id)) === lr1, "A1: yangi faollik bo'lmasa guruh polling last_read_at ni o'zgartirmaydi");
  ok((await J(await req("cl", "/api/chat"))).data.groups.find((g) => g.slug === G)?.unread === 0, "o'qilgach guruh qatori unread 0");

  /* A7: ro'yxat — guruhdagi yangi xabar SSE `inbox` bilan keladi; B7: reaksiya/qadoq `group` bilan */
  await sleep(1200);
  let g2 = null;
  const inboxEv = await sse("cl", "", 3200, async (events) => {
    await sleep(2400);
    events.length = 0;
    g2 = await J(await post("sp", gchat, { body: `${TAG} g-ikkinchi`, replyToId: g1.data.id }));
  });
  ok(inboxEv.some((e) => e.ev === "inbox"), "A7: guruhdagi yangi xabar ro'yxatga SSE `inbox` hodisasi bilan keladi", JSON.stringify(inboxEv.map((e) => e.ev)));
  const rowG = (await J(await req("cl", "/api/chat"))).data.groups.find((g) => g.slug === G);
  ok(rowG?.unread === 1 && rowG.last?.body === `${TAG} g-ikkinchi`, "A7: inbox qatori yangi xabar va o'qilmagan sonni ko'rsatadi", JSON.stringify({ u: rowG?.unread, b: rowG?.last?.body }));
  const un2 = await J(await req("cl", "/api/chat/unread"));
  ok(un2.data.groups >= 1, "A2: nishon yig'indisida guruh o'qilmaganlari bor");
  const grpEv = await sse("cl", `?group=${encodeURIComponent(G)}&only=group`, 2600, async (events) => {
    await sleep(2300);
    events.length = 0;
    await post("sp", `${gchat}/${g1.data.id}/reaction`, { emoji: "🔥" }, "PUT");
  });
  ok(grpEv.some((e) => e.ev === "group"), "B7: guruhda reaksiya SSE `group` bilan keladi", JSON.stringify(grpEv.map((e) => e.ev)));
  const pinEv = await sse("cl", `?group=${encodeURIComponent(G)}&only=group`, 2600, async (events) => {
    await sleep(2300);
    events.length = 0;
    await post("sp", `${gchat}/${g1.data.id}`, { pinned: true }, "PATCH");
  });
  ok(pinEv.some((e) => e.ev === "group"), "B7: guruhda qadoq SSE `group` bilan keladi", JSON.stringify(pinEv.map((e) => e.ev)));
  await post("sp", `${gchat}/${g1.data.id}`, { pinned: false }, "PATCH");

  /* A21: @eslatma — faqat faol a'zoga, jim qilganga yo'q */
  const mentions = async (uid) => Number((await db.execute({ sql: "select count(*) n from notifications where user_id = ? and type = 'mention' and href like ?", args: [uid, `%guruh=${G}%`] })).rows[0].n);
  const before = await mentions(CL.id);
  await post("sp", gchat, { body: `@${CL.username} ${TAG} qarang` });
  ok((await mentions(CL.id)) === before + 1, "A21: guruh chatidagi @eslatma a'zoga bildirishnoma yuboradi");
  if (third) {
    const b3 = await mentions(third.id);
    await post("sp", gchat, { body: `@${third.username} ${TAG} siz ham` });
    ok((await mentions(third.id)) === b3, "A21: a'zo BO'LMAGAN odamga eslatma ketmaydi (chat matni sizmaydi)");
  }
  await post("cl", `/api/chat/guruh/${gid}`, { muted: true }, "PATCH");
  await post("sp", gchat, { body: `@${CL.username} ${TAG} jim` });
  ok((await mentions(CL.id)) === before + 1, "A21: jamoani jim qilgan a'zoga eslatma ketmaydi");
  await post("cl", `/api/chat/guruh/${gid}`, { muted: false }, "PATCH");

  /* A22: ko'rinmas matn; C6: matnli xabarni bo'sh qilib bo'lmaydi */
  ok((await J(await post("sp", gchat, { body: zw }))).status === 422, "A22: guruhda ham ko'rinmas matn 422");
  ok((await J(await post("sp", `${gchat}/${g1.data.id}`, { body: "" }, "PATCH"))).status === 422, "C6: matnli guruh xabarini bo'sh qilib tahrirlab bo'lmaydi");

  /* C6 + A11: biriktirma — izohni tahrirlash, yopiq fayl manzili nisbiy yo'naltirish */
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await db.execute({ sql: "delete from rate_limits where key = ?", args: [`upload:${SP.id}`] });
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "e2e.png");
  fd.append("purpose", "attachment");
  const up = await J(await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie: C.sp, origin: BASE }, body: fd }));
  if (up.data?.url) {
    const att = [{ url: up.data.url, name: "e2e.png", size: png.length, type: "image/png" }];
    const gm = await J(await post("sp", gchat, { body: "", attachments: att }));
    ok(gm.status === 201, "rasmli (matnsiz) xabar yuborildi");
    const lst = await J(await req("sp", gchat));
    const view = lst.data.items.find((m) => m.id === gm.data.id);
    ok(view?.canEdit === true, "C6: biriktirmali xabarni (izoh qo'shish uchun) tahrirlash mumkin");
    ok(view && view.attachments[0].url.startsWith("/api/media/group/"), "5-audit: biriktirma xom manzilsiz (/api/media/…)");
    ok((await J(await post("sp", `${gchat}/${gm.data.id}`, { body: "izoh qo'shildi" }, "PATCH"))).status === 200, "C6: izoh qo'shildi");
    ok((await J(await post("sp", `${gchat}/${gm.data.id}`, { body: "" }, "PATCH"))).status === 200, "C6: biriktirmali xabarda izohni olib tashlash mumkin");
    const red = await fetch(`${BASE}${view.attachments[0].url}`, { headers: { cookie: C.sp }, redirect: "manual" });
    const loc = red.headers.get("location") ?? "";
    ok(red.status === 302 && loc.startsWith("/api/media/group/") && !/^https?:/i.test(loc), "A11: yopiq fayl yo'naltirishi NISBIY manzil (origin'ga bog'liq emas)", loc.slice(0, 60));
    const file = await fetch(`${BASE}${loc}`, { headers: { cookie: C.sp } });
    ok(file.status === 200 && (file.headers.get("content-type") ?? "").startsWith("image/png"), "A11: fayl oqimi ochiladi", `${file.status} ${file.headers.get("content-type")}`);
    if (third) ok((await fetch(`${BASE}${view.attachments[0].url}`, { headers: { cookie: C.x }, redirect: "manual" })).status === 404, "begona foydalanuvchi guruh faylini ola olmaydi (404)");
    // DM: rasmli xabar parchasi «rasm» turi bilan (B8) va izoh tahriri (C6)
    const dmImg = await J(await post("sp", `/api/chat/${convId}`, { body: "", attachments: att }));
    ok(dmImg.status === 201, "DM: rasmli xabar yuborildi");
    const dmRow = (await J(await req("cl", "/api/chat"))).data.items.find((c) => c.id === convId);
    ok(dmRow?.last?.kind === "image", "B8: ro'yxat parchasi biriktirma turini beradi (image)", dmRow?.last?.kind);
    ok((await J(await post("sp", `/api/chat/${convId}/messages/${dmImg.data.id}`, { body: "DM izoh" }, "PATCH"))).status === 200, "C6: DM rasmiga izoh qo'shildi");
    const gRow = (await J(await req("cl", "/api/chat"))).data.groups.find((g) => g.slug === G);
    ok(gRow?.last?.kind === "image" || gRow?.last?.kind === "text", "B8: guruh qatorida ham tur maydoni bor", gRow?.last?.kind);
  } else {
    console.log("   (yuklash bu muhitda ishlamadi — biriktirma testlari o'tkazib yuborildi)", up.status, up.error ?? "");
  }

  /* C1 (guruh): sahifalash va sakrash */
  const gbulk = [];
  for (let i = 0; i < 100; i++) gbulk.push({ sql: "insert into group_messages (id, group_id, sender_id, body, attachments, created_at) values (?, ?, ?, ?, '[]', ?)", args: [`${TAG}-g${String(i).padStart(3, "0")}`, gid, i % 2 ? SP.id : CL.id, `${TAG} gtarix ${i}`, base + i * 1000] });
  await db.batch(gbulk);
  const gp = await J(await req("sp", `${gchat}?read=0`));
  ok(gp.data.items.length === 80 && gp.data.hasMore === true, "C1: guruh — birinchi sahifa 80 ta, hasMore=true", `${gp.data.items.length}/${gp.data.hasMore}`);
  const gold = await J(await req("sp", `${gchat}?before=${gp.data.items[0].id}`));
  ok(gold.data.items.length > 0 && gold.data.items.every((m) => m.at <= gp.data.items[0].at), "C1: guruh — ?before= eskiroq sahifa", String(gold.data.items.length));
  const gjump = await J(await req("sp", `${gchat}?from=${TAG}-g002&read=0`));
  ok(gjump.status === 200 && gjump.data.items.some((m) => m.id === `${TAG}-g002`), "C1: guruh — ?from= eski xabarga sakrash");

  /* A20: mavzular — yangi mavzu ochiq chatga keladi, boshqa mavzudagi xabar o'qilmagan bo'lib qoladi */
  await req("cl", gchat); // mijoz «Umumiy»ni o'qib oldi
  const tp = await J(await post("sp", `/api/groups/${encodeURIComponent(G)}/mavzular`, { name: `${TAG.slice(-6)} mavzu` }));
  ok(tp.status === 200 && Boolean(tp.data?.id), "mavzu yaratildi");
  ok((await J(await post("sp", `/api/groups/${encodeURIComponent(G)}/mavzular`, { name: `${TAG.slice(-6)} MAVZU` }))).status === 409, "A20: bir xil nomli mavzu 409");
  const tmsg = await J(await post("sp", gchat, { body: `${TAG} mavzu-xabar`, topicId: tp.data.id }));
  const seenParam = encodeURIComponent(`:${Date.now()}`);
  const poll = await J(await req("cl", `${gchat}?after=${gp.data.items[gp.data.items.length - 1].id}&changedSince=${Date.now() - 2000}&seen=${seenParam}`));
  ok(poll.data.topics?.some((t) => t.id === tp.data.id && t.unread === 1), "A20: polling javobida yangi mavzu va undagi o'qilmagan soni keladi", JSON.stringify(poll.data.topics));
  ok(!poll.data.items.some((m) => m.id === tmsg.data.id), "A20: mavzu xabari «Umumiy» oqimga aralashmaydi");
  const rowT = (await J(await req("cl", "/api/chat"))).data.groups.find((g) => g.slug === G);
  ok(rowT?.unread >= 1, "A20: boshqa mavzudagi xabar inbox'da o'qilmagan bo'lib QOLADI (Umumiy polling uni o'qilgan qilmaydi)", String(rowT?.unread));
  const inTopic = await J(await req("cl", `${gchat}?topic=${tp.data.id}&seen=${seenParam}`));
  ok(inTopic.data.items.some((m) => m.id === tmsg.data.id) && inTopic.data.topicId === tp.data.id, "A20: mavzu oqimi ochiladi");
  ok((await J(await req("cl", "/api/chat"))).data.groups.find((g) => g.slug === G)?.unread === 0, "A20: mavzu ko'rilgach inbox unread 0");
  const gs = await J(await req("cl", `${gchat}?q=${encodeURIComponent("mavzu-xabar")}`));
  ok(gs.data.items.find((m) => m.id === tmsg.data.id)?.topicId === tp.data.id, "A20: qidiruv natijasida topicId bor (boshqa mavzudagi natijaga o'tish uchun)");
  const tj = await J(await req("cl", `${gchat}?from=${tmsg.data.id}`));
  ok(tj.data.topicId === tp.data.id, "A20: ?from= nishon xabarning o'z mavzusini qaytaradi");
  await post("sp", `${gchat}/${tmsg.data.id}`, { pinned: true }, "PATCH");
  ok((await J(await req("cl", gchat))).data.pinned?.topicId === tp.data.id, "A20: qadalgan xabar o'z mavzusi bilan qaytadi (boshqa oqimda ko'rsatilmaydi)");

  /* A22: papka o'chirilganda guruh qatoridagi ishora tozalanadi; hisobga guruh ham kiradi */
  const fid = created.folders[0];
  ok((await J(await post("sp", `/api/chat/guruh/${gid}`, { folderId: fid }, "PATCH"))).status === 200, "guruh papkaga ko'chirildi");
  ok((await J(await req("sp", "/api/chat"))).data.folders.find((f) => f.id === fid)?.count === 1, "A22: papka hisobiga guruh ham kiradi");
  ok((await J(await post("cl", `/api/chat/guruh/${gid}`, { folderId: fid }, "PATCH"))).status === 404, "begona papkaga ko'chirib bo'lmaydi (404)");
  ok((await req("sp", `/api/chat/papkalar/${fid}`, { method: "DELETE" })).status === 200, "papka o'chirildi");
  created.folders = [];
  ok((await db.execute({ sql: "select folder_id from group_members where group_id = ? and user_id = ?", args: [gid, SP.id] })).rows[0].folder_id === null, "A22: papka o'chirilgach group_members.folder_id tozalandi");
  ok((await J(await req("sp", "/api/chat"))).data.groups.find((g) => g.slug === G)?.folderId === null, "A22: inbox qatorida ham papka yo'q");

  /* A4: guruhdan chiqish — inbox'dan darhol yo'qoladi; egasi chiqa olmaydi */
  ok((await req("sp", `/api/groups/${encodeURIComponent(G)}/join`, { method: "DELETE" })).status === 400, "A4: egasi jamoadan chiqa olmaydi (400)");
  ok((await req("cl", `/api/groups/${encodeURIComponent(G)}/join`, { method: "DELETE" })).status === 200, "A4: a'zo guruhdan chiqdi");
  ok(!(await J(await req("cl", "/api/chat"))).data.groups.some((g) => g.slug === G), "A4: chiqqach qator inbox'dan darhol yo'qoladi");
  ok((await req("cl", gchat)).status === 403, "chiqqan a'zo chatni o'qiy olmaydi");

  /* ================================================================ */
  /* YOPIQ GURUH: so'rov → tasdiqlash (A3), so'rovni qaytarib olish (A4) */
  /* ================================================================ */
  const pk = await J(await post("sp", "/api/groups", { name: `${TAG} yopiq`, description: "", kind: "group", isPrivate: true }));
  const P = pk.data?.slug;
  created.groups.push(P);
  const pmem = `/api/groups/${encodeURIComponent(P)}/members`;
  ok((await J(await post("cl", `/api/groups/${encodeURIComponent(P)}/join`, { note: "Sinov" }))).data?.membership === "pending", "yopiq guruhga so'rov yuborildi");
  ok((await req("cl", `${pmem}?status=pending`)).status === 403, "oddiy foydalanuvchi so'rovlar ro'yxatini ko'ra olmaydi (403)");
  const pend = await J(await req("sp", `${pmem}?status=pending`));
  ok(pend.data.items.some((m) => m.user.id === CL.id && m.note === "Sinov"), "A3: egasi kutayotgan so'rovni izohi bilan ko'radi");
  ok((await req("cl", `/api/groups/${encodeURIComponent(P)}/join`, { method: "DELETE" })).status === 200, "A4: so'rov qaytarib olindi");
  ok(!(await J(await req("sp", `${pmem}?status=pending`))).data.items.some((m) => m.user.id === CL.id), "A4: qaytarib olingan so'rov ro'yxatdan chiqdi");
  await post("cl", `/api/groups/${encodeURIComponent(P)}/join`, {});
  ok((await J(await post("cl", pmem, { userId: SP.id, action: "approve" }, "PATCH"))).status === 403, "so'rov yuborgan odam o'zini tasdiqlay olmaydi (403)");
  ok((await J(await post("sp", pmem, { userId: CL.id, action: "approve" }, "PATCH"))).status === 200, "A3: egasi so'rovni tasdiqladi");
  ok((await J(await req("cl", "/api/chat"))).data.groups.some((g) => g.slug === P), "A3: tasdiqlangach guruh a'zoning inbox'ida");
  ok((await req("cl", `/api/groups/${encodeURIComponent(P)}/chat`)).status === 200, "A3: tasdiqlangan a'zo chatni o'qiydi");

  /* ================================================================ */
  /* KANAL: yangi post ochiq kanalga SSE `posts` bilan keladi (A18)     */
  /* ================================================================ */
  const ck = await J(await post("sp", "/api/groups", { name: `${TAG} kanal`, description: "", kind: "channel", isPrivate: false }));
  const CH = ck.data?.slug;
  created.groups.push(CH);
  await post("cl", `/api/groups/${encodeURIComponent(CH)}/join`, {});
  await db.execute({ sql: "delete from rate_limits where key = ?", args: [`posts:${SP.id}`] });
  const postsEv = await sse("cl", `?group=${encodeURIComponent(CH)}&only=group`, 2600, async (events) => {
    await sleep(2300);
    events.length = 0;
    await post("sp", `/api/groups/${encodeURIComponent(CH)}/posts`, { body: `${TAG} kanal posti https://kasbegalari.uz/juda-uzun-manzil` });
  });
  ok(postsEv.some((e) => e.ev === "posts"), "A18: kanaldagi yangi post SSE `posts` hodisasi bilan keladi", JSON.stringify(postsEv.map((e) => e.ev)));
  const chRow = (await J(await req("cl", "/api/chat"))).data.groups.find((g) => g.slug === CH);
  ok(chRow?.unread === 1 && chRow.kind === "channel", "A7: kanal qatorida yangi post o'qilmagan bo'lib ko'rinadi");

  /* ================================================================ */
  /* HAVOLALAR: /yozish ochilmasa sababi bilan (B10); eski «a'zolar» manzili (A3) */
  /* ================================================================ */
  const hop = async (who, path) => {
    const r = await fetch(`${BASE}${path}`, { headers: { cookie: C[who] }, redirect: "manual" });
    return `${r.status} ${r.headers.get("location") ?? ""}`;
  };
  const nf = await hop("sp", "/yozish/bunday-taxallus-yoq-e2e");
  ok(/^30[78] .*\/kabinet\/chat\?xato=topilmadi$/.test(nf), "B10: mavjud bo'lmagan taxallus — ro'yxatga SABABI bilan (?xato=topilmadi)", nf);
  const self = await hop("sp", `/yozish/${SP.username}`);
  ok(/xato=ozim$/.test(self), "B10: o'z taxallusi — ?xato=ozim", self);
  await post("sp", `/api/blocks/${CL.id}`, {});
  const blk = await hop("cl", `/yozish/${SP.username}`);
  ok(/xato=blok$/.test(blk), "B10: blok juftligi — ?xato=blok (suhbat yaratilmaydi)", blk);
  await req("sp", `/api/blocks/${CL.id}`, { method: "DELETE" });
  const okHop = await hop("cl", `/yozish/${SP.username}`);
  ok(new RegExp(`/kabinet/chat\\?s=${convId}$`).test(okHop), "/yozish/<taxallus> mavjud suhbatni ochadi", okHop);
  const az = await hop("sp", `/jamoalar/${encodeURIComponent(P)}?tab=azolar`);
  ok(/guruh=.*gtab=azolar/.test(az), "A3: eski «a'zolar» havolasi a'zolar varag'iga olib boradi (gtab=azolar)", az);

  /* ================================================================ */
  /* BUYURTMA CHATI: ko'rinmas matn (A22)                               */
  /* ================================================================ */
  const ord = (await db.execute({ sql: "select o.id from orders o join specialists s on s.id = o.specialist_id where s.user_id = ? order by o.created_at desc limit 1", args: [SP.id] })).rows[0];
  if (ord) {
    const om = `/api/orders/${ord.id}/messages`;
    ok((await J(await post("sp", om, { body: zw }))).status === 422, "A22: buyurtma chatida ham ko'rinmas matn rad etiladi (422)");
    ok((await J(await post("sp", om, { body: "  " }))).status === 422, "buyurtma chatida bo'sh xabar 422");
  }
} finally {
  /* ---------------------------------------------------------------- */
  /* Tozalash                                                          */
  /* ---------------------------------------------------------------- */
  try {
    await db.execute({ sql: "delete from user_blocks where (blocker_id = ? and blocked_id = ?) or (blocker_id = ? and blocked_id = ?)", args: [SP.id, CL.id, CL.id, SP.id] });
    if (convId) {
      await db.execute({ sql: "delete from dm_messages where conversation_id = ?", args: [convId] });
      await db.execute({ sql: "update conversations set last_message_at = null, a_read_at = null, b_read_at = null, pinned_message_id = null, ttl_seconds = 0 where id = ?", args: [convId] });
      await db.execute({ sql: "delete from dm_conversation_prefs where conversation_id = ?", args: [convId] });
    }
    for (const id of created.folders.filter(Boolean)) await db.execute({ sql: "delete from dm_folders where id = ?", args: [id] });
    for (const slug of created.groups.filter(Boolean)) {
      // API orqali (kaskad bilan: a'zolar, xabarlar, mavzular, postlar); bildirishnomalar alohida tozalanadi
      await req("sp", `/api/groups/${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => null);
      await db.execute({ sql: "delete from groups where slug = ?", args: [slug] });
      await db.execute({ sql: "delete from notifications where href like ? or href like ?", args: [`%guruh=${slug}%`, `%/jamoalar/${slug}%`] });
    }
    await db.execute({ sql: "update users set show_online = 1 where id in (?, ?)", args: [SP.id, CL.id] });
  } catch (e) {
    console.error("tozalash xatosi", e);
  }
}
finish();
