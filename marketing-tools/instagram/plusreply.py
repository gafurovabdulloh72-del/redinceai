# python3 plusreply.py [--dry]
# @kasb.egalari postlaridagi "+" izohlariga bir martalik javob yozadi.
# Token proksi orqali qo'shiladi (graph.facebook.com tarmoq siri) — kodda token YO'Q.
import json, os, re, subprocess, sys, time

IG = "17841422370903132"; ME = "kasb.egalari"; G = "https://graph.facebook.com/v21.0"
HERE = os.path.dirname(os.path.abspath(__file__)); STATE = os.path.join(HERE, "replied.json")
DRY = "--dry" in sys.argv
REPLIES = [
    "Rahmat! Ro'yxatdan o'tish havolasi profilda: kasbegalari.vercel.app",
    "Qiziqishingiz uchun rahmat! Sayt havolasi profilda, Telegram botimiz: kasb_egalari_bot",
    "Rahmat! Kasbingizni tanlab, profilingizni to'ldiring: kasbegalari.vercel.app (havola profilda ham bor)",
]

def get(url):
    out = subprocess.run(["curl", "-sS", "-m", "60", url], capture_output=True, text=True).stdout
    try: return json.loads(out)
    except Exception: return {"error": out[:300]}

def post(url, data):
    a = ["curl", "-sS", "-m", "60", "-X", "POST", url]
    for k, v in data.items(): a += ["--data-urlencode", f"{k}={v}"]
    out = subprocess.run(a, capture_output=True, text=True).stdout
    try: return json.loads(out)
    except Exception: return {"error": out[:300]}

def is_plus(text):
    t = (text or "").strip()
    return "+" in t and len(t) <= 15

state = json.load(open(STATE)) if os.path.exists(STATE) else {"replied": [], "n": 0}
done = set(state["replied"])
media = get(f"{G}/{IG}/media?fields=id,permalink&limit=50").get("data", [])
found = sent = 0
for m in media:
    url = f"{G}/{m['id']}/comments?fields=id,text,username,timestamp,replies{{username}}&limit=50"
    while url:
        r = get(url)
        for c in r.get("data", []):
            if c["id"] in done or c.get("username") == ME or not is_plus(c.get("text")):
                continue
            mine = [x for x in c.get("replies", {}).get("data", []) if x.get("username") == ME]
            if mine:
                done.add(c["id"]); continue
            found += 1
            msg = REPLIES[state["n"] % len(REPLIES)]
            if DRY:
                print("DRY", m["permalink"], c.get("username"), repr(c.get("text")), "->", msg)
                continue
            res = post(f"{G}/{c['id']}/replies", {"message": msg})
            if res.get("id"):
                done.add(c["id"]); state["n"] += 1; sent += 1
                print("OK", m["permalink"], c.get("username"), "->", msg)
                time.sleep(4)
            else:
                print("XATO", c["id"], json.dumps(res)[:300])
        url = r.get("paging", {}).get("next")
state["replied"] = sorted(done)
if not DRY:
    json.dump(state, open(STATE, "w"), indent=0)
print(f"postlar={len(media)} topildi={found} yuborildi={sent}")
