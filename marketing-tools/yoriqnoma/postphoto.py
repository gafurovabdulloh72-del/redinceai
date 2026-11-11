import json,subprocess,os,sys
T=os.environ["MARKETING_BOT_TOKEN"]; CH=os.environ["MARKETING_CHANNEL"]; A=f"https://api.telegram.org/bot{T}"
img,capfile,btn,url=sys.argv[1:5]
cap=open(capfile).read().strip(); assert "—" not in cap and "–" not in cap
kb=json.dumps({"inline_keyboard":[[{"text":"📝 Ro'yxatdan o'tish","url":"https://t.me/kasb_egalari_bot?start=reg"}],[{"text":btn,"url":url}]]},ensure_ascii=False)
a=["curl","-sS","-m","300","-X","POST",f"{A}/sendPhoto"]
for k,v in {"chat_id":CH,"caption":cap,"parse_mode":"HTML","reply_markup":kb,"disable_notification":"true"}.items(): a+=["--form-string",f"{k}={v}"]
a+=["-F",f"photo=@{img}"]
r=json.loads(subprocess.run(a,capture_output=True,text=True).stdout); print(r.get("ok"),r.get("result",{}).get("message_id"),r.get("description",""))
