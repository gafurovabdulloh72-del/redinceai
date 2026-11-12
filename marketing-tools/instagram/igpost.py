# python3 igpost.py video.mp4 caption.txt thumb_ms  — Reels: konteyner -> rupload -> status -> publish (token proksi qo'shadi)
import json, os, subprocess, sys, time
IG = "17841422370903132"; V = "v21.0"; G = f"https://graph.facebook.com/{V}"
vid, capf, thumb = sys.argv[1], sys.argv[2], sys.argv[3]
cap = open(capf).read().strip()
def cj(args):
    out = subprocess.run(["curl", "-sS", "-m", "300"] + args, capture_output=True, text=True).stdout
    try: return json.loads(out)
    except Exception: return {"raw": out[:500]}
r = cj(["-X", "POST", f"{G}/{IG}/media", "--data-urlencode", "media_type=REELS", "--data-urlencode", "upload_type=resumable",
        "--data-urlencode", f"caption={cap}", "--data-urlencode", "share_to_feed=true", "--data-urlencode", f"thumb_offset={thumb}"])
print("container", r); cid = r.get("id")
if not cid: sys.exit(1)
size = os.path.getsize(vid)
u = cj(["-X", "POST", f"https://rupload.facebook.com/ig-api-upload/{V}/{cid}", "-H", "offset: 0", "-H", f"file_size: {size}", "--data-binary", f"@{vid}"])
print("upload", u)
for i in range(40):
    s = cj([f"{G}/{cid}?fields=status_code,status"]); print("status", s.get("status_code"), s.get("status", "")[:120])
    if s.get("status_code") in ("FINISHED", "ERROR", "EXPIRED"): break
    time.sleep(6)
if s.get("status_code") != "FINISHED": sys.exit(2)
p = cj(["-X", "POST", f"{G}/{IG}/media_publish", "--data-urlencode", f"creation_id={cid}"]); print("publish", p)
if p.get("id"):
    print("link", cj([f"{G}/{p['id']}?fields=permalink,media_type"]))
