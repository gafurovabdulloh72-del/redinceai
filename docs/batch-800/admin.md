# Admin / Auth / Statik — batch-800 hisoboti (2026-10-18)
Qisqa hisob: A 0 · B 0 · C 0 · D 0 (reja — bajarilgani ✅ bilan belgilanadi)

## A. Yangi funksiyalar (reja)
⬜ Tasdiqlash navbati: filtrlar (yo'nalish/hudud/7+ kun/qidiruv) · ⬜ ommaviy tasdiqlash/rad etish (sabab bilan) · ⬜ qator «⋯» menyusi
⬜ Jamoalar va vakansiyalar moderatsiyasi (API + bo'lim) · ⬜ vakansiya «oldindan to'lov» avto-bayroq · ⬜ jamoa egasini almashtirish
⬜ Spam filtri sozlamalari (so'z/havola) + umumiy `checkSpam()` yordamchisi · ⬜ Efirlar kalendari (barcha kanallar)
⬜ CSV eksport: foydalanuvchilar, mutaxassislar · ⬜ Audit jurnali: matn/nishon bo'yicha qidiruv
⬜ Foydalanuvchiga admin izohi · ⬜ Tizim holati kartasi (DB kechikishi, saqlash, cron, rate-limit)
⬜ Ommaviy xabar: jonli ko'rinish (preview) · ⬜ Telegram bildirishnomalarida turga mos inline tugma
⬜ Shikoyatlar: tur bo'yicha filtr · ⬜ Nizo: qaror oldidan buyurtma jurnali (timeline) · ⬜ Payout navbati: qidiruv/filtr
⬜ Auth: Caps Lock eslatmasi · ⬜ Offline sahifa: aloqa tiklanganda avtomatik qaytish · ⬜ Yordam maqolasi sarlavhalariga chuqur havola
⬜ Smoke testlar yangi endpointlar uchun · ⬜ Admin audit/obunalar loading skeleti

## B. Buglar (reja)
⬜ SectionHeading tekislanmaslik (eyebrow 100px tepada) · ⬜ Statistika→birinchi bo'lim bo'shlig'i · ⬜ Stat kartalar: burchak strelkasi nomuvofiq
⬜ To'lovlar jadvali: «Holat» ustuni yopishqoq «Amallar» ostida qisilib qoladi · ⬜ To'lov filtr segmenti kesiladi
⬜ Scrollspy: sahifa oxirida qisqa bo'lim hech qachon faol bo'lmaydi · ⬜ Langar siljishi (desktopda header yo'q — 112px bo'sh joy)
⬜ loading.tsx skeleti yangi tartibga mos emas · ⬜ sitemap: /haqida yo'q, lastmod har safar «hozir» · ⬜ robots: /chek, /yozish, /tolov yopilmagan
⬜ Auth: email maydoni autoCapitalize/autoFocus · ⬜ ...

## C. Dizayn/animatsiya (reja)
⬜ h1 28–30px, bo'lim sarlavhalari 20–22px · ⬜ Bo'lim kirishi [data-reveal] · ⬜ Menyu pop-in/pop-out (usePresence) · ⬜ Inline tasdiq panellari expand-in
⬜ Stat kartalar: yassi, hairline, ikonka plitkasiz · ⬜ Jadval ikonkalari 16px · ⬜ Scrollspy indikatori harakati

## D. Minimalizm (reja)
⬜ Bo'lim tavsiflari bir jumla · ⬜ Eyebrow takrori olib tashlandi · ⬜ Sozlamalardagi «Hozirgi qiymatlar» dublikat kartasi · ⬜ So'nggi foydalanuvchilarda takroriy bloklash tugmasi
⬜ Amallar klasteri → asosiy + ikkilamchi + «⋯» · ⬜ accent-serif urg'ular adminда yo'q (bitta aksent)
