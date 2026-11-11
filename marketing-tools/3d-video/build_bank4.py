import json, sys
head = open("trigger_head4.txt").read(); ids = json.load(open("ids-v3.json"))
posts = {p["id"]: p for p in json.load(open("week-list.json"))}
for f in sys.argv[2:]:
    for p in json.load(open(f))["posts"]: posts[p["id"]] = p
sched = json.load(open(sys.argv[1]))  # [[date, slot, id], ...]
out = [head]; n = 0
for date, slot, pid in sched:
    p = posts[pid]; L = [f"=== {date} | {slot} | {pid}"]
    if p["kind"] in ("poll", "quiz"):
        q = p["poll"]; L += [f"kind: {p['kind']}", f"question: {q['question']}", "options: " + json.dumps([{"text": o} for o in q["options"]], ensure_ascii=False)]
        if p["kind"] == "quiz": L += [f"correct_option_id: {q['correctIndex']}", f"explanation: {q.get('explanation','')}"]
        L.append("silent: true")
    else:
        i = ids.get(pid)
        if not i: sys.stderr.write(f"media yo'q: {pid}\n"); continue
        if "video" in i: L += ["kind: video", f"video: {i['video']}"] + ([f"cover: {i['cover']}"] if i.get("cover") else [])
        else: L += ["kind: photo", f"photo: {i['photo']}"]
        L += [f"btn2: {p['button2Label']}", f"url2: {p['button2Url']}", "MATN:", p["captionHtml"]]
    out.append("\n".join(L)); n += 1
out.append("=== BANK TUGADI"); sys.stdout.write("\n\n".join(out) + "\n"); sys.stderr.write(f"{n} yozuv\n")
