import os,json,subprocess,sys
tok=os.environ["MARKETING_BOT_TOKEN"]; A=f"https://api.telegram.org/bot{tok}"
ids=json.load(open("ids3d.json")) if os.path.exists("ids3d.json") else {}
for i,key in enumerate(sys.argv[1:]):
    subprocess.run(["python3","sfx.py",f"a-{key}.wav","16",str(10+i)],check=True)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"v-{key}.mp4","-i",f"a-{key}.wav","-c:v","copy","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",f"f-{key}.mp4"],check=True)
    r={}
    for attempt in range(3):
      try: r=json.loads(subprocess.run(["curl","-sS","-m","600","-X","POST",f"{A}/sendVideo","--form-string","chat_id=1643026769","--form-string","disable_notification=true",
      "--form-string",f"caption=Ko'rib chiqish: {key} (bugun kanalga chiqadi)","--form-string","supports_streaming=true","--form-string","width=720","--form-string","height=1280","--form-string","duration=16",
      "-F",f"video=@f-{key}.mp4"],capture_output=True,text=True).stdout)
      except Exception: r={"description":"javob JSON emas"}
      if r.get("ok"): break
    if r.get("ok"): ids[key]=r["result"]["video"]["file_id"]; print(key,"yuklandi")
    else: print(key,"XATO",r.get("description"))
json.dump(ids,open("ids3d.json","w"))
