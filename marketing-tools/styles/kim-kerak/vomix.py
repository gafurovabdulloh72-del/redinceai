# python3 vomix.py events.json a.wav vo_dir  — 'vo' hodisalaridagi ovoz jumlalarini a.wav ga qo'shadi; ovoz paytida fon pasayadi.
import json, sys, wave, numpy as np
from scipy.signal import resample_poly, butter, sosfilt
ev, apath, vdir = sys.argv[1:4]
w = wave.open(apath); sr = w.getframerate(); ch = w.getnchannels()
a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, ch) / 32768; w.close()
N = len(a); vo = np.zeros(N, np.float32)
for e in json.load(open(ev)):
    if e["type"] != "vo": continue
    vw = wave.open(f"{vdir}/{e['f']}"); vsr = vw.getframerate()
    x = np.frombuffer(vw.readframes(vw.getnframes()), np.int16).astype(np.float32) / 32768; vw.close()
    if vsr != sr: x = resample_poly(x, sr, vsr).astype(np.float32)
    i = int(e["t"] * sr); L = min(len(x), N - i)
    if L > 0: vo[i:i + L] += x[:L]
# ovoz: past rumble kesish, yengil «havo», yumshoq kompressiya
vo = sosfilt(butter(2, 90, "high", fs=sr, output="sos"), vo)
vo = vo + 0.18 * sosfilt(butter(2, 5000, "high", fs=sr, output="sos"), vo)
pk = np.abs(vo).max() or 1; vo = np.tanh(vo / pk * 1.6) / np.tanh(1.6)
# sidechain: ovoz konverti (10 ms hujum, 250 ms qaytish)
env = np.abs(vo); hop = sr // 100; fr = env[:N // hop * hop].reshape(-1, hop).max(1)
sm = np.zeros_like(fr)
for k in range(len(fr)): sm[k] = max(fr[k], sm[k - 1] * 0.96 if k else 0)
duck = np.repeat(np.clip(sm * 3, 0, 1), hop); duck = np.pad(duck, (0, N - len(duck)), mode="edge")
gain = 1 - 0.68 * duck
mix = a * gain[:, None] * 0.75 + vo[:, None] * 0.95
mix /= max(1e-6, np.abs(mix).max()) / 0.95
w = wave.open(apath, "wb"); w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print("vomix ok", round(N / sr, 2), "s")
