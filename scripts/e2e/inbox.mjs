import { BASE, cookies, finish, makeReq, ok } from "./_lib.mjs";
// Telegram inbox sinovi: /api/chat groups qatorlari + guruh pin/papka PATCH + ruxsatlar
const C = await cookies();
const req = makeReq(C);

// Mehmon 401
ok((await fetch(BASE + "/api/chat")).status === 401, "mehmon /api/chat 401");
ok((await fetch(BASE + "/api/chat/guruh/x", { method: "PATCH", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ pinned: true }) })).status === 401, "mehmon guruh PATCH 401");

// Mijoz inbox — guruhlar bor
const j = await (await req("cl", "/api/chat")).json();
const groups = j.data?.groups ?? [];
ok(Array.isArray(groups) && groups.length > 0, "inbox'da guruh/kanal qatorlari bor", String(groups.length));
const official = groups.find((g) => g.isOfficial);
ok(Boolean(official && official.kind === "channel"), "rasmiy kanal ro'yxatda", official?.name);
const anyGroup = groups.find((g) => g.kind === "group") ?? groups[0];
console.log("   namuna:", JSON.stringify({ kind: anyGroup.kind, name: anyGroup.name, last: anyGroup.last?.body?.slice(0, 30), unread: anyGroup.unread }));

// Pin → ro'yxatda pinned true; keyin bekor
const p1 = await req("cl", `/api/chat/guruh/${anyGroup.id}`, { method: "PATCH", body: JSON.stringify({ pinned: true }) });
ok(p1.status === 200, "pin saqlandi", String(p1.status));
const j2 = await (await req("cl", "/api/chat")).json();
ok((j2.data.groups.find((g) => g.id === anyGroup.id)?.pinned) === true, "pin ro'yxatda ko'rindi");
await req("cl", `/api/chat/guruh/${anyGroup.id}`, { method: "PATCH", body: JSON.stringify({ pinned: false }) });

// Papka: yaratish → guruhni papkaga → tekshirish → papkadan chiqarish → papkani o'chirish
const fr = await (await req("cl", "/api/chat/papkalar", { method: "POST", body: JSON.stringify({ name: "Sinov papka" }) })).json();
const fid = fr.data?.id;
ok(Boolean(fid), "papka yaratildi");
const mv = await req("cl", `/api/chat/guruh/${anyGroup.id}`, { method: "PATCH", body: JSON.stringify({ folderId: fid }) });
ok(mv.status === 200, "guruh papkaga ko'chdi", String(mv.status));
const j3 = await (await req("cl", "/api/chat")).json();
ok(j3.data.groups.find((g) => g.id === anyGroup.id)?.folderId === fid, "papka ro'yxatda ko'rindi");
await req("cl", `/api/chat/guruh/${anyGroup.id}`, { method: "PATCH", body: JSON.stringify({ folderId: null }) });
await req("cl", `/api/chat/papkalar/${fid}`, { method: "DELETE" });

// A'zo bo'lmagan guruh — 404 (sp ning a'zo emasligini topamiz: yo'q id)
const bad = await req("cl", "/api/chat/guruh/yoq-guruh-123", { method: "PATCH", body: JSON.stringify({ pinned: true }) });
ok(bad.status === 404, "begona/yo'q guruh 404", String(bad.status));
finish();
