# python3 psynth.py events.json dur out.wav
# "Premium" SFX kutubxonasi — hammasi sintez (Content-ID xavfsiz): sub-zarba, whoosh (stereo o'tish),
# riser, yaltirash, ding-akkord, UI klik+ping, glitch, chirp, shutter, typing, pop; umumiy reverb + limiter.
import json, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(11)

def T(d): return np.arange(int(d * SR)) / SR
def flt(x, kind, f, o=2):
    return sosfilt(butter(o, f, kind, fs=SR, output='sos'), x)
def env_ad(n, a, d, curve=1.0):
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1) ** 0.6
    return att * np.exp(-np.maximum(0, t - a) / d) ** curve
def st(x, pan=0.0, width=0.0):
    """mono -> stereo; width: kanallar orasidagi kichik kechikish (Haas)"""
    l = x * np.sqrt(0.5 * (1 - pan)); r = x * np.sqrt(0.5 * (1 + pan))
    if width > 0:
        k = int(width * SR); r = np.concatenate([np.zeros(k), r[:-k] if k else r])
    return np.stack([l, r])
def norm(x, p=1.0):
    m = np.abs(x).max(); return x * (p / m) if m > 0 else x

# ---------------- tovushlar ----------------
def sub_boom(g=1.0):
    t = T(2.4); f = 32 + 70 * np.exp(-t * 9)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.7)
    body = np.tanh(body * 1.8) / np.tanh(1.8)                       # iliq saturatsiya
    click = flt(rng.standard_normal(len(t)), 'band', [900, 5000]) * np.exp(-t * 90) * .5
    thump = flt(rng.standard_normal(len(t)), 'low', 180) * np.exp(-t * 14) * .8
    x = body + click + norm(thump) * .35
    s = st(x, 0, 0)
    return s * g
def whoosh(d=.7, g=.7, direction=1, air=1.0):
    n = int(d * SR); x = rng.standard_normal(n); t = np.arange(n) / SR; p = t / d
    out = np.zeros(n); seg = 256
    for s0 in range(0, n, seg):
        q = s0 / n; fc = 250 + 5200 * np.sin(np.pi * q) ** 1.6
        out[s0:s0+seg] = flt(x[s0:s0+seg], 'band', [max(60, fc * .45), min(20000, fc * 1.9)], 1)
    e = np.sin(np.pi * np.clip(p, 0, 1)) ** 2.4
    low = flt(rng.standard_normal(n), 'low', 220) * np.sin(np.pi * p) ** 2 * .9
    x = norm(out * e) * air + norm(low) * .35
    pan = direction * (p * 2 - 1) * .8                               # chapdan o'ngga o'tadi
    l = x * np.sqrt(.5 * (1 - pan)); r = x * np.sqrt(.5 * (1 + pan))
    return np.stack([l, r]) * g
def riser(d=1.2, g=.6):
    t = T(d); p = t / d
    saws = sum(np.sin(2 * np.pi * np.cumsum(120 * (1 + 3 * p ** 2) * (1 + det)) / SR) for det in (-.006, 0, .007))
    nz = rng.standard_normal(len(t)); out = np.zeros(len(t)); seg = 256
    for s0 in range(0, len(t), seg):
        fc = 600 + 9000 * (s0 / len(t)) ** 2
        out[s0:s0+seg] = flt(nz[s0:s0+seg], 'band', [fc * .5, min(20000, fc * 1.6)], 1)
    x = (norm(saws) * .35 + norm(out) * .8) * p ** 2.4
    return st(x, 0, .012) * g
def shimmer(d=1.2, g=.4, dens=60):
    n = int(d * SR); out = np.zeros((2, n + SR))
    for _ in range(dens):
        t0 = rng.uniform(0, d * .7); f = rng.uniform(3500, 12000); dur = rng.uniform(.08, .35)
        tt = T(dur); s = np.sin(2 * np.pi * f * tt) * np.exp(-tt / (dur * .3)) * rng.uniform(.3, 1)
        i = int(t0 * SR); pan = rng.uniform(-.9, .9)
        out[:, i:i+len(tt)] += st(s, pan)
    e = np.ones(n + SR); return out * e * g / max(1e-6, np.abs(out).max())
