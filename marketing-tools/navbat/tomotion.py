"""Navbatdagi rasm postlarni tayyor motion videoga almashtiradi (matn/tugma o'zgarmaydi).
  python3 tomotion.py <motion_papka>   # m-<id>.mp4 + mc-<id>.jpg bor va hali chiqmagan postlar
Video egasining chatiga jim yuklanadi (file_id uchun) va darhol o'chiriladi."""
import json, os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); T = os.environ["MARKETING_BOT_TOKEN"]; A = f"https://api.telegram.org/bot{T}"; OWNER = "1643026769"
def call(m, d, files={}):
    a = ["curl", "-sS", "-m", "300", "-X", "POST", f"{A}/{m}"]
    for k, v in d.items(): a += ["--form-string", f"{k}={v}"]
    for k, v in files.items(): a += ["-F", f"{k}=@{v}"]
    return json.loads(subprocess.run(a, capture_output=True, text=True).stdout)
M = sys.argv[1]; qp = os.path.join(HERE, "navbat.json"); pp = os.path.join(HERE, "posted.json"); n = 0
for x in json.load(open(qp)):
    posted = json.load(open(pp)) if os.path.exists(pp) else {}
    v, c = os.path.join(M, f"m-{x['id']}.mp4"), os.path.join(M, f"mc-{x['id']}.jpg")
    if x["kind"] != "photo" or x["id"] in posted or not os.path.exists(v): continue
    r = call("sendVideo", {"chat_id": OWNER, "disable_notification": "true", "supports_streaming": "true", "width": "1080", "height": "1350", "duration": "7"}, {"video": v, "cover": c})
    if not r.get("ok"): print("XATO", x["id"], r.get("description")); continue
    call("deleteMessage", {"chat_id": OWNER, "message_id": str(r["result"]["message_id"])})
    vid = r["result"]["video"]; cv = (vid.get("cover") or [{}])[-1].get("file_id")
    q = json.load(open(qp))  # qayta o'qib, faqat shu yozuvni yangilaymiz
    for y in q:
        if y["id"] == x["id"]:
            y.update({"kind": "video", "video": vid["file_id"], "dur": 7, "w": 1080, "h": 1350}); y.pop("photo", None)
            if cv: y["cover"] = cv
    json.dump(q, open(qp, "w"), ensure_ascii=False, indent=0); n += 1; print("motion", x["id"])
print("almashtirildi:", n)
