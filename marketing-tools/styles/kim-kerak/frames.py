"""3 mavzu uchun birinchi kadr: ta'lim, shaxsiy brend, restoran."""
import pathlib
OUT = pathlib.Path(__file__).parent
INK = "#1a1a1c"; CORAL = "#ff5a36"; SKIN = "#f6cfaa"

def face(expr):
    if expr == "worry":
        return f'''<circle cx="-38" cy="5" r="11" fill="{INK}"/><circle cx="38" cy="5" r="11" fill="{INK}"/>
        <path d="M-58 -28 L-20 -18 M58 -28 L20 -18" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>
        <path d="M-30 70 Q0 50 30 70" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>
        <path d="M100 -50 q12 22 0 34 q-12 -12 0 -34z" fill="#7fc8f8" stroke="{INK}" stroke-width="4"/>'''
    if expr == "shock":
        return f'''<circle cx="-38" cy="5" r="12" fill="{INK}"/><circle cx="38" cy="5" r="12" fill="{INK}"/>
        <path d="M-56 -26 L-20 -36 M56 -26 L20 -36" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="0" cy="66" rx="18" ry="22" fill="{INK}"/>'''
    return f'''<path d="M-50 5 Q-38 -8 -26 5 M26 5 Q38 -8 50 5" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>
        <path d="M-34 55 Q0 85 34 55" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>'''

def person(x, y, body, hair, expr, extra="", hat=""):
    return f'''<g transform="translate({x},{y}) scale(1.28)">
  <path d="M-130 340 Q-130 160 0 140 Q130 160 130 340 L130 820 L-130 820 Z" fill="{body}" stroke="{INK}" stroke-width="7"/>
  <rect x="-20" y="80" width="40" height="70" fill="#f1c39d" stroke="{INK}" stroke-width="6"/>
  <ellipse cx="0" cy="0" rx="105" ry="115" fill="{SKIN}" stroke="{INK}" stroke-width="7"/>
  {hair}
  <circle cx="-62" cy="40" r="15" fill="#ffb3a7" opacity=".6"/><circle cx="62" cy="40" r="15" fill="#ffb3a7" opacity=".6"/>
  {face(expr)}{hat}{extra}
</g>'''

HAIR_M = f'<path d="M-102 -10 Q-110 -120 0 -126 Q112 -120 102 -10 Q85 -78 0 -72 Q-80 -78 -102 -10Z" fill="{INK}"/>'
HAIR_F = f'<path d="M-108 60 Q-130 -125 0 -128 Q130 -125 108 60 Q100 -60 0 -70 Q-95 -60 -108 60Z" fill="#3a2418"/>'

def card(x, y, rot, items):
    t = "".join(f'<text x="26" y="{62+i*62}">{s} ?</text>' for i, s in enumerate(items))
    h = 40 + 62 * len(items)
    return f'''<g transform="translate({x},{y}) rotate({rot})">
  <rect width="430" height="{h}" rx="16" fill="#fff8d6" stroke="{INK}" stroke-width="6"/>
  <g font-size="34" font-weight="700" fill="{INK}">{t}</g></g>'''

def page(title, accent, svg):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:"Space Grotesk",Arial,sans-serif}}
.bg{{position:absolute;inset:0;background:#fbf8ef;background-image:linear-gradient(#dfe7f1 2px,transparent 2px);background-size:100% 64px}}
.bg:before{{content:"";position:absolute;left:110px;top:0;bottom:0;width:3px;background:#f2a8a0}}
.h{{position:absolute;left:150px;right:80px;top:200px;font-size:92px;font-weight:700;line-height:1.06;color:{INK}}}
.h b{{color:{CORAL}}}
svg{{position:absolute;left:0;top:640px}}
</style></head><body><div class="bg"></div><div class="h">{title}<br><b>{accent}</b></div>
<svg width="1080" height="1320" viewBox="0 0 1080 1320" overflow="visible">{svg}</svg></body></html>'''

# 1) Ta'lim: o'qituvchi + noutbuk
laptop = f'''<g transform="translate(150,330)"><rect x="-10" y="0" width="230" height="150" rx="12" fill="#2b2b30" stroke="{INK}" stroke-width="6"/>
<rect x="6" y="14" width="198" height="120" rx="6" fill="#cfe8ff"/><path d="M80 50 L80 100 L125 75Z" fill="{CORAL}"/>
<rect x="-40" y="150" width="290" height="22" rx="8" fill="#9a9aa0" stroke="{INK}" stroke-width="6"/></g>'''
edu = person(290, 330, "#7aa45c", HAIR_F, "worry", laptop) + card(590, 120, 5, ["Videograf", "Montajor", "Prezentatsiya dizayner", "Targetolog"]) \
    + f'<text x="830" y="130" font-size="120" font-weight="700" fill="{CORAL}" transform="rotate(12 830 130)">?</text>'

# 2) Shaxsiy brend: telefon, 0 obunachi
phone = f'''<g transform="translate(150,170) rotate(10)"><rect width="190" height="330" rx="26" fill="{INK}"/>
<rect x="12" y="20" width="166" height="290" rx="16" fill="#fff"/><circle cx="95" cy="90" r="38" fill="#e6e6ea" stroke="{INK}" stroke-width="4"/>
<text x="95" y="200" font-size="72" font-weight="700" text-anchor="middle" fill="{INK}">0</text>
<text x="95" y="240" font-size="24" font-weight="700" text-anchor="middle" fill="#888">obunachi</text></g>'''
brand = person(290, 330, "#26324a", HAIR_M, "shock", phone) + card(590, 90, -5, ["Portret fotograf", "Reels yaratuvchi", "Logo dizayner", "Kopirayter"]) \
    + f'<text x="80" y="140" font-size="110" font-weight="700" fill="{INK}" transform="rotate(-10 80 140)">?</text>'

# 3) Restoran: oshpaz/egasi, taqvim 3 kun
hat = f'''<path d="M-80 -95 Q-120 -190 -40 -190 Q0 -250 40 -190 Q120 -190 80 -95 Z" fill="#fff" stroke="{INK}" stroke-width="7"/>
<rect x="-82" y="-110" width="164" height="40" rx="6" fill="#fff" stroke="{INK}" stroke-width="7"/>'''
apron = f'<path d="M-80 200 L80 200 L95 700 L-95 700 Z" fill="#fff" stroke="{INK}" stroke-width="6"/><circle cx="0" cy="260" r="10" fill="{CORAL}"/>'
cal = f'''<g transform="translate(740,40) rotate(6)"><rect width="250" height="270" rx="22" fill="#fff" stroke="{INK}" stroke-width="7"/>
<rect width="250" height="72" rx="22" fill="{CORAL}" stroke="{INK}" stroke-width="7"/>
<text x="125" y="200" font-size="130" font-weight="700" text-anchor="middle" fill="{INK}">3</text>
<text x="125" y="248" font-size="32" font-weight="700" text-anchor="middle" fill="#888">kun</text></g>'''
resto = cal + person(290, 330, "#8a3b2a", HAIR_M, "worry", apron, hat) + card(590, 330, 4, ["Ovqat fotografi", "Menyu dizayneri", "Videograf", "SMM menejer"])

pages = {
    "f_talim": ("Onlayn kurs ochmoqchisiz.", "Kim kerak?", edu),
    "f_brend": ("Shaxsiy brend.<br>0 obunachi.", "Kim kerak?", brand),
    "f_resto": ("Restoran ochilishiga 3 kun.", "Kim kerak?", resto),
}
for k, (t, a, s) in pages.items():
    (OUT / f"{k}.html").write_text(page(t, a, s))
print("ok")
