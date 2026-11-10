"""Nashr vositasi v2: muqova + tugmalar + jim rejim + matn tekshiruvi.
  python3 publish2.py lint posts.json            # faqat tekshiruv
  python3 publish2.py upload posts.json          # video+muqova egasi chatiga (ovozsiz) -> file_id'lar ids.json ga
  python3 publish2.py send posts.json <id> [owner|channel]
"""
import os, sys, json, re, subprocess

TOK = os.environ.get("MARKETING_BOT_TOKEN", ""); CH = os.environ.get("MARKETING_CHANNEL", "")
OWNER = "1643026769"; A = f"https://api.telegram.org/bot{TOK}"
BANNED = ["—", "–", "hech kim", "minglab", "hammasi tayyor", "Bepul profil", "Profil ochish bepul", "qotib qoldingizmi",
          "qayerdan topadi", "yo'qolyaptimi", "topilmayapsizmi", "vaqtingiz yo'qmi", "Kasb Egalari'da:", "ko'pincha", "Mobilograf"]
TAIL_RE = re.compile(r"\n#[a-z_]+\nRo'yxatdan o'tish: @kasb_egalari_bot$")

def lint(p):
    errs = []
    cap = p.get("captionHtml", "") or ""
    if p.get("kind") == "video":
        for w in BANNED:
            if w.lower() in cap.lower() or any(w.lower() in (p.get(k) or "").lower() for k in ("coverHook", "caption2", "caption3", "caption4", "endCta")):
                errs.append(f"taqiqlangan: {w!r}")
        if not TAIL_RE.search(cap): errs.append("tail formati noto'g'ri")
        body = TAIL_RE.sub("", cap)
        if len(body) > 560: errs.append(f"matn uzun: {len(body)}")
        if not cap.startswith("<b>"): errs.append("sarlavha <b> bilan boshlanmaydi")
        for k in ("caption2", "caption3", "caption4"):
            if len((p.get(k) or "").split()) > 7: errs.append(f"{k} 7 so'zdan uzun")
        if len((p.get("coverHook") or "").split()) > 5: errs.append("coverHook 5 so'zdan uzun")
        if "’" in cap or "‘" in cap: errs.append("egri apostrof")
        u = p.get("button2Url", "")
        if not u.startswith("https://kasbegalari.vercel.app"): errs.append(f"button2Url: {u}")
    return errs

def curl(method, fields, files=None):
    args = ["curl", "-sS", "-m", "600", "-X", "POST", f"{A}/{method}"]
    for k, v in fields.items(): args += ["--form-string", f"{k}={v}"]
    for k, v in (files or {}).items(): args += ["-F", f"{k}=@{v}"]
    for attempt in range(3):
        try:
            r = json.loads(subprocess.run(args, capture_output=True, text=True).stdout)
            if r.get("ok") or "retry" not in str(r.get("description", "")).lower(): return r
        except Exception: r = {"ok": False, "description": "javob JSON emas"}
    return r

def buttons(p):
    rows = [[{"text": "📝 Ro'yxatdan o'tish", "url": "https://t.me/kasb_egalari_bot?start=reg"}]]
    if p.get("button2Url"): rows.append([{"text": p.get("button2Label") or "Saytda ko'rish", "url": p["button2Url"]}])
    return json.dumps({"inline_keyboard": rows}, ensure_ascii=False)

if __name__ == "__main__":
    cmd, path = sys.argv[1], sys.argv[2]
    posts = json.load(open(path))
    if cmd == "lint":
        bad = 0
        for p in posts:
            e = lint(p)
            if e: bad += 1; print(p["id"], "XATO:", "; ".join(e))
        print(f"{len(posts) - bad}/{len(posts)} toza"); sys.exit(1 if bad else 0)
    ids = json.load(open("ids-v3.json")) if os.path.exists("ids-v3.json") else {}
    if cmd == "upload":
        for p in posts:
            if p.get("kind") != "video" or p["id"] in ids: continue
            v, c = f"final-{p['id']}.mp4", f"cover-{p['id']}.jpg"
            if not (os.path.exists(v) and os.path.exists(c)): print(p["id"], "fayl yo'q"); continue
            r = curl("sendVideo", {"chat_id": OWNER, "disable_notification": "true", "caption": f"Ko'rib chiqish: {p['id']}", "width": "1080", "height": "1920", "supports_streaming": "true"}, {"video": v, "cover": c})
            if r.get("ok"):
                vd = r["result"]["video"]; ids[p["id"]] = {"video": vd["file_id"], "cover": (vd.get("cover") or [{}])[-1].get("file_id")}
                print(p["id"], "yuklandi"); json.dump(ids, open("ids-v3.json", "w"), indent=1)
            else: print(p["id"], "XATO", r.get("description"))
    if cmd == "send":
        pid, target = sys.argv[3], (sys.argv[4] if len(sys.argv) > 4 else "owner")
        p = next(x for x in posts if x["id"] == pid); chat = CH if target == "channel" else OWNER
        if lint(p): sys.exit("lint xatosi: " + "; ".join(lint(p)))
        silent = "true" if (p.get("silent") or target == "owner") else "false"
        if p["kind"] in ("poll", "quiz"):
            q = p["poll"]; f = {"chat_id": chat, "question": q["question"], "options": json.dumps(q["options"], ensure_ascii=False), "is_anonymous": "true", "disable_notification": silent}
            if p["kind"] == "quiz": f.update({"type": "quiz", "correct_option_id": str(q["correctIndex"]), "explanation": q.get("explanation", "")})
            r = curl("sendPoll", f)
        else:
            i = ids[pid]
            f = {"chat_id": chat, "video": i["video"], "caption": p["captionHtml"], "parse_mode": "HTML", "supports_streaming": "true", "disable_notification": silent, "reply_markup": buttons(p)}
            if i.get("cover"): f["cover"] = i["cover"]
            r = curl("sendVideo", f)
        print(pid, target, "ok:", r.get("ok"), r.get("result", {}).get("message_id"), r.get("description", ""))