def ding(g=.6, root=220.0):
    # sus/maj9 akkord: 1, 1.5, 2.25, 3.36 (namunadagi 227/340/511/766 Hz nisbatlari)
    t = T(2.2); x = np.zeros(len(t))
    for k, (r, a) in enumerate([(1, .9), (1.5, .7), (2.25, .55), (3.37, .45), (4.5, .2)]):
        f = root * r
        x += a * (np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * (2.2 + k * .6))
    att = np.clip(t / .004, 0, 1); x *= att
    return st(norm(x), 0, .008) * g
def ui_click(g=.5, ping=1700.0, pan=0.0):
    t = T(.12)
    clk = flt(rng.standard_normal(len(t)), 'high', 2500) * np.exp(-t * 400)
    pg = np.sin(2 * np.pi * ping * t) * np.exp(-t * 55)
    thud = np.sin(2 * np.pi * 140 * t) * np.exp(-t * 60) * .6
    return st(norm(clk) * .6 + pg * .55 + thud, pan) * g
def glitch(d=.35, g=.5):
    n = int(d * SR); out = np.zeros(n); i = 0
    while i < n:
        L = int(rng.uniform(.006, .028) * SR); f = rng.choice([1800, 2600, 3900, 5200, 7800])
        tt = np.arange(L) / SR
        b = np.sign(np.sin(2 * np.pi * f * tt)) * .4 + rng.standard_normal(L) * .25
        b = np.round(b * 6) / 6                                        # bitcrush
        out[i:i+L] += b[:max(0, min(L, n - i))] * (rng.uniform(.3, 1) if rng.random() > .25 else 0)
        i += L
    out = flt(out, 'high', 900)
    return st(norm(out) * np.exp(-np.arange(n) / SR / (d * .8)), rng.uniform(-.3, .3), .004) * g
def chirp(g=.5, f0=480, f1=1250, d=.22):
    t = T(d); f = f0 + (f1 - f0) * (t / d) ** .7
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** .8
    return st(x, 0, .006) * g
def shutter(g=.5):
    out = np.zeros(int(.18 * SR))
    for t0, a in ((0, 1), (.075, .7)):
        L = int(.03 * SR); i = int(t0 * SR)
        out[i:i+L] += flt(rng.standard_normal(L), 'band', [1500, 9000]) * np.exp(-np.arange(L) / SR * 160) * a
    return st(norm(out), 0, .003) * g
def typ(g=.3):
    t = T(.05)
    x = flt(rng.standard_normal(len(t)), 'high', 1800) * np.exp(-t * 300) * .9 + np.sin(2 * np.pi * 170 * t) * np.exp(-t * 60) * .5
    return st(x, rng.uniform(-.2, .2)) * g
def pop(g=.6):
    t = T(.18); f = 1050 * np.exp(-t * 32) + 230
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), .002, .05)
    air = flt(rng.standard_normal(len(t)), 'band', [3000, 9000]) * np.exp(-t * 120) * .15
    return st(x + air, rng.uniform(-.25, .25), .004) * g
def tick(g=.35, ping=2200):
    return ui_click(g, ping, rng.uniform(-.3, .3))
