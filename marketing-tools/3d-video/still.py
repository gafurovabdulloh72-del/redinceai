"""Post rasmi: saytning haqiqiy ekrani telefon maketida + sarlavha. python3 still.py posts.json id [id...]"""
import json, sys, subprocess, os, shutil, glob
from PIL import Image
posts = {p["id"]: p for p in json.load(open(sys.argv[1]))}
SRC = {  # id: (yo'l yoki ui:fayl, scroll matni, login, tap)
 "11-11B": ("/xarita?region=samarqand&category=toy-fotograf", "Tozalash", False, None),
 "11-12A": ("/kabinet/profil?tab=mutaxassis", "Tasdiqlangan profil", True, None),
 "11-12B": ("ui:../three3d/ui/11-12B_2.png", None, False, None),
 "11-13A": ("/vakansiyalar?profession=kontent", None, False, None),
 "11-13B": ("ui:../three3d/ui/11-13B_1.png", None, False, None),
 "11-14A": ("/jamoalar/yangi", None, True, None),
 "11-14B": ("/kabinet/mentorlik", None, True, "Ustoz bo'lmoqchimisiz?"),
 "11-15B": ("/kabinet/rezyume", None, True, None),
 "11-16A": ("ui:../three3d/ui/11-16A_2.png", None, False, None),
 "11-16B": ("/xarita?region=buxoro&category=dronograf", None, False, None),
 "11-17A": ("/yonalish/illyustrator", None, False, None),
 "11-17B": ("/savollar", None, False, None),
}
for pid in sys.argv[2:]:
    p = posts[pid]; src = p.get("screenPath") and (p["screenPath"], None, p.get("login", True), None) or SRC[pid]
    d = f"st-{pid}"; shutil.rmtree(d, ignore_errors=True)
    if src[0].startswith("ui:"):
        os.makedirs(d); im0 = Image.open(src[0][3:]).convert("RGB"); im = im0.crop((0, int(im0.height*0.045), im0.width, im0.height)).resize((1080, 2338))
        for i in range(60): im.save(f"{d}/{i:05d}.jpg", quality=92)
        json.dump({"frames": 60, "taps": []}, open(f"{d}/taps.json", "w"))
    else:
        steps = [{"goto": src[0]}]
        if src[3]: steps.append({"tap": {"text": src[3]}})
        if src[1]: steps.append({"scroll": src[1], "off": 200, "dur": 0.1})
        steps.append({"hold": 2})
        f = {"css": "input[type=date]{visibility:hidden}", "steps": steps}
        if src[2]: f["login"] = {"email": "ijodkor.demo2@example.com", "password": "Demo-parol-2026!"}
        json.dump(f, open(f"f-{pid}.json", "w"))
        subprocess.run(["node", "flow.mjs", f"f-{pid}.json", d], check=True)
        tj = json.load(open(f"{d}/taps.json")); tj["taps"] = []; json.dump(tj, open(f"{d}/taps.json", "w"))
    hook = p.get("coverHook") or ""
    w = hook.split(); 
    if w and "*" not in hook: w[-1] = "*" + w[-1] + "*"
    json.dump({"theme": p.get("theme", "light"), "tag": "", "caps": [{"text": " ".join(w), "in": -2, "out": 99}], "endCta": ""}, open(f"sc-{pid}.json", "w"), ensure_ascii=False)
    env = {**os.environ, "ONLY": "1.2"}
    subprocess.run(["node", "comp.mjs", d, f"sc-{pid}.json", f"sv-{pid}.mp4"], check=True, env=env)
    fr = sorted(glob.glob(f"cf-sv-{pid}/*.jpg"))[0]
    Image.open(fr).crop((0, 40, 1080, 1390)).save(f"img-{pid}.jpg", quality=92)
    print(pid, "->", f"img-{pid}.jpg")
