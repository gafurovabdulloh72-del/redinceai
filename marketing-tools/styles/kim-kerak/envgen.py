# python3 envgen.py cfg.json...  — har ovoz bo'lagi uchun og'iz harakati konverti (50 fps, 0..1) cfg.vo[k].env ga yoziladi.
import json, sys, wave, numpy as np, pathlib
H = pathlib.Path(__file__).parent
for p in sys.argv[1:]:
    c = json.loads(pathlib.Path(p).read_text())
    for k, v in c.get("vo", {}).items():
        w = wave.open(str(H / "vo" / v["file"])); sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; w.close()
        hop = sr // 50; fr = x[:len(x) // hop * hop].reshape(-1, hop); e = np.sqrt((fr ** 2).mean(1))
        e = np.clip((e - 0.015) / 0.12, 0, 1) ** 0.7
        v["env"] = [round(float(a), 2) for a in e]
    pathlib.Path(p).write_text(json.dumps(c, ensure_ascii=False, indent=1)); print("env", p)
