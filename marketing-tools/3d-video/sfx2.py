"""sfx2.py — sfx.py o'rniga prototip: tempoga bog'langan musiqiy fon + telefonda eshitiladigan SFX.
Foydalanish: python3 sfx2.py chiqish.wav [cfg.json] [urug']
Maqsad: butun miks true-peak <= -15 dBTP (egasi talabi), fon qisqa muddatli ~ -25 LUFS,
SFX cho'qqilari -16..-19 dBTP, integratsiyalangan ~ -24 LUFS.
"""
import sys, json, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, stft, istft, resample_poly

SR = 48000
out = sys.argv[1]
cfg = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and sys.argv[2] != "-" else {}
rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 7)
DUR = float(cfg.get("dur", 16)); N = int(SR * DUR); T = np.arange(N) / SR
BEAT = 0.85                      # 70.59 BPM: 1 takt (4 zarb) = 3.4 s = bitta kadr (shot)
END = 15 * BEAT                  # 12.75 s — yakuniy karta zarbga tushadi (hozir DUR-3.2=12.8)

def db(x): return 10 ** (x / 20)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def place(buf, sig, at):
    i = int(round(at * SR))
    if i < 0: sig, i = sig[..., -i:], 0
    j = min(buf.shape[-1], i + sig.shape[-1])
    if i < buf.shape[-1]: buf[..., i:j] += sig[..., : j - i]
def pan(sig, p):                 # teng quvvatli panorama, p in [-1, 1]
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)])

# --- sintetik stereo IR (chastotaga bog'liq so'nish, L/R mustaqil shovqin => kenglik, mono'da taroq yo'q)
def make_ir(rt_low=1.6, rt_mid=1.1, rt_high=0.55, length=2.4, pre=0.018):
    n = int(length * SR); t = np.arange(n) / SR; ir = np.zeros((2, n + int(pre * SR)))
    for ch in range(2):
        nz = rng.standard_normal(n)
        bands = [(lp(nz, 400), rt_low), (bp(nz, 400, 4000), rt_mid), (hp(nz, 4000), rt_high)]
        tail = sum(b * np.exp(-6.91 * t / rt) for b, rt in bands)
        tail *= np.minimum(1, t / 0.03)                    # yumshoq kirish (diffuziya)
        ir[ch, int(pre * SR):] = tail
    for d, g in ((0.007, .5), (0.013, .35), (0.021, .25)):  # erta aks-sadolar
        ir[0, int(d * SR)] += g; ir[1, int((d + .0031) * SR)] += g
    return ir / np.sqrt(np.sum(ir ** 2) / 2)
IR = make_ir()
def reverb(st):                  # st: (2, n) -> (2, n + len(IR))
    m = st.mean(0)
    return np.stack([fftconvolve(m, IR[0]), fftconvolve(m, IR[1])])

# --- akkordlar (A minor, issiq "golden hour" sahnaga mos): har kadr = 1 takt
CH = [(0, 3.4, [57, 60, 64, 67, 71]),        # Am9
      (3.4, 6.8, [53, 57, 60, 64, 67]),      # Fmaj9
      (6.8, 10.2, [48, 55, 59, 64, 67]),     # Cmaj7/E-ish
      (10.2, END, [50, 57, 60, 64, 65]),     # Dm9 (yarim takt)
      (END, DUR, [45, 57, 64, 67, 71])]      # Am(add9) — karta = yechim
def saw(f, t, fmax=5000):        # band-limited arra (additiv) — telefon diapazonida garmonikalar
    s = np.zeros_like(t); k = 1
    while k * f < fmax: s += np.sin(2 * np.pi * k * f * t + k) / k; k += 1
    return s

pad = np.zeros((2, N))
for a, b, notes in CH:
    n0, n1 = int(a * SR), min(N, int((b + .9) * SR)); t = T[n0:n1] - a
    env = np.minimum(1, t / .7) * np.clip((b - a + .9 - t) / .9, 0, 1)
    for i, m in enumerate(notes[1:]):        # ildizdan tashqari — A3..B4 (220–500 Hz va garmonikalar)
        for det, p in ((-7, -.6), (0, 0), (7, .6)):          # 3 ovoz +/-7 sent, kenglik panoramadan
            v = saw(mtof(m) * 2 ** (det / 1200), t) * env * (1 / (1 + i * .25))
            pad[:, n0:n1] += pan(v, p)
# filtrlangan "nafas": har takt ichida lowpass 700 -> 2600 Hz ochiladi (STFT niqob)
f_, t_, Z = stft(pad, SR, nperseg=2048)
fc = 700 * (2600 / 700) ** (((t_ % 3.4) / 3.4) ** 1.5)
mask = 1 / np.sqrt(1 + (f_[:, None] / fc[None, :]) ** 4)
pad = istft(Z * mask[None], SR, nperseg=2048)[1][:, :N]

