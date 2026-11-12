import json
def W(s):  # "so'z* so'z" -> [[so'z,'b'],[so'z,'t']]; '*' = qalin, '~' = o'rta
    out=[]
    for w in s.split():
        if w.endswith('*'): out.append([w[:-1],'b'])
        elif w.endswith('~'): out.append([w[:-1],'r'])
        else: out.append([w,'t'])
    return out
V = {
 "kasblar": dict(s1="har bir kasb* egasi uchun", top="platformada*", value=94, bottom="xil~ kasb*",
   stack=["videografdan","dasturchigacha,*","marketologgacha"], textA="11* ta yo'nalish bo'yicha", textB=["kasbingizni* tanlang","qidiruvda* chiqasiz"],
   s5="siz", slot=["MARKETOLOG","VIDEOGRAF","MONTAJOR","FOTOGRAF"], ins="bo'lsangiz ham", badgeBig="grid", badgeA="grid", badgeS="search",
   cardsA=["k2-hero.jpg","k2-kasb.jpg"], cardsB=["k2-hero.jpg","k2-kasb.jpg","k2-roles.jpg"]),
 "mentorlik": dict(s1="bilimingizni* kursga aylantiring", top="kurs* sotuvidan~", value=85, suffix="%", bottom="ustozga* qoladi~",
   stack=["ustoz sahifasi,","kurslar* va","jonli efirlar"], textA="platforma komissiyasi 15%*", textB=["darslar,* testlar","va sertifikat*"],
   s5="kurslar:", slot=["SMM","MONTAJ","DIZAYN","MOTION"], ins="va boshqalar", badgeBig="cap", badgeA="cap", badgeS="play",
   cardsA=["k2-mentor.jpg","k2-kmentor.jpg"], cardsB=["k2-mentor.jpg","k2-kmentor.jpg","k2-onboard.jpg"]),
 "top3": dict(s1="har oy eng faol* ijodkorlar", top="oyning* top*", value=3, bottom="ijodkori~",
   stack=["postlaringizga","reaksiya,* izoh","va obunachilar"], textA="oyning oxirgi kuni e'lon* qilinadi", textB=["g'oliblarga* keyingi oy","pro* sovg'a"],
   s5="top-3:", slot=["1-O'RIN","3-O'RIN","2-O'RIN","1-O'RIN"], ins="sizniki bo'lsin", badgeBig="crown", badgeA="crown", badgeS="star",
   cardsA=["k2-top.jpg","k-reels.jpg"], cardsB=["k2-top.jpg","k-reels.jpg","k2-narxsp.jpg"]),
 "story": dict(s1="kuningizni story* bilan ulashing", top="story*", value=24, bottom="soat* yashaydi~",
   stack=["musiqa,* fon","va reaksiyalar","bitta oynada"], textA="kim ko'rganini* bilasiz", textB=["javob* va yurakcha","chatga keladi*"],
   s5="haftasiga:", slot=["40 TA","4 TA","14 TA","40 TA"], ins="gacha story", badgeBig="eye", badgeA="eye", badgeS="send",
   cardsA=["k2-story.jpg","k-reels.jpg"], cardsB=["k2-story.jpg","k-reels.jpg","k2-onboard.jpg"]),
 "portfolio": dict(s1="eng yaxshi* ishlaringiz bir joyda", top="portfolioda*", value=60, bottom="tagacha~ ish*",
   stack=["video,* rasm","va loyihalar","profilingizda"], textA="mijoz ishingizni* ko'radi", textB=["standart 12,* pro 30*","max tarifda 60*"],
   s5="tarif:", slot=["MAX","STANDART","PRO","MAX"], ins="60 ta ish", badgeBig="grid", badgeA="play", badgeS="grid",
   cardsA=["k2-portfolio.jpg","k2-narxsp.jpg"], cardsB=["k2-portfolio.jpg","k2-narxsp.jpg","k2-kprofil.jpg"]),
 "qadamlar": dict(s1="profilingizni to'g'ri* boshlang", top="birinchi* qadamlar~", value=7, bottom="ta~ qadam*",
   stack=["rasm,* tavsif,","portfolio va","birinchi post"], textA="bosh sahifada yo'riqnoma*", textB=["har qadam* bitta tugma","bilan bajariladi*"],
   s5="qadam:", slot=["TELEGRAM","RASM","PORTFOLIO","POST"], ins="va boshqalar", badgeBig="check", badgeA="check", badgeS="spark",
   cardsA=["k2-onboard.jpg","k2-meter.jpg"], cardsB=["k2-onboard.jpg","k2-meter.jpg","k2-kprofil.jpg"]),
 "tayyorlik": dict(s1="profilingiz qanchalik tayyor?*", top="profil* tayyorligi~", value=100, suffix="%", bottom="bo'lsin~",
   stack=["halqa* sizga","keyingi qadamni","ko'rsatadi"], textA="kabinetda foiz* ko'rinadi", textB=["to'liq* profil","ishonch* uyg'otadi"],
   s5="qadam:", slot=["2FA","RASM","TAVSIF","PORTFOLIO"], ins="qo'shing", badgeBig="gauge", badgeA="gauge", badgeS="user",
   cardsA=["k2-kabinet.jpg","k2-meter.jpg"], cardsB=["k2-kabinet.jpg","k2-meter.jpg","k2-kprofil.jpg"]),
 "royxat": dict(s1="ro'yxatdan o'tish* oson", top="atigi*", value=3, bottom="qadam*",
   stack=["rol,* kasb","va hisob","bitta ekranda"], textA="mijoz yoki mutaxassis*", textB=["telegram* yoki google*","bilan kirish"],
   s5="siz", slot=["MIJOZ","MUTAXASSIS","MIJOZ","MUTAXASSIS"], ins="bo'lib kirasiz", badgeBig="user", badgeA="user", badgeS="check",
   cardsA=["k2-roles.jpg","k2-kasb.jpg"], cardsB=["k2-roles.jpg","k2-kasb.jpg","k2-hero.jpg"]),
 "takliflar": dict(s1="mos e'lonlarga* taklif yuboring", top="kuniga*", value=50, bottom="tagacha~ taklif*",
   stack=["standart,","pro* va max*","tariflarda"], textA="yangi e'lon* telegramga keladi", textB=["max* navbatda","birinchi* bo'ladi"],
   s5="kuniga:", slot=["50","5","20","50"], ins="ta taklif", badgeBig="send", badgeA="send", badgeS="brief",
   cardsA=["k2-narxpm.jpg","k2-vak.jpg"], cardsB=["k2-narxpm.jpg","k2-vak.jpg","k2-narxsp.jpg"]),
 "vakansiya": dict(s1="onlayn kasblar* uchun vakansiyalar", top="vakansiyalarda*", value=11, bottom="ta~ yo'nalish*",
   stack=["it,* dizayn,","video va","marketing"], textA="ariza* yuboring", textB=["yoki rezyume*","joylang"],
   s5="format:", slot=["OFIS","MASOFAVIY","GIBRID","OFIS"], ins="tanlang", badgeBig="brief", badgeA="brief", badgeS="search",
   cardsA=["k2-vak.jpg","k2-rez.jpg"], cardsB=["k2-vak.jpg","k2-rez.jpg","k2-narxpm.jpg"]),
}
for k,v in V.items():
    c=dict(s1=W(v['s1']), top=W(v['top']), bottom=W(v['bottom']), value=v['value'], suffix=v.get('suffix',''), numSize=130 if v['value']<1000 else 70,
           stack=[W(x) for x in v['stack']], textA=W(v['textA']), textB=[W(x) for x in v['textB']], s5=W(v['s5']), slot=v['slot'], ins=W(v['ins']),
           badgeBig={"icon":v['badgeBig']}, badgeA={"icon":v['badgeA']}, badgeS={"icon":v['badgeS']}, cardsA=v['cardsA'], cardsB=v['cardsB'])
    json.dump(c, open(f'cfg-{k}.json','w'), ensure_ascii=False)
print(list(V))
