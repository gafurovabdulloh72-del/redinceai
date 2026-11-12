# python3 igbatch.py [interval_s] [max_minutes] — navbatdagi videolarni Instagram'ga Reels qilib joylaydi
import json, os, re, html, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); S = os.path.dirname(HERE)
IV = int(sys.argv[1]) if len(sys.argv) > 1 else 360; MAXM = int(sys.argv[2]) if len(sys.argv) > 2 else 120
LOG = os.path.join(HERE, 'iglog.txt'); DONE = os.path.join(HERE, 'igposted.json')
done = json.load(open(DONE)) if os.path.exists(DONE) else {}
BAN = ["hech kim","minglab","hammasi tayyor","bepul profil","profil ochish bepul","qotib qoldingizmi","qayerdan topadi","yo'qolyaptimi","topilmayapsizmi","vaqtingiz yo'qmi","kasb egalari'da:","ko'pincha","mobilograf","—","–"]
def igcap(h):
    t = re.sub(r'<br\s*/?>', '\n', h); t = re.sub(r'<[^>]+>', '', t); t = html.unescape(t)
    t = t.replace("Ro'yxatdan o'tish: @kasb_egalari_bot", "Ro'yxatdan o'tish: Telegramda kasb_egalari_bot. Havola profilda.")
    t = re.sub(r'@kasb_egalari_bot', 'kasb_egalari_bot (Telegram)', t); t = re.sub(r'@kasb_egalari\b', 'kasb_egalari (Telegram)', t)
    tags = re.findall(r'#\w+', t); extra = [x for x in ['#kasbegalari', '#ijodkorlar', '#frilans', '#uzbekistan'] if x not in tags]
    t = t.rstrip() + '\n\n' + ' '.join(extra)
    return t[:2150]
def log(m):
    open(LOG, 'a').write(time.strftime('%H:%M:%S ') + m + '\n'); print(m, flush=True)
# navbat: NEON, keyin Telegram'da chiqqan motion'lar, keyin qolgan motion'lar
items = []
neon = [('narx', 'neon/neon-pack-v4.mp4', 'nv/cap-narx.txt'), ('xarita', 'neon/neon-xarita.mp4', 'nv/cap-xarita.txt')] + \
       [(k, f'neon/nv-{k}.mp4', f'nv/caps/{k}.txt') for k in ['mentorlik', 'top3', 'story', 'portfolio', 'qadamlar', 'tayyorlik', 'royxat', 'takliflar', 'vakansiya']]
for k, v, c in neon: items.append(dict(id='nv_' + k, src=os.path.join(S, v), cap=open(os.path.join(S, c)).read(), thumb=5250))
q = json.load(open('/home/user/redinceai/marketing-tools/navbat/navbat.json'))
posted = json.load(open('/home/user/redinceai/marketing-tools/navbat/posted.json'))
pids = posted if isinstance(posted, list) else list(posted.keys())
order = [i for i in pids] + [x['id'] for x in q if x['id'] not in pids]
byid = {x['id']: x for x in q}
for i in order:
    x = byid.get(i); p = os.path.join(S, 'motion', f'm-{i}.mp4')
    if x and x.get('kind') == 'video' and os.path.exists(p): items.append(dict(id='m_' + i, src=p, cap=x['caption'], thumb=3400))
# 9:16 yo'riqnomalar motion'lar bilan navbatma-navbat
V916 = os.path.join(HERE, 'v916'); vt = []
for f in sorted(os.listdir(V916)):
    if f.endswith('.mp4'): k = f[:-4]; vt.append(dict(id='v_' + k, src=os.path.join(V916, f), cap=open(os.path.join(V916, k + '.cap.txt')).read(), thumb=4000))
neon_items = [x for x in items if x['id'].startswith('nv_')]; mo = [x for x in items if x['id'].startswith('m_')]
mix = []
while vt or mo:
    if vt: mix.append(vt.pop(0))
    if mo: mix.append(mo.pop(0))
items = neon_items + mix
t0 = time.time(); n = 0
for it in items:
    if it['id'] in done: continue
    if time.time() - t0 > MAXM * 60: log('vaqt tugadi'); break
    cap = igcap(it['cap'])
    if any(b in cap.lower() for b in BAN): log('SKIP ban ' + it['id']); done[it['id']] = 'skip'; continue
    vid = os.path.join(HERE, 'v.mp4')
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', it['src'], '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', vid], check=True)
    cf = os.path.join(HERE, 'cap.txt'); open(cf, 'w').write(cap)
    r = subprocess.run(['python3', os.path.join(HERE, 'igpost.py'), vid, cf, str(it['thumb'])], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    m = re.search(r"'permalink': '([^']+)'", r.stdout)
    if m:
        done[it['id']] = m.group(1); n += 1; log(f'OK {it["id"]} {m.group(1)}')
    else:
        log(f'XATO {it["id"]} ' + (r.stdout[-400:] + r.stderr[-200:]).replace('\n', ' | '))
        if 'rate' in r.stdout.lower() or 'limit' in r.stdout.lower(): time.sleep(900)
    json.dump(done, open(DONE, 'w'), ensure_ascii=False, indent=0)
    time.sleep(IV)
log(f'TAMOM: {n} ta joylandi')