# --- sub + psixoakustik bas (telefon 60 Hz ni chiqarmaydi; 2-3-garmonikasi bilan "eshitiladi")
sub = np.zeros(N)
for a, b, notes in CH:
    n0, n1 = int(a * SR), min(N, int((b + .9) * SR)); t = T[n0:n1] - a
    sub[n0:n1] += np.sin(2 * np.pi * mtof(notes[0] - 12) * t) * np.minimum(1, t / .5) * np.clip((b - a + .9 - t) / .9, 0, 1)
harm = bp(np.tanh(3 * sub), 140, 420)
bass = lp(sub, 120) * .6 + harm * .5

# --- puls: kigiz-piano/marimba "pluck" har zarbda (modal sintez, vektorlangan)
def pluck(f, vel=1.0, d=1.4):
    t = np.arange(int(d * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in ((1, 1, 3.5), (2, .45, 6), (3.01, .2, 10), (4.2, .08, 16)))
    return s * np.minimum(1, t / .004) * vel
pulse = np.zeros((2, N)); k = 0
for a, b, notes in CH:
    beat_t = np.ceil(a / BEAT) * BEAT
    while beat_t < min(b, DUR - 1.2):
        m = notes[1 + k % (len(notes) - 1)] + 12           # A4..B5: aynan telefon diapazoni
        jit = rng.normal(0, .006); vel = db(rng.normal(0, 1.5)) * (1.0 if k % 4 == 0 else .7)
        place(pulse, pan(pluck(mtof(m), vel), .25 * np.sin(k * 1.7)), beat_t + jit)
        beat_t += BEAT; k += 1
pulse = lp(pulse, 3200)

# --- "chang" granulyar tekstura (sahnadagi chang zarralariga mos): Puasson donalar, akkord tonlarida
dust = np.zeros((2, N)); tt = 0.0
while tt < DUR - .2:
    tt += rng.exponential(1 / 5.0)
    notes = next(c[2] for c in CH if c[0] <= tt < c[1] + .001) if tt < DUR else CH[-1][2]
    f = mtof(rng.choice(notes[1:]) + 24 + 12 * rng.integers(0, 2))
    g = rng.uniform(.02, .06); n = int(g * SR); w = np.hanning(n)
    place(dust, pan(np.sin(2 * np.pi * f * np.arange(n) / SR) * w * rng.uniform(.3, 1), rng.uniform(-.8, .8)), tt)

# ================= SFX
sfx = np.zeros((2, N)); hits = []          # hits: ducking uchun (vaqt, chuqurlik dB)
def whoosh(center, d=.8, f0=250, f1=4500):
    n = int(d * SR); x = rng.standard_normal(n)
    fr, tm, Z = stft(x, SR, nperseg=512)
    c = f0 * (f1 / f0) ** (tm / d)                      # uzluksiz sweep (32 pog'ona emas)
    band = np.exp(-0.5 * (np.log2(fr[:, None] + 1) - np.log2(c[None]))** 2 / .45 ** 2)
    s = istft(Z * band, SR, nperseg=512)[1][:n]
    tn = np.arange(n) / n; s *= np.sin(np.pi * tn) ** 2 * (1 + .6 * tn)   # ozgina "oldinga" og'ish
    st = pan(s, np.linspace(-.6, .6, n))
    place(sfx, st, center - d * .55); hits.append((center, 2.5))
def impact(at, k=1.0):
    n = int(1.4 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(48 + 22 * np.exp(-t * 14)) / SR) * np.exp(-t * 5)
    phone = bp(np.tanh(4 * body), 110, 480) * .7       # body garmonikalari — telefonda "dum" eshitiladi
    knock = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dk) for f, a, dk in ((172, .5, 16), (397, .35, 24), (655, .2, 34), (1013, .1, 45)))
    tr = lp(rng.standard_normal(n), 3500) * np.exp(-t * 300) * .25   # yumshoq transient (oq klik emas)
    s = (body * .8 + phone + knock + tr) * np.minimum(1, t / .002) * k
    place(sfx, pan(s, 0), at); hits.append((at, 4))
def reverse_swell(at, d=.9):     # teskari reverb — 0.3 s dagi zarbaga "so'rib olish"
    d = min(d, at)                # 0-kadrdan oldin boshlanmasin (eski riser yarmidan boshlanardi)
    n = int(.25 * SR); t = np.arange(n) / SR
    src = sum(np.sin(2 * np.pi * mtof(m + 12) * t) for m in CH[0][2][1:4]) * np.exp(-t * 12)
    tail = reverb(pan(src, 0))[:, : int(d * SR)][:, ::-1]
    tail *= np.linspace(0, 1, tail.shape[1]) ** 1.5
    place(sfx, tail * .9, at - d)
