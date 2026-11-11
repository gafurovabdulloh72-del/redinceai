import json,sys,subprocess,os
d=sys.argv[1]; m=json.load(open(f"{d}/marks.json")); fr=sorted(f for f in os.listdir(d) if f.endswith(".jpg"))
idx=[min(c["frame"]+40,len(fr)-1) for c in m["caps"]]+[len(fr)-1]
args=[]; 
for i in idx: args+=["-i",f"{d}/{fr[i]}"]
n=len(idx); cols=3; rows=(n+cols-1)//cols
fc="".join(f"[{i}:v]scale=640:-1[v{i}];" for i in range(n))+"".join(f"[v{i}]" for i in range(n))+f"xstack=inputs={n}:layout="+"|".join(f"{(i%cols)*640}_{(i//cols)*360}" for i in range(n))+f":fill=black[o]"
subprocess.run(["ffmpeg","-y","-loglevel","error"]+args+["-filter_complex",fc,"-map","[o]","-frames:v","1",sys.argv[2]],check=True)
print(n,[c["text"] for c in m["caps"]])
