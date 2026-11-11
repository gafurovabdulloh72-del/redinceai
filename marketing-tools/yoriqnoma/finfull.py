import json,sys,subprocess
name=sys.argv[1]; fl_dir=sys.argv[2] if len(sys.argv)>2 else f"fl-{name}"; m=json.load(open(f"{fl_dir}/marks.json")); IN=float(__import__("os").environ.get("INTRO","1.8")); fl=m["frames"]/30
ev={"dur":round(IN+fl+3.0,2),"end":round(IN+fl+0.1,2),"cuts":[IN-0.25]+[IN+c["frame"]/30-0.2 for c in m["caps"][1:]][:6],"caps_in":[IN+c["frame"]/30 for c in m["caps"]][:8],"words_in":[],"ui":[IN+t["frame"]/30 for t in m["taps"]]}
json.dump(ev,open(f"ev-{name}.json","w"))
subprocess.run(["python3","sfx2.py",f"a-{name}.wav",f"ev-{name}.json","5"],check=True)
subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"v-{name}.mp4","-i",f"a-{name}.wav","-c:v","copy","-c:a","aac","-b:a","160k","-ar","48000","-shortest","-movflags","+faststart",f"final-{name}.mp4"],check=True)
print("ok", ev["dur"])
