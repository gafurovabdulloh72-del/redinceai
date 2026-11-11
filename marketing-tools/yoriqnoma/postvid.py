import json,subprocess,os,sys
T=os.environ["MARKETING_BOT_TOKEN"]; CH=os.environ["MARKETING_CHANNEL"]; A=f"https://api.telegram.org/bot{T}"
vid,cover,capfile,btn,url,dur=sys.argv[1:7]
cap=open(capfile).read().strip(); assert "—" not in cap and "–" not in cap
kb=json.dumps({"inline_keyboard":[[{"text":"📝 Ro'yxatdan o'tish","url":"https://t.me/kasb_egalari_bot?start=reg"}],[{"text":btn,"url":url}]]},ensure_ascii=False)
a=["curl","-sS","-m","600","-X","POST",f"{A}/sendVideo"]
for k,v in {"chat_id":CH,"caption":cap,"parse_mode":"HTML","reply_markup":kb,"supports_streaming":"true","width":"1920","height":"1080","duration":dur,"disable_notification":"true"}.items(): a+=["--form-string",f"{k}={v}"]
a+=["-F",f"video=@{vid}","-F",f"cover=@{cover}"]
r=json.loads(subprocess.run(a,capture_output=True,text=True).stdout); print(r.get("ok"),r.get("result",{}).get("message_id"),r.get("description",""))
