"""Trigger prompti: trigger_head.txt + BANK (faqat file_id'si tayyor yozuvlar).
  python3 build_bank.py week-final.json > trigger_prompt.txt
"""
import json, sys, os
head = open("trigger_head.txt").read()
ids = json.load(open("ids-v3.json"))
posts = [json.load(open("welcome.json"))]
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]): posts += json.load(open(sys.argv[1]))["posts"]
skip = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else set()
out = [head]; n = 0
for p in posts:
    pid = p["id"]
    if pid in skip: continue
    date = "2026-" + pid[:5]; slot = pid[5]
    lines = [f"=== {date} | {slot} | {pid}", f"kind: {p['kind']}"]
    if p["kind"] in ("poll", "quiz"):
        q = p["poll"]
        lines += [f"question: {q['question']}", "options: " + json.dumps([{"text": o} for o in q["options"]], ensure_ascii=False)]
        if p["kind"] == "quiz": lines += [f"correct_option_id: {q['correctIndex']}", f"explanation: {q.get('explanation', '')}"]
        lines.append("silent: true")
    else:
        i = ids.get(pid)
        if not i: continue  # media hali tayyor emas
        if p["kind"] == "video":
            lines.append(f"video: {i['video']}")
            if i.get("cover"): lines.append(f"cover: {i['cover']}")
        else:
            lines.append(f"photo: {i['photo']}")
        lines += [f"btn2: {p['button2Label']}", f"url2: {p['button2Url']}"]
        if p.get("silent"): lines.append("silent: true")
        if p.get("pin"): lines.append("pin: true")
        if p.get("description"): lines.append(f"description: {p['description']}")
        if pid == "11-10B": lines.append("preview: tayyor")
        lines += ["MATN:", p["captionHtml"]]
    out.append("\n".join(lines)); n += 1
out.append("=== BANK TUGADI")
sys.stdout.write("\n\n".join(out) + "\n")
sys.stderr.write(f"{n} yozuv\n")
