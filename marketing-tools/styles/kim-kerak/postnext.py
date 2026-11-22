# python3 postnext.py [--now]  — navbatdagi keyingi videoni Instagram'ga va Telegram kanalga joylaydi (kuniga 1 ta).
# Himoya: oxirgi joylashdan 18 soat o'tmagan bo'lsa (--now'siz) hech narsa qilmaydi. Har platforma alohida belgilanadi, takror post bo'lmaydi.
import json, subprocess, sys, pathlib, datetime
H = pathlib.Path(__file__).parent; Q = H / "queue.json"; TZ = datetime.timezone(datetime.timedelta(hours=5))
q = json.loads(Q.read_text()); q.setdefault("tg", {})
now = datetime.datetime.now(TZ)
def save(): Q.write_text(json.dumps(q, ensure_ascii=False, indent=1))
# avval: IG chiqqan-u, TG chiqmagan bo'lsa — TG ni to'ldirish
pend_tg = [k for k in q["queue"] if k in q["posted"] and k not in q["tg"]]
left = [k for k in q["queue"] if k not in q["posted"]]
last = max([datetime.datetime.fromisoformat(v["at"]) for v in q["posted"].values()], default=None)
if not pend_tg:
    if not left: print("NAVBAT BO'SH"); sys.exit(0)
    if last and (now - last).total_seconds() < 18 * 3600 and "--now" not in sys.argv:
        print(f"KUTISH: oxirgi post {last:%d.%m %H:%M}, 18 soat o'tmagan"); sys.exit(0)
    k = left[0]
    r = subprocess.run(["python3", str(H.parent.parent / "instagram/igpost.py"), str(H / f"video/{k}.mp4"), str(H / f"caps/{k}.txt"),
                        str(json.loads((H / f"{k}.json").read_text()).get("thumb_ms", 8200))], capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr; pub = [l for l in out.splitlines() if l.startswith("publish")]
    print("\n".join(pub) or out[-600:])
    if not (pub and "'id'" in pub[-1]): print("XATO IG", k); sys.exit(1)
    q["posted"][k] = {"at": now.isoformat(timespec="minutes"), "res": pub[-1][:200]}; save(); print("OK IG", k, "qoldi:", len(left) - 1)
    pend_tg = [k]
for k in pend_tg:
    r = subprocess.run(["python3", str(H / "tgpost.py"), k], capture_output=True, text=True, timeout=400)
    line = (r.stdout + r.stderr).strip().splitlines()[-1:] or ["?"]; print(line[0])
    if line[0].startswith("TGOK"): q["tg"][k] = int(line[0].split()[1]); save(); print("OK TG", k)
    else: print("XATO TG", k); sys.exit(1)
