// kim.html dan umumiy qism (qahramon, yuz, asboblar, gapirish). pov.html ishlatadi.
// «Kim kerak?» seriyasi: daftar varag'i, chizilgan qahramon, ro'yxat belgilanadi, kasb egalari paydo bo'ladi.
// CFG: {topic, l1, l2, items:[{name, prop, color}], main:{body, hair, hat?, prop}, counter:{kind, from|text...}, done, end1, end2}
const INK='#1a1a1c', CORAL='#ff5a36', SKIN='#f6cfaa', PAPER='#fbf8ef';
const cl=x=>x<0?0:x>1?1:x, pr=(t,a,d)=>cl((t-a)/d);
const eo=x=>1-Math.pow(1-x,3), back=x=>{const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const lerp=(a,b,x)=>a+(b-a)*x;
const EVENTS=[]; const ev=(t,type,x)=>EVENTS.push(Object.assign({t:+t.toFixed(3),type},x||{}));
let C;


function eyes(r, blink){ const sy=1-blink*.9; return `<ellipse cx="-38" cy="5" rx="${r}" ry="${r*sy}" fill="${INK}"/><ellipse cx="38" cy="5" rx="${r}" ry="${r*sy}" fill="${INK}"/>`; }
function talkMouth(a, happy){ const ry=5+24*a, rx=happy?30:22;
  return `<ellipse cx="0" cy="${62+ry*.2}" rx="${rx}" ry="${ry}" fill="${INK}"/>${a>.35?`<ellipse cx="0" cy="${62+ry*.75}" rx="${rx*.55}" ry="${ry*.35}" fill="#ff8a7a"/>`:''}`; }
function face(expr, x, talk=0, blink=0){
  if(expr==='happy') return `<path d="M-52 2 Q-38 -14 -24 2 M24 2 Q38 -14 52 2" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
   ${talk>.04?talkMouth(talk,true):`<path d="M-38 48 Q0 96 38 48 Z" fill="${INK}"/><path d="M-22 70 Q0 84 22 70" fill="none" stroke="#ff8a7a" stroke-width="8" stroke-linecap="round"/>`}`;
  if(expr==='dead') return `<path d="M-52 -10 L-24 18 M-24 -10 L-52 18 M24 -10 L52 18 M52 -10 L24 18" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
   <path d="M-34 66 Q-22 54 -10 66 Q2 78 14 66 Q26 54 38 66" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  if(expr==='shock') return `${eyes(12,blink)}
   <path d="M-56 -30 L-20 -40 M56 -30 L20 -40" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><ellipse cx="0" cy="64" rx="17" ry="21" fill="${INK}"/>`;
  return `${eyes(11,blink)}
   <path d="M-58 -28 L-20 -18 M58 -28 L20 -18" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
   ${talk>.04?talkMouth(talk,false):`<path d="M-30 70 Q0 50 30 70" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`}`;
}
const HAIR={
 m:`<path d="M-102 -10 Q-110 -120 0 -126 Q112 -120 102 -10 Q85 -78 0 -72 Q-80 -78 -102 -10Z" fill="${INK}"/>`,
 f:`<path d="M-108 60 Q-130 -125 0 -128 Q130 -125 108 60 Q100 -60 0 -70 Q-95 -60 -108 60Z" fill="#3a2418"/>`,
 cap:`<path d="M-102 -20 Q-100 -125 0 -128 Q100 -125 102 -20 Z" fill="#2f6f8f"/><path d="M60 -40 L170 -30 L160 -10 L70 -15Z" fill="#2f6f8f"/>`,
 bun:`<path d="M-106 40 Q-125 -120 0 -124 Q125 -120 106 40 Q96 -60 0 -66 Q-92 -60 -106 40Z" fill="#5a3a22"/><circle cx="0" cy="-130" r="38" fill="#5a3a22"/>`,
};
const HAT_CHEF=`<path d="M-80 -95 Q-120 -190 -40 -190 Q0 -250 40 -190 Q120 -190 80 -95 Z" fill="#fff" stroke="${INK}" stroke-width="7"/>
<rect x="-82" y="-110" width="164" height="40" rx="6" fill="#fff" stroke="${INK}" stroke-width="7"/>`;

function head(hair, expr, sweat, hat, talk=0, blink=0){
  return `<rect x="-20" y="80" width="40" height="70" fill="#f1c39d" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="0" cy="0" rx="105" ry="115" fill="${SKIN}" stroke="${INK}" stroke-width="7"/>${HAIR[hair]||''}
  <circle cx="-62" cy="40" r="15" fill="#ffb3a7" opacity=".6"/><circle cx="62" cy="40" r="15" fill="#ffb3a7" opacity=".6"/>
  ${face(expr,0,talk,blink)}${hat||''}
  ${sweat>0?`<path transform="translate(102,${-50+sweat*30})" d="M0 0 q12 22 0 34 q-12 -12 0 -34z" fill="#7fc8f8" stroke="${INK}" stroke-width="4" opacity="${1-sweat*.6}"/>`:''}`;
}
// ——— asboblar (kasb belgisi) ———
function prop(k){
  switch(k){
  case 'camera': return `<rect x="-62" y="-40" width="124" height="84" rx="14" fill="${INK}"/><rect x="-30" y="-56" width="44" height="20" rx="5" fill="${INK}"/>
     <circle cx="0" cy="2" r="30" fill="#5b6b80" stroke="#fff" stroke-width="6"/><circle cx="40" cy="-24" r="7" fill="${CORAL}"/>`;
  case 'video': return `<rect x="-70" y="-38" width="104" height="76" rx="12" fill="${INK}"/><path d="M34 -10 L72 -32 L72 32 L34 10Z" fill="${INK}"/>
     <circle cx="-48" cy="-56" r="20" fill="none" stroke="${INK}" stroke-width="8"/><circle cx="0" cy="-56" r="20" fill="none" stroke="${INK}" stroke-width="8"/><circle cx="-50" cy="-14" r="8" fill="${CORAL}"/>`;
  case 'menu': return `<rect x="-52" y="-70" width="104" height="140" rx="8" fill="#fff" stroke="${INK}" stroke-width="6"/>
     <text x="0" y="-36" font-size="24" font-weight="700" text-anchor="middle" fill="${CORAL}">MENYU</text>
     <path d="M-34 -10 H34 M-34 14 H24 M-34 38 H30" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  case 'phone': return `<rect x="-42" y="-74" width="84" height="148" rx="16" fill="${INK}"/><rect x="-34" y="-62" width="68" height="120" rx="8" fill="#fff"/>
     <path d="M0 22 C-30 0 -22 -30 0 -16 C22 -30 30 0 0 22Z" fill="${CORAL}"/>`;
  case 'slides': return `<rect x="-70" y="-56" width="140" height="96" rx="8" fill="#fff" stroke="${INK}" stroke-width="6"/>
     <rect x="-52" y="-2" width="20" height="28" fill="${CORAL}"/><rect x="-24" y="-22" width="20" height="48" fill="#7aa45c"/><rect x="4" y="-36" width="20" height="62" fill="#5f87d6"/>
     <path d="M0 40 L0 70 M-30 76 L30 76" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  case 'target': return `<circle r="56" fill="#fff" stroke="${INK}" stroke-width="6"/><circle r="36" fill="${CORAL}"/><circle r="18" fill="#fff"/><circle r="7" fill="${INK}"/>
     <path d="M70 -70 L4 -4" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M70 -70 l-4 22 l22 -4z" fill="${INK}"/>`;
  case 'scissors': return `<rect x="-70" y="10" width="140" height="40" rx="8" fill="#fff" stroke="${INK}" stroke-width="5"/>
     <rect x="-62" y="18" width="40" height="24" rx="4" fill="#8b7fd1"/><rect x="-16" y="18" width="34" height="24" rx="4" fill="${CORAL}"/><rect x="24" y="18" width="38" height="24" rx="4" fill="#4fa3ad"/>
     <circle cx="-22" cy="-40" r="16" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="22" cy="-40" r="16" fill="none" stroke="${INK}" stroke-width="7"/><path d="M-12 -28 L20 0 M12 -28 L-20 0" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  case 'pen': return `<rect x="-58" y="-62" width="116" height="124" rx="10" fill="#fff" stroke="${INK}" stroke-width="6"/>
     <text x="0" y="16" font-size="64" font-weight="700" text-anchor="middle" fill="${INK}">Aa</text><path d="M30 40 L70 -10 L84 2 L44 52 L26 58Z" fill="${CORAL}" stroke="${INK}" stroke-width="5"/>`;
  case 'logo': return `<rect x="-58" y="-58" width="116" height="116" rx="26" fill="${INK}"/><text x="0" y="22" font-size="70" font-weight="700" text-anchor="middle" fill="#fff">A</text><circle cx="30" cy="-26" r="10" fill="${CORAL}"/>`;
  case 'portrait': return `<rect x="-60" y="-70" width="120" height="140" rx="10" fill="#fff" stroke="${INK}" stroke-width="6"/>
     <circle cx="0" cy="-14" r="26" fill="${SKIN}" stroke="${INK}" stroke-width="4"/><path d="M-38 54 Q0 10 38 54Z" fill="#26324a"/>`;
  case 'laptop': return `<rect x="-90" y="-60" width="180" height="116" rx="12" fill="#2b2b30" stroke="${INK}" stroke-width="6"/><rect x="-76" y="-48" width="152" height="92" rx="6" fill="#cfe8ff"/>
     <path d="M-14 -22 L-14 22 L24 0Z" fill="${CORAL}"/><rect x="-116" y="56" width="232" height="20" rx="8" fill="#9a9aa0" stroke="${INK}" stroke-width="6"/>`;
  case 'mic': return `<rect x="-26" y="-74" width="52" height="92" rx="26" fill="${INK}"/><path d="M-12 -50 H12 M-12 -30 H12 M-12 -10 H12" stroke="#666" stroke-width="5"/>
     <path d="M-44 0 Q-44 48 0 48 Q44 48 44 0" fill="none" stroke="${INK}" stroke-width="7"/><path d="M0 48 V76 M-30 78 H30" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><circle cx="20" cy="-56" r="6" fill="${CORAL}"/>`;
  case 'bag': return `<path d="M-60 -30 H60 L70 70 H-70 Z" fill="${CORAL}" stroke="${INK}" stroke-width="6"/><path d="M-30 -30 Q-30 -76 0 -76 Q30 -76 30 -30" fill="none" stroke="${INK}" stroke-width="7"/>
     <path d="M-20 16 l14 14 l28 -30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  case 'web': return `<rect x="-80" y="-62" width="160" height="124" rx="10" fill="#fff" stroke="${INK}" stroke-width="6"/><path d="M-80 -36 H80" stroke="${INK}" stroke-width="5"/>
     <circle cx="-62" cy="-49" r="5" fill="${CORAL}"/><circle cx="-46" cy="-49" r="5" fill="#ffd36b"/><circle cx="-30" cy="-49" r="5" fill="#7aa45c"/>
     <rect x="-62" y="-20" width="56" height="44" rx="4" fill="#cfe8ff"/><path d="M8 -14 H62 M8 4 H50 M8 22 H58" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><rect x="-62" y="34" width="60" height="18" rx="9" fill="${CORAL}"/>`;
  case 'bot': return `<rect x="-70" y="-58" width="140" height="92" rx="22" fill="#5f87d6" stroke="${INK}" stroke-width="6"/><path d="M-30 34 L-44 66 L0 34Z" fill="#5f87d6" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
     <circle cx="-26" cy="-14" r="11" fill="#fff"/><circle cx="26" cy="-14" r="11" fill="#fff"/><path d="M-22 14 Q0 26 22 14" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M0 -58 V-78" stroke="${INK}" stroke-width="6"/><circle cx="0" cy="-82" r="8" fill="${CORAL}"/>`;
  case 'script': return `<path d="M-56 -70 H40 L60 -50 V70 H-56 Z" fill="#fff" stroke="${INK}" stroke-width="6"/><text x="-40" y="-34" font-size="22" font-weight="700" fill="${CORAL}">SSENARIY</text>
     <path d="M-40 -6 H40 M-40 16 H30 M-40 38 H44" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  case 'motion': return `<circle r="54" fill="#4fa3ad" stroke="${INK}" stroke-width="6"/><path d="M-14 -24 L-14 24 L26 0Z" fill="#fff"/><path d="M-90 -40 Q-70 -60 -60 -30 M70 40 Q90 20 96 50" fill="none" stroke="${CORAL}" stroke-width="7" stroke-linecap="round"/>`;
  case 'book': return `<path d="M0 -50 Q-40 -66 -80 -50 V60 Q-40 44 0 60 Q40 44 80 60 V-50 Q40 -66 0 -50 Z" fill="#fff" stroke="${INK}" stroke-width="6"/><path d="M0 -50 V60" stroke="${INK}" stroke-width="5"/>
     <path d="M-62 -24 H-18 M-62 -2 H-22 M18 -24 H62 M18 -2 H58" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="30" r="10" fill="${CORAL}"/>`;
  }
  return '';
}
// kichik kasb egasi (kirib kelish: x 0..1)
const SPEAK=[]; // [{t0, env, who}]
function talkAt(t, who){ for(const s of SPEAK){ if(s.who!==who) continue; const i=Math.floor((t-s.t0)*50); if(i>=0&&i<s.env.length) return s.env[i]; } return 0; }
function blinkAt(t, off){ const p=(t+off)%3.4; return p<.13?Math.sin(Math.PI*p/.13):0; }
function bg(){
  let s=`<rect width="1080" height="1920" fill="${PAPER}"/>`;
  for(let y=0;y<1920;y+=64) s+=`<rect y="${y}" width="1080" height="2" fill="#dfe7f1"/>`;
  return s+`<rect x="110" width="3" height="1920" fill="#f2a8a0"/>`;
}
