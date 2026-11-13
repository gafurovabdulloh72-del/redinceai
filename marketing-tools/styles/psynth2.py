# python3 psynth2.py events.json dur out.wav — psynth'ning "premium" varianti:
# musiqiy fon (kick/shaker/akkord/arpejio, sidechain), teskari swell, yaxshiroq reverb (pre-delay, erta aks-sado,
# yuqori chastota tez so'nadi), qatlamli whoosh, mastering (havo + yumshoq klip). Hammasi sintez — Content-ID xavfsiz.
import json, sys, wave
import numpy as np
from scipy.signal import fftconvolve
import psynth as P

SR = P.SR
rng = np.random.default_rng(23)
flt, st, norm, T = P.flt, P.st, P.norm, P.T

def rev_swell(d=.5, g=.5):
    t = T(d); x = P.flt(rng.standard_normal(len(t)), 'band', [400, 9000]) * (t / d) ** 3
    tone = np.sin(2 * np.pi * np.cumsum(200 + 500 * (t / d) ** 2) / SR) * (t / d) ** 4 * .4
    return st(norm(x) * .8 + tone, 0, .01) * g

def whoosh2(d=.6, g=.7, direction=1):
    w = P.whoosh(d, g, direction)
    t = T(d); f = 900 - 600 * (t / d)                      # past tomonga sirpanuvchi ohang (doppler)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 3 * .12 * g
    return w + st(tone, 0, .004)

def make_ir(sec=1.8):
    n = int(sec * SR); t = np.arange(n) / SR; ir = np.zeros((2, n)); pre = int(.018 * SR)
    for c in range(2):
        lo = flt(rng.standard_normal(n), 'low', 700) * np.exp(-t * 2.4)
        mid = flt(rng.standard_normal(n), 'band', [700, 4000]) * np.exp(-t * 3.4)
        hi = flt(rng.standard_normal(n), 'high', 4000) * np.exp(-t * 6.5)
        x = lo * .8 + mid + hi * .6
        x = np.concatenate([np.zeros(pre), x[:-pre]])
        for d_ms, a in ((11, .5), (23, .38), (37, .3), (53, .22), (71, .16)):   # erta aks-sadolar
            k = pre + int(d_ms * (1.07 if c else 1) * SR / 1000); x[k] += a * (1 if (k % 2) else -1)
        ir[c] = x
    return ir / np.abs(ir).sum(axis=1, keepdims=True).max() * 7

def music_bed(dur, bpm=100):
    N = int(dur * SR); t = np.arange(N) / SR; beat = 60 / bpm; bar = beat * 4
    bed = np.zeros((2, N))
    # akkordlar: Am - F - C - G (har biri 1 takt), yumshoq pad
    prog = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (130.81, 196.0, 261.63), (196.0, 246.94, 293.66)]
    for i in range(int(dur / bar) + 1):
        t0 = i * bar; ch = prog[i % 4]; n = int(bar * SR) + SR // 2; tt = np.arange(n) / SR
        pad = sum(np.sin(2 * np.pi * f * (1 + det) * tt + rng.uniform(0, 6)) for f in ch for det in (-.002, .002))
        pad = flt(pad, 'low', 1500) * np.minimum(1, tt / .35) * np.exp(-np.maximum(0, tt - bar) * 6)
        a = int(t0 * SR); L = min(n, N - a)
        if L > 0: bed[:, a:a+L] += st(pad[:L] * .05, 0, .015)
        # arpejio (8-lik), yuqori oktava, yumshoq pluck
        for k in range(8):
            ts = t0 + k * beat / 2; f = ch[k % 3] * 2; m = int(.35 * SR); u = np.arange(m) / SR
            pl = (np.sin(2 * np.pi * f * u) + .3 * np.sin(2 * np.pi * 2 * f * u)) * np.exp(-u * 9) * (.022 if k % 2 else .03)
            s0 = int(ts * SR); L = min(m, N - s0)
            if L > 0: bed[:, s0:s0+L] += st(pl[:L], .35 if k % 2 else -.35)
    # kick (har zarb) va shaker (8-lik)
    for i in range(int(dur / beat) + 1):
        ts = i * beat; m = int(.4 * SR); u = np.arange(m) / SR; f = 48 + 70 * np.exp(-u * 30)
        kk = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-u * 8) * .12
        s0 = int(ts * SR); L = min(m, N - s0)
        if L > 0: bed[:, s0:s0+L] += st(kk[:L], 0)
        for half in (0, .5):
            s1 = int((ts + half * beat) * SR); m2 = int(.06 * SR); u2 = np.arange(m2) / SR
            sh = flt(rng.standard_normal(m2), 'high', 7000) * np.exp(-u2 * 70) * (.018 if half else .01)
            L2 = min(m2, N - s1)
            if L2 > 0: bed[:, s1:s1+L2] += st(sh[:L2], .2)
    fade = np.minimum(1, t / 1.2) * np.clip((dur - t) / 1.4, 0, 1)
    return bed * fade

