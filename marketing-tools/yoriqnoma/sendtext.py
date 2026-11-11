import json,subprocess,os,sys
T=os.environ["MARKETING_BOT_TOKEN"]; CH=os.environ["MARKETING_CHANNEL"]; A=f"https://api.telegram.org/bot{T}"
def call(m,d):
    a=["curl","-sS","-m","120","-X","POST",f"{A}/{m}"]
    for k,v in d.items(): a+=["--form-string",f"{k}={v}"]
    return json.loads(subprocess.run(a,capture_output=True,text=True).stdout)
mode=sys.argv[1]; txt=open(sys.argv[2]).read().strip(); assert "—" not in txt and "–" not in txt
kb=json.dumps({"inline_keyboard":[[{"text":"📝 Ro'yxatdan o'tish","url":"https://t.me/kasb_egalari_bot?start=reg"}],[{"text":sys.argv[3],"url":sys.argv[4]}]]},ensure_ascii=False)
lp=json.dumps({"is_disabled":True})
if mode=="send":
    r=call("sendMessage",{"chat_id":CH,"text":txt,"parse_mode":"HTML","reply_markup":kb,"link_preview_options":lp,"disable_notification":"true"}); print(r.get("ok"),r.get("result",{}).get("message_id"),r.get("description",""))
    if r.get("ok") and len(sys.argv)>5 and sys.argv[5]=="pin":
        p=call("pinChatMessage",{"chat_id":CH,"message_id":str(r["result"]["message_id"]),"disable_notification":"true"}); print("pin",p.get("ok"),p.get("description",""))
else:
    r=call("editMessageText",{"chat_id":CH,"message_id":mode,"text":txt,"parse_mode":"HTML","reply_markup":kb,"link_preview_options":lp}); print(r.get("ok"),r.get("description",""))
