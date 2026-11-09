"""Videoga mos SFX + fon ovozi sintezi (litsenziyasiz, o'zimiz yaratamiz).
Foydalanish: python3 sfx.py chiqish.wav [davomiylik] [urug']
SFX shinasi cho'qqisi -15 dBFS, fon -34 dBFS RMS atrofida.
"""
import sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
out = sys.argv[1]
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 16.0
rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 7)
N = int(SR * DUR)
t_all = np.arange(N) / SR

def db(x): return 10 ** (x / 20)
def env_ad(n, a, d):
    e = np.ones(n); na = max(1, int(a * SR)); nd = max(1, int(d * SR))
    e[:na] = np.linspace(0, 1, na); e[-nd:] *= np.exp(-np.linspace(0, 5, nd)); return e
def place(buf, sig, at):
    i = int(at * SR)
    if i < 0: sig, i = sig[-i:], 0
    j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[: j - i]

L = np.zeros(N); R = np.zeros(N)

def whoosh(center):
    d = .7; n = int(d * SR); x = rng.standard_normal(n)
    out = np.zeros(n); seg = 32
    for k in range(seg):  # o'tuvchi band-pass (300 -> 3200 Hz)
        a, b = k * n // seg, (k + 1) * n // seg
        f = 300 * (3200 / 300) ** (k / seg)
        sos = butter(2, [f * .7, min(f * 1.4, 20000)], btype="band", fs=SR, output="sos")
        out[a:b] = sosfilt(sos, x)[a:b]
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    s = out * e; pan = np.linspace(-.7, .7, n)
    place(L, s * (1 - pan) / 2, center - d / 2); place(R, s * (1 + pan) / 2, center - d / 2)

def impact(at, k=1.0):
    d = 1.2; n = int(d * SR); tt = np.arange(n) / SR
    f = 40 + 45 * np.exp(-tt * 9); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt * 4.5)
    click = sosfilt(butter(2, 2500, btype="high", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-tt * 90) * .25
    s = (body + click) * k; place(L, s, at); place(R, s, at)

def pop(at, f=1100, k=.5):
    n = int(.12 * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * (f + 400 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 38) * k
    place(L, s, at); place(R, s, at)

def tick(at, k=.22):
    n = int(.04 * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * 2300 * tt) * np.exp(-tt * 140) * k
    place(L, s, at); place(R, s * .8, at)

def shimmer(at):
    n = int(1.6 * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for f in (1318.5, 1760, 2637):
        s += np.sin(2 * np.pi * f * tt + rng.random() * 6) * np.exp(-tt * 2.6)
    s *= np.minimum(1, tt / .02) * .12
    place(L, s, at); place(R, np.roll(s, 240), at)

def riser(end, d=.9):
    n = int(d * SR); tt = np.arange(n) / SR
    x = sosfilt(butter(2, 1800, btype="low", fs=SR, output="sos"), rng.standard_normal(n)) * (tt / d) ** 2 * .6
    place(L, x, end - d); place(R, x, end - d)

# --- voqealar (scene2 vaqt jadvaliga mos)
riser(.3, .6); impact(.3, .9)
for c in (3.4, 6.8, 10.2): whoosh(c)
for i, w in enumerate((7.0, 7.6, 8.2)): pop(w, 900 + i * 220)
for c in (3.7, 7.1, 10.5): tick(c)
impact(DUR - 3.2, 1.0); shimmer(DUR - 3.2)

sfx = np.stack([L, R])
sfx *= db(-15) / (np.abs(sfx).max() + 1e-9)          # SFX cho'qqisi -15 dBFS

# --- fon: iliq xona shovqini + yumshoq akkord
brown = np.cumsum(rng.standard_normal(N)); brown -= np.convolve(brown, np.ones(4800) / 4800, "same")
room = sosfilt(butter(2, 380, btype="low", fs=SR, output="sos"), brown)
pad = sum(np.sin(2 * np.pi * f * t_all + rng.random() * 6) * (1 + .25 * np.sin(2 * np.pi * .13 * t_all + i)) for i, f in enumerate((110, 164.81, 220, 261.63)))
bed = room / (np.std(room) + 1e-9) * .6 + pad / np.std(pad) * .4
fade = np.minimum(1, t_all / 1.5) * np.minimum(1, (DUR - t_all) / .8)
bed = bed * fade
bed *= db(-34) / (np.sqrt(np.mean(bed ** 2)) + 1e-9)
mix = sfx + np.stack([bed, np.roll(bed, 480)])
peak = np.abs(mix).max()
if peak > db(-14): mix *= db(-14) / peak
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"{out}: cho'qqi {20*np.log10(np.abs(mix).max()):.1f} dBFS")
