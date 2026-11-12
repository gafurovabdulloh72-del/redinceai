"""Navbatdagi postlarni jadval bo'yicha kanalga chiqaradi (jim). Soatlik ishga tushiriladi.
Jadval: JADVAL oynalari bo'yicha chiziqli maqsad; hozirgacha chiqishi kerak bo'lganidan kam bo'lsa, farqini chiqaradi (bir urinishda ko'pi bilan MAX_RUN)."""
import json, os, subprocess, time
from datetime import datetime, timezone, timedelta
HERE = os.path.dirname(os.path.abspath(__file__)); T = os.environ["MARKETING_BOT_TOKEN"]; CH = os.environ["MARKETING_CHANNEL"]; A = f"https://api.telegram.org/bot{T}"
TZ = timezone(timedelta(hours=5)); MAX_RUN = 8
JADVAL = [("2026-11-12 09:30", "2026-11-12 23:00", 48), ("2026-11-13 08:00", "2026-11-13 23:00", 67), ("2026-11-14 08:00", "2026-11-14 23:00", 67)]
def ts(s): return datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=TZ)
def target(now):
    t = 0
    for a, b, n in JADVAL:
        a, b = ts(a), ts(b)
        if now >= b: t += n
        elif now > a: t += int(n * (now - a).total_seconds() / (b - a).total_seconds()) + 1
    return t
def call(m, d):
    a = ["curl", "-sS", "-m", "120", "-X", "POST", f"{A}/{m}"]
    for k, v in d.items(): a += ["--form-string", f"{k}={v}"]
    return json.loads(subprocess.run(a, capture_output=True, text=True).stdout)
q = json.load(open(os.path.join(HERE, "navbat.json"))); pp = os.path.join(HERE, "posted.json")
posted = json.load(open(pp)) if os.path.exists(pp) else {}
now = datetime.now(TZ); need = min(MAX_RUN, target(now) - len(posted)); left = [x for x in q if x["id"] not in posted]
print(f"{now:%H:%M} maqsad={target(now)} chiqqan={len(posted)} navbatda={len(left)} hozir={max(0, need)}")
for x in left[:max(0, need)]:
    kb = json.dumps({"inline_keyboard": [[{"text": "📝 Ro'yxatdan o'tish", "url": "https://t.me/kasb_egalari_bot?start=reg"}], [{"text": x["btn"], "url": x["url"]}]]}, ensure_ascii=False)
    d = {"chat_id": CH, "caption": x["caption"], "parse_mode": "HTML", "reply_markup": kb, "disable_notification": "true"}
    if x["kind"] == "photo": d["photo"] = x["photo"]; r = call("sendPhoto", d)
    else:
        d.update({"video": x["video"], "supports_streaming": "true", "duration": str(x["dur"]), "width": "1920", "height": "1080"})
        if x.get("cover"): d["cover"] = x["cover"]
        r = call("sendVideo", d)
    if r.get("ok"): posted[x["id"]] = r["result"]["message_id"]; json.dump(posted, open(pp, "w"), indent=0); print("ok", x["id"], posted[x["id"]])
    else: print("XATO", x["id"], r.get("description")); break
    time.sleep(20)
