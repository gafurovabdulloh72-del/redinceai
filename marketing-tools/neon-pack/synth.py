# python3 synth.py events.json dur out.wav — barcha tovushlar sintez (Content-ID xavfsiz)
import json, sys, numpy as np
from scipy.signal import butter, sosfilt
SR = 48000
ev = json.load(open(sys.argv[1])); DUR = float(sys.argv[2]); N = int(DUR * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def add(t, sig, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[:N - i]
    L[i:i+len(sig)] += sig * g * (1 - max(0, pan)); R[i:i+len(sig)] += sig * g * (1 + min(0, pan))
def env(n, a, d):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d); return e
# --- pad: yumshoq akkord (A min9), sekin nafas
t = np.arange(N) / SR
pad = np.zeros(N)
for f, a in [(110, .5), (164.81, .35), (220, .3), (261.63, .22), (329.63, .18), (493.88, .1)]:
    for det in (-0.6, 0.6):
        pad += a * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6))
pad = lp(pad, 900) * (0.75 + 0.25 * np.sin(2 * np.pi * t / 6.5))
fade = np.minimum(1, t / 1.5) * np.minimum(1, (DUR - t) / 1.8)
pad *= fade * 0.05
L += pad; R += pad
# --- past kick: 100 BPM, whip'gacha va CTA'da
def kick():
    n = int(.45 * SR); tt = np.arange(n) / SR; f = 45 + 75 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
k = kick(); beat = 0.6
for i in range(int(DUR / beat)):
    tk = 0.6 + i * beat
    if tk > DUR - 1.2: break
    if 17.4 < tk < 18.2: continue
    add(tk, k, .22 if tk > 3 else .12)
def noise(n): return rng.standard_normal(n)
def whoosh(d=.55, g=.6, big=False):
    n = int(d * SR); x = noise(n); tt = np.arange(n) / SR
    # filtr chastotasi ko'tarilib tushadi
    out = np.zeros(n); seg = 512
    for s in range(0, n, seg):
        p = s / n; fc = 300 + 4200 * np.sin(np.pi * p) ** 1.5
        out[s:s+seg] = bp(x[s:s+seg], max(80, fc * .5), min(20000, fc * 1.6), 1)
    e = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 2
    if big: out += lp(noise(n), 240) * 1.5
    return out * e
def tick():
    n = int(.03 * SR); return hp(noise(n), 2500) * env(n, .0005, .006) + np.sin(2*np.pi*1800*np.arange(n)/SR) * env(n, .0005, .01) * .5
def impact(g=1.0):
    n = int(1.4 * SR); tt = np.arange(n) / SR; f = 38 + 90 * np.exp(-tt * 18)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2)
    crack = lp(noise(n), 3000) * np.exp(-tt * 18) * .6
    return (boom + crack) * g
def riser(d):
    n = int(d * SR); tt = np.arange(n) / SR; p = tt / d
    f = 180 + 900 * p ** 2; s = np.sin(2 * np.pi * np.cumsum(f) / SR) * .35
    nz = np.zeros(n); seg = 512
    x = noise(n)
    for s0 in range(0, n, seg):
        fc = 400 + 6000 * (s0 / n) ** 2; nz[s0:s0+seg] = bp(x[s0:s0+seg], fc * .6, min(20000, fc * 1.5), 1)
    return (s + nz * .8) * p ** 2.2
def slot(d):
    out = np.zeros(int(d * SR)); tt = 0; dt = .028
    while tt < d - .03:
        c = tick() * .7; i = int(tt * SR); out[i:i+len(c)] += c[:len(out)-i]; tt += dt; dt *= 1.03
    return out
def pop(g=.7):
    n = int(.16 * SR); tt = np.arange(n) / SR; f = 900 * np.exp(-tt * 30) + 260
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .045) * g
def typ():
    n = int(.05 * SR); tt = np.arange(n) / SR
    return hp(noise(n), 1800) * env(n, .0004, .007) * .9 + np.sin(2*np.pi*170*tt) * env(n, .001, .02) * .5
def swell():
    n = int(2.2 * SR); tt = np.arange(n) / SR
    return lp(noise(n), 700) * np.sin(np.pi * tt / 2.2) ** 2 * .5
for e in ev:
    T, ty, g = e['t'], e['type'], e.get('g', .6)
    pan = float(rng.uniform(-.25, .25))
    if ty == 'whoosh': add(T - .15, whoosh(.55, g), .55 * g, pan)
    elif ty == 'whip': add(T - .1, whoosh(.6, g, True), .9 * g)
    elif ty == 'tick': add(T, tick(), .35, pan * .5)
    elif ty == 'impact': add(T, impact(g), .7 * g)
    elif ty == 'riser': add(T, riser(e['d']), .35)
    elif ty == 'slot': add(T, slot(e['d']), .5)
    elif ty == 'pop': add(T, pop(g), .5 * g, pan)
    elif ty == 'type': add(T, typ(), .32, float(rng.uniform(-.15, .15)))
    elif ty == 'swell': add(T, swell(), .25)
mix = np.stack([L, R], 1)
mix /= max(1e-6, np.abs(mix).max()) / 0.7   # -3 dBFS cho'qqi
import wave
with wave.open(sys.argv[3], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('ok', sys.argv[3])
