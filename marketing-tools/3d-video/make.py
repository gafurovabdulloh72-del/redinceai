"""Post -> 3D video quvuri (scene3 + ui.mjs + sfx2).
  python3 make.py tex                         # buyum ekranlari uchun teksturalar (PIL)
  python3 make.py cfg  week.json <id>         # cfg-<id>.json, ev-<id>.json, ui-<id>.json
  python3 make.py ui   <id>                   # ui/<id>_<k>.png
  python3 make.py test <id> [t1,t2,...]       # tez kadrlar (ONLY) -> test-<id>/
  python3 make.py render <id>                 # to'liq render (~20 daq)
  python3 make.py finish <id>                 # ovoz + mux + muqova -> final-<id>.mp4, cover-<id>.jpg
"""
import os, sys, json, subprocess, shutil, glob
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
REG = {r["slug"]: r for r in json.load(open("regions.json"))}
TOP = 0.78  # stol usti

def pin_world(p, s, slug):
    r = REG[slug]
    return [p[0] + s * (r["cx"] - 500) / 1000, p[1] + s * 0.06, p[2] + s * (r["cy"] - 331) / 1000]

def add(a, b): return [round(x + y, 4) for x, y in zip(a, b)]

# ---------------- kamera shablonlari
def shots_std(H, Ph, side=1, s1=None, s3=None, s4=None, fov1=28):
    """4 kadr: qahramon -> telefon yaqin -> keng dolly -> yakuniy yaqin. side=-1 — ko'zgu."""
    S = side
    return [
        s1 or {"s": 0, "e": 3.4, "from": add(H, [0.5 * S, 0.27, 0.62]), "to": add(H, [0.37 * S, 0.21, 0.47]), "lf": add(H, [0, 0.02, 0]), "lt": add(H, [0.01 * S, 0.02, 0]), "fov": fov1},
        {"s": 3.4, "e": 6.8, "from": add(Ph, [0.27 * S, 0.1, 0.5]), "to": add(Ph, [0.17 * S, 0.06, 0.38]), "lf": Ph, "lt": Ph, "fov": 26},
        s3 or {"s": 6.8, "e": 10.2, "from": [-0.78 * S, 1.26, 1.18], "to": [0.42 * S, 1.2, 1.25], "lf": [0, 0.86, -0.1], "lt": [0, 0.86, -0.1], "fov": 30},
        s4 or {"s": 10.2, "e": 12.75, "from": add(Ph, [0.25 * S, 0.08, 0.66]), "to": add(Ph, [0.12 * S, 0.06, 0.52]), "lf": Ph, "lt": Ph, "fov": 24},
    ]

def phone(side=1, p=None, frames=None, r=None):
    p = p or [0.34 * side, 0.93, 0.1]
    return {"type": "phone", "p": p, "r": r or [-0.15, -0.45 * side, 0], "float": True, "frames": frames or []}

# ---------------- sahna retseptlari (11-11 .. 11-17)
def R_map(slug, side, extra, cam):
    T = [0, 0, -0.05]
    mp, ms = [-0.12 * side, TOP, -0.12], 0.85
    pin = pin_world(mp, ms, slug)
    ph = [0.4 * side, 0.93, 0.18]
    s1 = {"s": 0, "e": 3.4, "from": add(pin, [0.06 * side, 1.12, 0.82]), "to": add(pin, [0.03 * side, 0.9, 0.64]), "lf": add(pin, [0, 0, -0.16]), "lt": add(pin, [0, 0, -0.13]), "fov": 30}
    s3 = {"s": 6.8, "e": 10.2, "from": [-0.7 * side, 1.62, 0.95], "to": [0.45 * side, 1.55, 1.0], "lf": [mp[0], TOP, -0.1], "lt": [mp[0] + 0.05 * side, TOP, -0.1], "fov": 30}
    s4 = {"s": 10.2, "e": 12.75, "from": add(pin, [0.32 * side, 0.12, 0.34]), "to": add(pin, [0.22 * side, 0.09, 0.25]), "lf": pin, "lt": pin, "fov": 24}
    props = [{"type": "table", "p": T, "w": 1.6, "d": 1.0, "top": "#2a2c31"}, {"type": "map", "p": mp, "s": ms, "region": slug, "pinAt": 1.0}] + extra(pin, side)
    return {"props": props, "ph": ph, "shots": shots_std(pin, ph, side, s1=s1, s3=s3, s4=s4), "keyTarget": pin}

