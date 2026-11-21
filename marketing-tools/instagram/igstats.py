# python3 igstats.py [N]  — oxirgi N ta Reels: ko'rish, qamrov, like, izoh, saqlash, ulashish. stats.json ga kunlik tarix yoziladi.
import json, subprocess, sys, datetime, pathlib
IG = "17841422370903132"; G = "https://graph.facebook.com/v21.0"; H = pathlib.Path(__file__).parent
def cj(url):
    out = subprocess.run(["curl", "-sS", "-m", "60", url], capture_output=True, text=True).stdout
    try: return json.loads(out)
    except Exception: return {"raw": out[:300]}
n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
media = cj(f"{G}/{IG}/media?fields=id,caption,timestamp,media_type,permalink,like_count,comments_count&limit={n}")
if "data" not in media: sys.exit(f"XATO: {media}")
rows = []
for m in media["data"]:
    ins = cj(f"{G}/{m['id']}/insights?metric=views,reach,saved,shares")
    v = {d["name"]: d["values"][0]["value"] for d in ins.get("data", [])}
    rows.append({"id": m["id"], "ts": m["timestamp"][:16], "cap": (m.get("caption") or "").split("\n")[0][:50],
                 "views": v.get("views"), "reach": v.get("reach"), "likes": m.get("like_count"), "comments": m.get("comments_count"),
                 "saved": v.get("saved"), "shares": v.get("shares"), "url": m.get("permalink")})
today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5))).strftime("%Y-%m-%d")
p = H / "stats.json"; hist = json.loads(p.read_text()) if p.exists() else {}
hist[today] = {r["id"]: {k: r[k] for k in ("views", "reach", "likes", "comments", "saved", "shares")} for r in rows}
p.write_text(json.dumps(hist, ensure_ascii=False, indent=1))
print(f"{'sana':16} {'ko`r':>6} {'qamrov':>6} {'like':>4} {'izoh':>4} {'saql':>4} {'ulash':>5}  caption")
for r in rows:
    f = lambda x: "-" if x is None else str(x)
    print(f"{r['ts']:16} {f(r['views']):>6} {f(r['reach']):>6} {f(r['likes']):>4} {f(r['comments']):>4} {f(r['saved']):>4} {f(r['shares']):>5}  {r['cap']}")
