import json,subprocess,os,sys
T=os.environ["MARKETING_BOT_TOKEN"]; CH=os.environ["MARKETING_CHANNEL"]; A=f"https://api.telegram.org/bot{T}"
mid,vid,cover,capfile,btn,url,dur=sys.argv[1:8]
cap=open(capfile).read().strip(); assert "—" not in cap and "–" not in cap
kb=json.dumps({"inline_keyboard":[[{"text":"📝 Ro'yxatdan o'tish","url":"https://t.me/kasb_egalari_bot?start=reg"}],[{"text":btn,"url":url}]]},ensure_ascii=False)
media=json.dumps({"type":"video","media":"attach://v","cover":"attach://c","caption":cap,"parse_mode":"HTML","supports_streaming":True,"width":1920,"height":1080,"duration":int(dur)},ensure_ascii=False)
a=["curl","-sS","-m","600","-X","POST",f"{A}/editMessageMedia"]
for k,v in {"chat_id":CH,"message_id":mid,"media":media,"reply_markup":kb}.items(): a+=["--form-string",f"{k}={v}"]
a+=["-F",f"v=@{vid}","-F",f"c=@{cover}"]
r=json.loads(subprocess.run(a,capture_output=True,text=True).stdout); print(r.get("ok"),r.get("description",""))
