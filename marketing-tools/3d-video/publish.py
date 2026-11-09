import os,json,subprocess,sys
key=sys.argv[1]; video=sys.argv[2]
tok=os.environ["MARKETING_BOT_TOKEN"]; ch=os.environ["MARKETING_CHANNEL"]; A=f"https://api.telegram.org/bot{tok}"
c=json.loads(subprocess.run(["curl","-sS","-m","30","-X","POST",f"{A}/getChat","--data-urlencode",f"chat_id={ch}"],capture_output=True,text=True).stdout)
if not c.get("ok") or c["result"].get("title","").lower()!="kasb egalari": sys.exit("kanal mos emas, yuborilmadi")
BLOCK="\n\n⚡ Tezda ro'yxatdan o'tish: @kasb_egalari_bot\n👉 https://t.me/kasb_egalari_bot?start=reg\n📢 Kanalimiz: @kasb_egalari"
text=json.load(open("posts.json"))[key]+BLOCK
assert len(text)<1024 and "—" not in text, len(text)
p=subprocess.run(["curl","-sS","-m","300","-X","POST",f"{A}/sendVideo","--form-string",f"chat_id={ch}","--form-string","parse_mode=HTML","--form-string",f"caption={text}",
 "--form-string","supports_streaming=true","--form-string","width=720","--form-string","height=1280","--form-string","duration=16","-F",f"video=@{video}"],capture_output=True,text=True)
r=json.loads(p.stdout); print(key,"ok:",r.get("ok"),"message_id:",r.get("result",{}).get("message_id"),r.get("description",""),"| belgi:",len(text))
if r.get("ok"): print("file_id:",r["result"]["video"]["file_id"])