RECIPES = {
    "11-11B": dict(env="E5", ui="map", build=lambda: R_map("samarqand", 1, lambda pin, S: [
        {"type": "mirrorless", "p": [0.5 * S, TOP + 0.0425, -0.3], "r": [0, -0.7 * S, 0]}], None)),
    "11-16B": dict(env="E5", ui="map", build=lambda: R_map("buxoro", -1, lambda pin, S: [
        {"type": "drone", "p": [0.5 * S, TOP + 0.05, -0.32], "r": [0, 0.5, 0], "s": 0.6}], None)),
    "11-12A": dict(env="E3", ui="checklist", build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "tablet", "p": [-0.1, TOP, -0.06], "r": [0, 0.28, 0], "screen": "/tex/poster.png"},
               {"type": "notebook", "p": [-0.48, TOP, 0.05], "r": [0, -0.35, 0]}],
        ph=[0.34, 0.93, 0.1], H=[-0.1, TOP + 0.02, -0.06])),
    "11-12B": dict(env="E2", ui="chat", build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "monitor", "p": [0, TOP, -0.35], "r": [0, 0, 0], "screen": "/tex/timeline.png"},
               {"type": "jog", "p": [0.05, TOP, 0.02], "r": [0, -0.2, 0]},
               {"type": "headphones", "p": [-0.38, 0.81, -0.05], "r": [0.25, 0.6, 0]},
               {"type": "keyboard", "p": [-0.05, TOP, 0.25], "r": [0, 0.05, 0]}],
        ph=[0.36, 0.93, 0.08], H=[0.05, 0.82, 0.0])),
    "11-13A": dict(env="E6", ui="list", side=-1, build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "notebook", "p": [0.1, TOP, -0.04], "r": [0, -0.32, 0]},
               {"type": "notebook", "p": [0.42, TOP, -0.22], "r": [0, 0.5, 0]}],
        ph=[-0.34, 0.93, 0.1], H=[0.1, TOP + 0.02, -0.04])),
    "11-13B": dict(env="E3", ui="reels", build=lambda: dict(
        props=[{"type": "cinemaCamera", "p": [-0.3, 0, -0.25], "r": [0, 0.55, 0]},
               {"type": "plinth", "p": [-0.62, 0, 0.12], "w": 0.34, "h": 1.12, "d": 0.34},
               {"type": "phone", "p": [-0.62, 1.24, 0.12], "r": [-0.2, 0.35, 0], "float": True, "frames": []}],
        ph=[-0.62, 1.24, 0.12], H=[-0.3, 1.32, -0.25],
        shots=[{"s": 0, "e": 3.4, "from": [0.78, 1.53, 1.1], "to": [0.62, 1.5, 0.92], "lf": [-0.26, 1.28, -0.2], "lt": [-0.27, 1.28, -0.19], "fov": 28},
               {"s": 3.4, "e": 6.8, "from": [-0.4, 1.33, 0.6], "to": [-0.46, 1.3, 0.5], "lf": [-0.62, 1.24, 0.12], "lt": [-0.62, 1.24, 0.12], "fov": 26},
               {"s": 6.8, "e": 10.2, "from": [1.15, 1.5, 1.7], "to": [-0.55, 1.45, 1.85], "lf": [-0.38, 1.15, -0.05], "lt": [-0.38, 1.15, -0.05], "fov": 32},
               {"s": 10.2, "e": 12.75, "from": [-0.36, 1.32, 0.85], "to": [-0.46, 1.3, 0.68], "lf": [-0.62, 1.24, 0.12], "lt": [-0.62, 1.24, 0.12], "fov": 24}],
        keyTarget=[-0.35, 1.2, -0.1])),
    "11-14A": dict(env="E6", ui="topics", build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "clay", "p": [-0.12, TOP, -0.12], "color": "#c9b7a6"}],
        ph=[0.34, 0.93, 0.1], H=[-0.12, TOP + 0.17, -0.12])),
    "11-14B": dict(env="E1", ui="form", side=-1, build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "curve", "p": [0.06, 1.0, -0.3], "r": [0, -0.15, 1.1], "s": 0.5, "drawAt": 0.25},
               {"type": "tablet", "p": [0.1, TOP, 0.02], "r": [0, -0.2, 0], "screen": "/tex/keys.png"}],
        ph=[-0.34, 0.93, 0.1], H=[-0.03, 1.11, -0.3],
        s1={"s": 0, "e": 3.4, "from": [-0.36, 1.2, 1.02], "to": [-0.27, 1.18, 0.87], "lf": [-0.03, 1.18, -0.3], "lt": [-0.04, 1.17, -0.3], "fov": 32})),
    "11-15B": dict(env="E2", ui="resume", build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "mic", "p": [-0.34, 0, -0.18], "r": [0, 0.5, 0]},
               {"type": "headphones", "p": [0.02, 0.81, -0.12], "r": [0.25, -0.4, 0]}],
        ph=[0.36, 0.93, 0.1], H=[-0.34, 1.0, -0.18])),
    "11-16A": dict(env="E1", ui="stats", side=-1, build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "ringLight", "p": [0.42, 0, -0.42], "r": [0, -0.4, 0]},
               {"type": "mirrorless", "p": [0.12, TOP + 0.0425, -0.08], "r": [0, -0.5, 0]}],
        ph=[-0.3, 0.95, 0.08], H=[0.25, 1.05, -0.3],
        s1={"s": 0, "e": 3.4, "from": [-0.16, 1.06, 1.06], "to": [-0.08, 1.06, 0.9], "lf": [0.4, 1.19, -0.42], "lt": [0.41, 1.2, -0.42], "fov": 30})),
    "11-17A": dict(env="E6", ui="card", build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "tablet", "p": [-0.1, TOP, -0.06], "r": [0, 0.22, 0], "screen": "/tex/illu.png"},
               {"type": "notebook", "p": [-0.5, TOP, 0.04], "r": [0, -0.25, 0]}],
        ph=[0.34, 0.93, 0.1], H=[-0.1, TOP + 0.02, -0.06])),
    "11-17B": dict(env="E1", ui="qa", side=-1, build=lambda: dict(
        props=[{"type": "table", "p": [0, 0, -0.05], "w": 1.5, "d": 0.9},
               {"type": "keyboard", "p": [0.08, TOP, 0.0], "r": [0, -0.12, 0]}],
        ph=[-0.34, 0.93, 0.1], H=[0.08, TOP + 0.03, -0.08])),
}

