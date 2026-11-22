# python3 tgpost.py KEY  — videoni Telegram kanalga (muqova + tugmalar) yuboradi; message_id ni chiqaradi. Token muhitda (chiqarilmaydi).
import json, os, subprocess, sys, pathlib, html
H = pathlib.Path(__file__).parent; k = sys.argv[1]
T = os.environ["MARKETING_BOT_TOKEN"]; CH = os.environ["MARKETING_CHANNEL"]; A = f"https://api.telegram.org/bot{T}"
c = json.loads((H / f"{k}.json").read_text())
lines = [l for l in (H / f"caps/{k}.txt").read_text().strip().split("\n") if l.strip() != "Havola profilda."]
while lines and not lines[-1].strip(): lines.pop()
tags = lines.pop() if lines and lines[-1].startswith("#") else ""
body = "\n".join(lines).strip().replace(" Izohda yozing.", "")  # kanalda izoh yo'q
first, _, rest = body.partition("\n")
cap = f"<b>{html.escape(first, quote=False)}</b>\n{html.escape(rest, quote=False)}\n\n{tags}\nRo'yxatdan o'tish: @kasb_egalari_bot".replace("\n\n\n", "\n\n")
pov = k.startswith("pov-")
btn = ("📂 Portfolio joylash", "https://kasbegalari.vercel.app/kabinet/portfolio") if pov else ("🔎 Ijodkor izlash", "https://kasbegalari.vercel.app/mutaxassislar")
kb = json.dumps({"inline_keyboard": [[{"text": "📝 Ro'yxatdan o'tish", "url": "https://t.me/kasb_egalari_bot?start=reg"}], [{"text": btn[0], "url": btn[1]}]]}, ensure_ascii=False)
vid = H / f"video/{k}.mp4"; cov = pathlib.Path("/tmp") / f"kk-cov-{k}.jpg"
subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-ss", str(c.get("thumb_ms", 8000) / 1000), "-i", str(vid), "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", str(cov)], check=True)
dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(vid)], capture_output=True, text=True).stdout.strip()
args = ["curl", "-sS", "-m", "300", "-X", "POST", f"{A}/sendVideo", "-F", f"video=@{vid}", "-F", f"cover=@{cov}", "-F", f"thumbnail=@{cov}"]
for kk, v in {"chat_id": CH, "caption": cap, "parse_mode": "HTML", "reply_markup": kb, "supports_streaming": "true",
              "duration": str(round(float(dur))), "width": "1080", "height": "1920"}.items():
    args += ["--form-string", f"{kk}={v}"]
r = json.loads(subprocess.run(args, capture_output=True, text=True).stdout or "{}")
if r.get("ok"): print("TGOK", r["result"]["message_id"])
else: print("TGXATO", r.get("description")); sys.exit(1)