def build(events, dur):
    N = int(dur * SR) + SR
    dry = np.zeros((2, N)); send = np.zeros((2, N)); duck = np.zeros(N)
    def add(t0, s, sv=.25, dk=0.0):
        i = int(t0 * SR)
        if i < 0: s = s[:, -i:]; i = 0
        L = min(s.shape[1], N - i)
        if L <= 0: return
        dry[:, i:i+L] += s[:, :L]; send[:, i:i+L] += s[:, :L] * sv
        if dk > 0:
            m = min(int(.6 * SR), N - i); duck[i:i+m] = np.maximum(duck[i:i+m], dk * np.exp(-np.arange(m) / SR * 5))
    for e in events:
        t0, ty, g = e['t'], e['type'], e.get('g', .6)
        if ty == 'impact':
            add(t0 - .5, rev_swell(.5, .32 * g), .5)
            add(t0, P.sub_boom(.95 * g), .3, .8); add(t0, P.shimmer(1.1, .22 * g, 46), .7)
        elif ty == 'whip': add(t0 - .18, whoosh2(.6, .85 * g, 1), .35, .5)
        elif ty == 'whoosh': add(t0 - .2, whoosh2(.62, .55 * g, rng.choice([-1, 1])), .3, .3)
        elif ty == 'riser': add(t0, P.riser(e.get('d', 1.2), .5), .4)
        elif ty == 'tick': add(t0, P.tick(.3, 1900 + 900 * e.get('k', 0)), .18)
        elif ty == 'slot': add(t0, P.slot_roll(e.get('d', .3), .45), .22); add(t0 + e.get('d', .3), P.chirp(.2, 700, 1500, .12), .35)
        elif ty == 'pop': add(t0, P.pop(.5 * g), .35)
        elif ty == 'click': add(t0, P.ui_click(.38 * g, e.get('ping', 1700), rng.uniform(-.3, .3)), .25)
        elif ty == 'ding': add(t0, P.ding(.5 * g, e.get('root', 220)), .6, .4)
        elif ty == 'shimmer': add(t0, P.shimmer(e.get('d', 1.0), .28 * g), .75)
        elif ty == 'glitch': add(t0, P.glitch(e.get('d', .3), .35 * g), .2)
        elif ty == 'chirp': add(t0, P.chirp(.38 * g), .35)
        elif ty == 'shutter': add(t0, P.shutter(.45 * g), .25)
        elif ty == 'type': add(t0, P.typ(.3), .12)
        elif ty == 'paper':
            n = int(.5 * SR); tt = np.arange(n) / SR
            x = P.flt(rng.standard_normal(n), 'band', [1500, 7000]) * (np.abs(np.sin(tt * 37)) ** 3) * np.sin(np.pi * tt / .5) ** 2
            add(t0, P.st(P.norm(x) * .35 * g, rng.uniform(-.3, .3), .006), .3)
        elif ty == 'stamp':
            add(t0, P.sub_boom(.55 * g), .2, .6); add(t0, P.shutter(.4 * g), .2)
        elif ty == 'swell': add(t0, P.air_swell(2.4, .2), .6); add(t0 + .3, P.shimmer(1.6, .13, 30), .8)
    ir = make_ir()
    wet = np.stack([fftconvolve(send[c], ir[c])[:N] for c in range(2)])
    bpm = next((e.get('bpm') for e in events if e['type'] == 'bed'), 100)
    bed = music_bed(dur, bpm) if bpm else np.zeros((2, N))
    bed = np.pad(bed, ((0, 0), (0, N - bed.shape[1])))
    sc = 1 - np.clip(duck, 0, .85)                                       # sidechain: fon zarbada pasayadi
    mix = dry + wet * .5 + bed * sc * .5
    # mastering: havo (yuqori polka), past rumble kesiladi, yumshoq klip
    air = np.stack([flt(mix[c], 'high', 9000) for c in range(2)]) * .25
    mix = np.stack([flt(mix[c], 'high', 28) for c in range(2)]) + air
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.7) / np.tanh(1.7)
    return mix[:, :int(dur * SR)] * .9

if __name__ == '__main__':
    ev = json.load(open(sys.argv[1])); dur = float(sys.argv[2])
    mix = build(ev, dur)
    with wave.open(sys.argv[3], 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix.T * 32767).astype('<i2').tobytes())
    print('ok', sys.argv[3])