def slot_roll(d=.3, g=.5):
    n = int(d * SR); out = np.zeros((2, n + SR // 4)); tt = 0; dt = .03
    while tt < d:
        c = ui_click(.6, 2600 + rng.uniform(-200, 200)); i = int(tt * SR); out[:, i:i+c.shape[1]] += c[:, :out.shape[1]-i]; tt += dt; dt *= 1.08
    return out * g
def air_swell(d=2.2, g=.3):
    t = T(d); x = flt(rng.standard_normal(len(t)), 'band', [300, 4000]) * np.sin(np.pi * t / d) ** 2
    return st(norm(x), 0, .015) * g

# ---------------- miks ----------------
def build(events, dur, bed=True):
    N = int(dur * SR) + SR
    dry = np.zeros((2, N)); wet_send = np.zeros((2, N))
    def add(t0, s, send=.25):
        i = int(t0 * SR)
        if i < 0: s = s[:, -i:]; i = 0
        L = min(s.shape[1], N - i)
        if L <= 0: return
        dry[:, i:i+L] += s[:, :L]; wet_send[:, i:i+L] += s[:, :L] * send
    for e in events:
        t0, ty, g = e['t'], e['type'], e.get('g', .6)
        if ty == 'impact':
            add(t0, sub_boom(.95 * g), .3); add(t0, shimmer(1.0, .22 * g, 40), .6)
        elif ty == 'sub': add(t0, sub_boom(.8 * g), .25)
        elif ty == 'whip': add(t0 - .18, whoosh(.55, .85 * g, 1), .3)
        elif ty == 'whoosh': add(t0 - .2, whoosh(.6, .55 * g, rng.choice([-1, 1]), .8), .25)
        elif ty == 'riser': add(t0, riser(e.get('d', 1.2), .55), .35)
        elif ty == 'tick': add(t0, tick(.32, 1900 + 900 * e.get('k', 0)), .15)
        elif ty == 'slot': add(t0, slot_roll(e.get('d', .3), .5), .2); add(t0 + e.get('d', .3), chirp(.22, 700, 1500, .12), .3)
        elif ty == 'pop': add(t0, pop(.55 * g), .3)
        elif ty == 'click': add(t0, ui_click(.42 * g, e.get('ping', 1700), rng.uniform(-.3, .3)), .2)
        elif ty == 'ding': add(t0, ding(.5 * g, e.get('root', 220)), .55)
        elif ty == 'shimmer': add(t0, shimmer(e.get('d', 1.0), .3 * g), .7)
        elif ty == 'glitch': add(t0, glitch(e.get('d', .3), .4 * g), .2)
        elif ty == 'chirp': add(t0, chirp(.4 * g), .3)
        elif ty == 'shutter': add(t0, shutter(.5 * g), .2)
        elif ty == 'type': add(t0, typ(.28), .1)
        elif ty == 'swell': add(t0, air_swell(2.4, .22), .6); add(t0 + .3, shimmer(1.6, .14, 30), .8)
    # umumiy reverb (sintetik IR ~1.6 s, past chastotalar kesilgan)
    irn = int(1.6 * SR); ti = np.arange(irn) / SR
    ir = np.stack([flt(rng.standard_normal(irn), 'band', [250, 9000]) * np.exp(-ti * 3.2) for _ in range(2)])
    ir /= np.abs(ir).sum(axis=1, keepdims=True).max() / 6
    wet = np.stack([fftconvolve(wet_send[c], ir[c])[:N] for c in range(2)])
    mix = dry + wet * .55
    if bed:   # juda past pad (akkord), musiqiy yostiq
        t = np.arange(N) / SR; pad = np.zeros(N)
        for f, a in [(110, .5), (164.8, .32), (220, .28), (277.2, .2), (329.6, .16)]:
            for det in (-.5, .5): pad += a * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6))
        pad = flt(pad, 'low', 800) * (0.8 + .2 * np.sin(2 * np.pi * t / 7)) * np.minimum(1, t / 1.5) * np.clip((dur - t) / 1.5, 0, 1)
        mix += st(pad * .018, 0, .02)[:, :N]
    # yumshoq kompressor + limiter
    peak = np.abs(mix).max(); mix = mix / peak
    mix = np.tanh(mix * 1.6) / np.tanh(1.6)
    return mix[:, :int(dur * SR)] * .89

if __name__ == '__main__':
    ev = json.load(open(sys.argv[1])); dur = float(sys.argv[2])
    mix = build(ev, dur)
    with wave.open(sys.argv[3], 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix.T * 32767).astype('<i2').tobytes())
    print('ok', sys.argv[3])