STATE_T = {2: [0, 4.4], 3: [0, 4.4, 8.4], 4: [0, 4.4, 8.4, 10.8]}

def hook_text(h):
    w = h.split()
    if not w: return h
    if any("*" in x for x in w): return h
    w[-1] = "*" + w[-1].rstrip(".,!?") + "*" + (w[-1][-1] if w[-1][-1] in ".,!?" else "")
    return " ".join(w)

TABLE_TOP = {"E3": "#b49b7d", "E6": "#2a2c31"}

def build_cfg(post, rid, ui_states):
    rc = RECIPES[rid]; b = rc["build"](); side = rc.get("side", 1)
    for p in b["props"]:
        if p["type"] == "table" and "top" not in p and rc["env"] in TABLE_TOP: p["top"] = TABLE_TOP[rc["env"]]
    frames = [{"t": t, "src": f"/ui/{rid}_{k}.png"} for k, t in enumerate(STATE_T[ui_states])]
    props = list(b["props"])
    has_phone = any(p["type"] == "phone" for p in props)
    if has_phone:
        for p in props:
            if p["type"] == "phone": p["frames"] = frames
    else:
        props.append(phone(side, b["ph"], frames))
    shots = b.get("shots") or shots_std(b["H"], b["ph"], side, s1=b.get("s1"))
    caps = [{"text": hook_text(post["coverHook"]), "in": -0.6, "out": 3.2},
            {"text": post["caption2"], "in": 3.7, "out": 6.5},
            {"text": post["caption3"], "in": 7.1, "out": 9.9},
            {"text": post["caption4"], "in": 10.4, "out": 12.5}]
    cfg = {"env": rc["env"], "dur": 16, "seed": sum(map(ord, rid)) % 17 + 1, "keyTarget": b.get("keyTarget", b.get("H", [0, 0.85, 0])),
           "props": props, "shots": shots, "caps": caps, "endCta": post["endCta"]}
    ev = {"dur": 16, "cuts": [3.4, 6.8, 10.2], "caps_in": [3.7, 7.1, 10.4], "words_in": [], "ui": STATE_T[ui_states][1:]}
    return cfg, ev

