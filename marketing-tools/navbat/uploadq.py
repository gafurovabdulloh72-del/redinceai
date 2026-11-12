"""Tayyor postlarni navbatga qo'shish: media egasining chatiga jim yuklanadi (file_id olish uchun) va darhol o'chiriladi.
  python3 uploadq.py <ish_papka> caps1.json caps2.json ...   (har to'plamdan navbat bilan aralashtiriladi)
Kalit: MARKETING_BOT_TOKEN (muhitda). navbat.json shu papkada."""
import json, os, sys, subprocess, itertools
HERE = os.path.dirname(os.path.abspath(__file__)); T = os.environ["MARKETING_BOT_TOKEN"]; A = f"https://api.telegram.org/bot{T}"; OWNER = "1643026769"
def call(m, d, files={}):
    a = ["curl", "-sS", "-m", "600", "-X", "POST", f"{A}/{m}"]
    for k, v in d.items(): a += ["--form-string", f"{k}={v}"]
    for k, v in files.items(): a += ["-F", f"{k}=@{v}"]
    return json.loads(subprocess.run(a, capture_output=True, text=True).stdout)
work = sys.argv[1]; sets = [json.load(open(os.path.join(work, f))) for f in sys.argv[2:]]
qpath = os.path.join(HERE, "navbat.json"); q = json.load(open(qpath)) if os.path.exists(qpath) else []
have = {x["id"] for x in q}
order = [x for x in itertools.chain.from_iterable(itertools.zip_longest(*[list(s.items()) for s in sets])) if x]
for k, c in order:
    if k in have: continue
    cap = open(os.path.join(work, f"cap-{k}.txt")).read().strip(); kind = c.get("kind", "photo")
    if kind == "photo":
        r = call("sendPhoto", {"chat_id": OWNER, "disable_notification": "true"}, {"photo": os.path.join(work, f"img-{k}.jpg")})
        if not r.get("ok"): print("XATO", k, r.get("description")); continue
        item = {"id": k, "kind": "photo", "photo": r["result"]["photo"][-1]["file_id"]}
    else:
        r = call("sendVideo", {"chat_id": OWNER, "disable_notification": "true", "supports_streaming": "true", "width": "1920", "height": "1080", "duration": str(c["dur"])}, {"video": os.path.join(work, c["video"]), "cover": os.path.join(work, c["cover"])})
        if not r.get("ok"): print("XATO", k, r.get("description")); continue
        item = {"id": k, "kind": "video", "video": r["result"]["video"]["file_id"], "dur": c["dur"]}
        cv = r["result"]["video"].get("cover") or []
        if cv: item["cover"] = cv[-1]["file_id"]
    call("deleteMessage", {"chat_id": OWNER, "message_id": str(r["result"]["message_id"])})
    item.update({"caption": cap, "btn": c["b"][0], "url": "https://kasbegalari.vercel.app" + c["b"][1]})
    q.append(item); have.add(k); json.dump(q, open(qpath, "w"), ensure_ascii=False, indent=0); print("navbat", len(q), k)
