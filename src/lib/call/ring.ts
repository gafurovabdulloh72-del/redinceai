// Qo'ng'iroq ovozlari — Web Audio orqali generatsiya (audio fayl kerak emas).
// incoming (kiruvchi): uch notali ohang, har 2.4 s takrorlanadi.
// outgoing (chiquvchi): klassik "ring-ring" (ikki qisqa signal), har 3 s.
// Autoplay siyosati: qo'ng'iroq bosishdan boshlanadi (gesture bor) — kiruvchida ham sahifada
// avval interaksiya bo'lgani uchun odatda ijozat beriladi; berilmasa jim qoladi (xato tashlamaydi).

type Kind = "incoming" | "outgoing";

let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

function audio(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Bitta nota: sinusoida + yumshoq envelopa (chiqib-tushadi — "chiq" eshitilmasin) */
function beep(ac: AudioContext, freq: number, start: number, dur: number, vol = 0.14) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.setValueAtTime(vol, start + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function playOnce(kind: Kind) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  if (kind === "incoming") {
    // Yengil ko'tariluvchi uch nota
    beep(ac, 587, t, 0.18); // D5
    beep(ac, 740, t + 0.2, 0.18); // F#5
    beep(ac, 880, t + 0.4, 0.26); // A5
  } else {
    // "ring-ring" — ikki qisqa signal
    beep(ac, 440, t, 0.3, 0.1);
    beep(ac, 440, t + 0.42, 0.3, 0.1);
  }
}

/** Takroriy jiringlashni boshlash (avval mavjudi to'xtatiladi) */
export function startRing(kind: Kind) {
  stopRing();
  playOnce(kind);
  loop = setInterval(() => playOnce(kind), kind === "incoming" ? 2400 : 3000);
}

/** Jiringlashni to'xtatish */
export function stopRing() {
  if (loop) {
    clearInterval(loop);
    loop = null;
  }
}