# ---------------- teksturalar
def tex():
    os.makedirs("tex", exist_ok=True)
    INK, CREAM, CORAL = (26, 26, 28), (246, 244, 238), (255, 90, 54)
    # dizayner plakati (planshet, yotiq)
    im = Image.new("RGB", (1600, 1112), CREAM); d = ImageDraw.Draw(im)
    d.ellipse([820, 180, 1420, 780], fill=CORAL)
    d.rectangle([160, 200, 700, 250], fill=INK); d.rectangle([160, 290, 560, 340], fill=INK)
    d.rectangle([160, 420, 640, 436], fill=(190, 184, 172)); d.rectangle([160, 460, 600, 476], fill=(190, 184, 172)); d.rectangle([160, 500, 520, 516], fill=(190, 184, 172))
    d.rectangle([160, 860, 1440, 866], fill=INK); d.rectangle([160, 900, 420, 930], fill=INK)
    d.rectangle([0, 0, 1599, 1111], outline=(220, 214, 202), width=6)
    im.save("tex/poster.png")
    # montaj taymlayni (monitor)
    im = Image.new("RGB", (1600, 900), (20, 22, 27)); d = ImageDraw.Draw(im)
    d.rectangle([40, 40, 1000, 560], fill=(36, 39, 46)); d.rectangle([1040, 40, 1560, 560], fill=(30, 33, 39))
    for i in range(6): d.rectangle([1070, 80 + i * 76, 1530, 130 + i * 76], fill=(44, 48, 56))
    d.rectangle([40, 600, 1560, 860], fill=(26, 28, 34))
    import random; random.seed(4)
    for row, col in enumerate([(84, 92, 110), (70, 78, 96), (120, 92, 70), (60, 66, 80)]):
        x = 60
        while x < 1540:
            w = random.randint(90, 300); d.rounded_rectangle([x, 620 + row * 58, min(x + w, 1540), 664 + row * 58], 6, fill=col); x += w + random.randint(6, 24)
    d.rectangle([860, 590, 866, 870], fill=CORAL); d.polygon([(848, 590), (878, 590), (863, 608)], fill=CORAL)
    im.save("tex/timeline.png")
    # motion kalit kadrlari (planshet)
    im = Image.new("RGB", (1600, 1112), (22, 24, 29)); d = ImageDraw.Draw(im)
    for i in range(9): d.line([(120, 160 + i * 100), (1480, 160 + i * 100)], fill=(38, 41, 48), width=2)
    pts = [(120 + i * 8, 900 - 700 * (1 - (1 - i / 170) ** 3)) for i in range(171)]
    d.line(pts, fill=CORAL, width=10)
    for x, y in [(120, 900), (1480, 200)]: d.rectangle([x - 18, y - 18, x + 18, y + 18], fill=CREAM)
    im.save("tex/keys.png")
    # illyustratsiya (chiziqli)
    im = Image.new("RGB", (1600, 1112), (250, 248, 243)); d = ImageDraw.Draw(im)
    d.ellipse([560, 220, 1040, 700], outline=INK, width=10); d.arc([640, 360, 960, 640], 20, 160, fill=INK, width=10)
    d.ellipse([690, 380, 730, 420], fill=INK); d.ellipse([870, 380, 910, 420], fill=INK)
    d.ellipse([1080, 160, 1260, 340], fill=CORAL)
    d.line([(300, 900), (700, 760), (1000, 860), (1320, 740)], fill=INK, width=8)
    im.save("tex/illu.png")
    print("tex ok")

def run(cmd, **kw):
    print("$", " ".join(cmd)); return subprocess.run(cmd, check=True, **kw)

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "tex": tex()
    elif cmd == "cfg":
        week = json.load(open(sys.argv[2])); posts = {p["id"]: p for p in week["posts"]}
        ids = [sys.argv[3]] if len(sys.argv) > 3 else [i for i in RECIPES if i in posts]
        uispec = json.load(open("ui-specs.json"))
        for rid in ids:
            spec = uispec[rid]
            cfg, ev = build_cfg(posts[rid], rid, spec["states"])
            json.dump(cfg, open(f"cfg-{rid}.json", "w"), ensure_ascii=False)
            json.dump(ev, open(f"ev-{rid}.json", "w"))
            json.dump([{**spec, "name": rid}], open(f"ui-{rid}.json", "w"), ensure_ascii=False)
            print(rid, "cfg ok")
    elif cmd == "ui":
        rid = sys.argv[2]; os.makedirs("ui", exist_ok=True); run(["node", "ui.mjs", f"ui-{rid}.json", "ui"])
    elif cmd == "test":
        rid = sys.argv[2]; times = sys.argv[3] if len(sys.argv) > 3 else "0,2,4.6,6,8.5,11,14.5"
        run(["node", "render3.mjs", f"cfg-{rid}.json", f"test-{rid}.mp4", "540", "960", "30"], env={**os.environ, "ONLY": times})
    elif cmd == "render":
        rid = sys.argv[2]; run(["node", "render3.mjs", f"cfg-{rid}.json", f"v-{rid}.mp4", "1080", "1920", "30"])
    elif cmd == "finish":
        rid = sys.argv[2]
        run(["python3", "sfx2.py", f"a-{rid}.wav", f"ev-{rid}.json", str(sum(map(ord, rid)) % 97)])
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"v-{rid}.mp4", "-i", f"a-{rid}.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", f"final-{rid}.mp4"])
        first = sorted(glob.glob(f"fr3-v-{rid}/*.jpg"))[0]
        Image.open(first).convert("RGB").save(f"cover-{rid}.jpg", quality=90)
        print(rid, "final ok")
