# python3 postnext.py — navbatdagi keyingi «Kim kerak?» videosini Instagram'ga joylaydi (kuniga 1 ta).
import json, subprocess, sys, pathlib, datetime
H = pathlib.Path(__file__).parent; Q = H / "queue.json"
q = json.loads(Q.read_text())
left = [k for k in q["queue"] if k not in q["posted"]]
if not left: print("NAVBAT BO'SH"); sys.exit(0)
k = left[0]
r = subprocess.run(["python3", str(H.parent.parent / "instagram/igpost.py"), str(H / f"out/{k}.mp4"), str(H / f"caps/{k}.txt"), "8200"],
                   capture_output=True, text=True, timeout=900)
out = r.stdout + r.stderr
pub = [l for l in out.splitlines() if l.startswith("publish")]
print("\n".join(pub) or out[-600:])
if pub and '"id"' in pub[-1]:
    q["posted"][k] = {"at": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5))).isoformat(timespec="minutes"), "res": pub[-1][:200]}
    Q.write_text(json.dumps(q, ensure_ascii=False, indent=1)); print("OK", k, "qoldi:", len(left) - 1)
else: print("XATO", k); sys.exit(1)
