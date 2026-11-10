"""Kanaldagi eski postlarni tuzatish (editMessageCaption / editMessageText / editMessageMedia).
  python3 apply_retro.py retro.json check      # faqat tekshiruv
  python3 apply_retro.py retro.json apply      # kanalda tahrirlash
retro.json: [{id, needsEdit, captionHtml, button2Label, button2Url, changes}]
"""
import os, sys, json, re, subprocess
from publish2 import BANNED, curl, A, CH
TAIL_RE = re.compile(r"\n#[a-z_]+\nRo'yxatdan o'tish: @kasb_egalari_bot$")
SKIP = {2, 4}                      # egasining o'z postlari
TEXT_POSTS = {5}                   # oddiy matnli post
MEDIA_FIX = {17: "p1", 19: "p2", 20: "p3", 21: "p4", 22: "p5", 23: "p6"}  # videosi qayta chizilgan

def lint(p):
    e = []; cap = p["captionHtml"]
    for w in BANNED:
        if w.lower() in cap.lower(): e.append(f"taqiqlangan: {w!r}")
    if not TAIL_RE.search(cap): e.append("dum formati")
    if not cap.startswith("<b>"): e.append("<b> bilan boshlanmaydi")
    if "’" in cap or "‘" in cap: e.append("egri apostrof")
    if len(re.sub(r"<[^>]+>", "", cap)) > 1000: e.append("1000 belgidan uzun")
    if not p.get("button2Url", "").startswith("https://kasbegalari.vercel.app"): e.append("button2Url")
    return e

def kb(p):
    return json.dumps({"inline_keyboard": [[{"text": "📝 Ro'yxatdan o'tish", "url": "https://t.me/kasb_egalari_bot?start=reg"}],
                                           [{"text": p["button2Label"], "url": p["button2Url"]}]]}, ensure_ascii=False)

if __name__ == "__main__":
    posts = json.load(open(sys.argv[1])); mode = sys.argv[2]
    bad = 0
    for p in posts:
        if p["id"] in SKIP: continue
        e = lint(p)
        if e: bad += 1; print(p["id"], "XATO:", "; ".join(e))
    print(f"{len(posts) - bad}/{len(posts)} toza")
    if mode != "apply" or bad: sys.exit(1 if bad else 0)
    for p in sorted(posts, key=lambda x: x["id"]):
        mid = p["id"]
        if mid in SKIP: continue
        if mid in MEDIA_FIX and os.path.exists(f"vfixa-{MEDIA_FIX[mid]}.mp4"):
            k = MEDIA_FIX[mid]
            media = {"type": "video", "media": "attach://v", "caption": p["captionHtml"], "parse_mode": "HTML", "supports_streaming": True,
                     "width": 720, "height": 1280, "duration": 16}
            files = {"v": f"vfixa-{k}.mp4"}
            if os.path.exists(f"coverfix-{k}.jpg"): media["cover"] = "attach://c"; files["c"] = f"coverfix-{k}.jpg"
            r = curl("editMessageMedia", {"chat_id": CH, "message_id": str(mid), "media": json.dumps(media, ensure_ascii=False), "reply_markup": kb(p)}, files)
        elif mid in TEXT_POSTS:
            r = curl("editMessageText", {"chat_id": CH, "message_id": str(mid), "text": p["captionHtml"], "parse_mode": "HTML", "reply_markup": kb(p), "link_preview_options": json.dumps({"is_disabled": True})})
        else:
            r = curl("editMessageCaption", {"chat_id": CH, "message_id": str(mid), "caption": p["captionHtml"], "parse_mode": "HTML", "reply_markup": kb(p)})
        print(mid, "ok" if r.get("ok") else "XATO", r.get("description", ""))
