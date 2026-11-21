# python3 vo.py cfg.json  — «Kim kerak?» uchun Gemini TTS ovoz jumlalari (kesh: vo/<kalit>.wav), cfg'ga davomiyliklar yoziladi.
# Kalit proksida (x-goog-api-key). Model: gemini-3.8-flash-tts, ovoz: Puck (seriyaning doimiy ovozi).
import base64, hashlib, json, pathlib, subprocess, sys, time, wave
import numpy as np
H = pathlib.Path(__file__).parent; VO = H / "vo"; VO.mkdir(exist_ok=True)
import os
MODEL, VOICE = os.environ.get("TTS_MODEL", "gemini-3.8-flash-tts"), "Puck"
STYLE = ""  # inglizcha ko'rsatma qisqa jumlalarda ovoz chiqarib o'qilardi
SR = 24000

def tts(text):
    key = hashlib.sha1(f"{MODEL}|{VOICE}|{STYLE}|{text}".encode()).hexdigest()[:12]
    out = VO / f"{key}.wav"
    if out.exists(): return out
    body = {"contents": [{"parts": [{"text": STYLE + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    for attempt in range(2):
        r = subprocess.run(["curl", "-sS", "-m", "120", "-H", "x-goog-api-key: proxy-dummy", "-H", "Content-Type: application/json",
                            "-X", "POST", f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                            "-d", json.dumps(body)], capture_output=True, text=True).stdout
        try:
            p = json.loads(r)["candidates"][0]["content"]["parts"][0]["inlineData"]; break
        except Exception:
            print("  qayta:", r[:160].replace("\n", " ")); time.sleep(8 * (attempt + 1))
    else:
        sys.exit(f"TTS xato: {text}")
    raw = base64.b64decode(p["data"])
    if "wav" in p["mimeType"]:
        tmp = VO / "tmp.wav"; tmp.write_bytes(raw); w = wave.open(str(tmp)); pcm = w.readframes(w.getnframes()); w.close(); tmp.unlink()
    else:
        pcm = raw
    x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    # boshi/oxiridagi sukutni kesish (20 ms freymlar, 30 ms zaxira)
    fr = x[:len(x) // 480 * 480].reshape(-1, 480); e = np.sqrt((fr ** 2).mean(1)); idx = np.where(e > 0.012)[0]
    if len(idx): x = x[max(0, idx[0] * 480 - 720): min(len(x), (idx[-1] + 1) * 480 + 1440)]
    w = wave.open(str(out), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    print("  +", text, "->", out.name)
    return out

def dur(p):
    w = wave.open(str(p)); return w.getnframes() / w.getframerate()

def split_take(f, texts):
    """Bitta yozuvni jumlalarga bo'lish: sukut nomzodlaridan kutilgan uzunlikka (harflar soni) eng mos chegaralar (DP)."""
    n = len(texts)
    w = wave.open(str(f)); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; w.close()
    fr = x[:len(x) // 480 * 480].reshape(-1, 480); e = np.sqrt((fr ** 2).mean(1)); v = e > 0.012
    idx = np.where(v)[0]; s0, s1 = idx[0], idx[-1] + 1
    gaps = []; i = s0
    while i < s1:
        if not v[i]:
            j = i
            while j < s1 and not v[j]: j += 1
            if j - i >= 8: gaps.append(((i + j) // 2, j - i))   # >=160 ms
            i = j
        else: i += 1
    L = [len(t) + 6 for t in texts]; rate = (s1 - s0) / sum(L)       # freym/harf (+6: jumla oxiri pauza)
    cand = [s0] + [g[0] for g in gaps] + [s1]; gl = [0] + [g[1] for g in gaps] + [0]
    INF = 1e18; m = len(cand)
    D = [[INF] * m for _ in range(n + 1)]; P = [[-1] * m for _ in range(n + 1)]; D[0][0] = 0
    for k in range(1, n + 1):
        for j in range(1, m):
            for i2 in range(j):
                if D[k - 1][i2] >= INF: continue
                exp = L[k - 1] * rate; got = cand[j] - cand[i2]
                cost = D[k - 1][i2] + ((got - exp) / exp) ** 2 - (0.004 * gl[j] if j < m - 1 else 0)
                if cost < D[k][j]: D[k][j] = cost; P[k][j] = i2
    bnd = [m - 1]
    for k in range(n, 0, -1): bnd.append(P[k][bnd[-1]])
    bnd = [cand[j] for j in reversed(bnd)]
    outs = []
    for k in range(n):
        seg = x[bnd[k] * 480: bnd[k + 1] * 480]
        fr2 = seg[:len(seg) // 480 * 480].reshape(-1, 480); e2 = np.sqrt((fr2 ** 2).mean(1)); ii = np.where(e2 > 0.012)[0]
        outs.append(seg[max(0, ii[0] * 480 - 720): min(len(seg), (ii[-1] + 1) * 480 + 1440)])
    return outs, [round((bnd[k + 1] - bnd[k]) * .02, 2) for k in range(n)]

if __name__ == "__main__":
    cp = pathlib.Path(sys.argv[1]); c = json.loads(cp.read_text()); v = c["voice"]
    keys = ["hook", "kim"] + [f"i{i}" for i in range(len(c["items"]))] + ["done", "end"]
    texts = [v["hook"], "Kim kerak?"] + [it.get("say", it["name"]) + "." for it in c["items"]] + [v["done"], v["end"]]
    take = tts("\n\n".join(texts))
    segs, gaps = split_take(take, texts)
    print("  bo'laklar (s):", gaps)
    vo = {}
    for k, seg in zip(keys, segs):
        f = VO / f"{c['topic']}-{k}.wav"
        w = wave.open(str(f), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
        vo[k] = {"file": f.name, "dur": round(len(seg) / SR, 3)}
    c["vo"] = vo; cp.write_text(json.dumps(c, ensure_ascii=False, indent=1))
    print("OK", cp.name, {k: x["dur"] for k, x in vo.items()})