def tap(at, m, k=.6, p=0.0):     # in-key shisha "tap" (A minor tonlari): pop() o'rniga
    n = int(.5 * SR); t = np.arange(n) / SR; f = mtof(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dk) for r, a, dk in ((1, 1, 14), (2.76, .35, 30), (5.4, .12, 60)))
    place(sfx, pan(s * np.minimum(1, t / .0015) * k, p), at); hits.append((at, 1.5))
def tick(at, k=.35):             # caption kirishi: ikki partialli yog'och "tik" + 1 ms havo
    n = int(.08 * SR); t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 180) + .5 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 260)
         + hp(rng.standard_normal(n), 3000) * np.exp(-t * 900) * .3) * k
    place(sfx, pan(s, .15), at)
def shimmer(at):
    n = int(2.2 * SR); t = np.arange(n) / SR; s = np.zeros((2, n))
    for i, m in enumerate((76, 81, 83, 88)):           # E5 A5 B5 E6 — Am(add9) bilan bir xil
        s += pan(np.sin(2 * np.pi * mtof(m) * t + rng.random() * 6) * np.exp(-t * (1.8 + i * .4)) * np.minimum(1, t / (.01 + i * .03)), (-.5, .5, -.25, .25)[i])
    place(sfx, s * .14, at)

reverse_swell(.3); impact(.3, .8)
for c in cfg.get("cuts", (3.4, 6.8, 10.2)): whoosh(c)
for c in cfg.get("caps_in", (3.7, 7.1, 10.5)): tick(c)
for i, w in enumerate(cfg.get("words_in", (7.0, 7.6, 8.2))): tap(w, (69, 72, 76)[i % 3], p=(-.4, .4, 0)[i % 3])
for i, u in enumerate(cfg.get("ui", ())): tap(u, 81 + (0, 3, 7, 12)[i % 4], k=.35, p=.1)  # ekran ichidagi UI hodisalari
impact(END, 1.0); shimmer(END)
sfx_wet = reverb(sfx)[:, :N] * db(-14)

# ================= miks: ducking (ma'lum hodisa jadvalidan, deterministik)
duck = np.zeros(N)
for at, depth in hits:
    t = T - at
    shape = np.where(t < 0, np.clip(1 + t / .03, 0, 1), np.where(t < .08, 1, np.exp(-(t - .08) / .35)))
    duck = np.maximum(duck, shape * depth)
gduck = db(-duck)

def norm_rms(x, target):
    return x * db(target) / (np.sqrt(np.mean(x ** 2)) + 1e-12)
bed = (norm_rms(pad, -30) + norm_rms(pulse, -33) + norm_rms(np.stack([bass, bass]), -31) + norm_rms(dust, -46))
bed = bed + reverb(bed)[:, :N] * db(-12)
fade = np.minimum(1, T / .35) * np.clip((DUR - T) / 1.2, 0, 1)   # 0.35 s: hook darhol eshitiladi
bed = bed * fade * gduck
bed = norm_rms(bed, -27.5)

sfx_bus = sfx + sfx_wet
sfx_bus *= db(-17) / (np.abs(sfx_bus).max() + 1e-12)            # SFX cho'qqisi -17 dBFS
mix = bed + sfx_bus
if len(sys.argv) > 4: np.save(sys.argv[4], np.stack([bed, sfx_bus]))   # stems (tahlil uchun)

# --- true-peak cheklagich (4x oversampling bilan o'lchash), shift = -15.3 dBTP
def true_peak(x): return np.abs(resample_poly(x, 4, 1, axis=-1)).max()
from scipy.ndimage import minimum_filter1d
from scipy.signal import lfilter
ceil = db(-15.3)
pre_tp = 20 * np.log10(true_peak(mix))
for _ in range(4):
    tp = true_peak(mix)
    if tp <= ceil: break
    os_env = np.abs(resample_poly(mix, 4, 1, axis=-1)).max(0).reshape(-1, 4).max(1)[:N]  # true-peak konvert
    g = np.minimum(1, ceil * .98 / (os_env + 1e-12))
    look = int(.004 * SR)
    g = minimum_filter1d(g, 2 * look + 1)                       # lookahead + hold
    rel = np.exp(-1 / (.12 * SR))                                # 120 ms release (one-pole, max bilan)
    gr = lfilter([1 - rel], [1, -rel], 1 - g)                    # kamayish miqdorini silliqlash
    g = np.minimum(g, 1 - np.minimum(gr, 1 - g.min()))
    g = np.convolve(g, np.ones(look) / look, "same")             # attack silliqligi
    mix = mix * g
post_tp = 20 * np.log10(true_peak(mix))
print(f"limiter: {pre_tp:.1f} -> {post_tp:.1f} dBTP")
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"{out}: true-peak {20*np.log10(true_peak(mix)):.1f} dBTP, sample-peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
