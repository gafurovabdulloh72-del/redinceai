/**
 * Parol kuchi (izomorf — brauzerda ham, serverda ham ishlaydi, kutubxonasiz).
 * Siyosat (validators.strongPassword): kamida 8 belgi, harf + raqam.
 * score: 0 (bo'sh) … 4 (juda kuchli). 2 — siyosatga mos minimal daraja.
 */
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string;
  /** Siyosatga mos keladimi (8+, harf va raqam) */
  valid: boolean;
}

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "", hint: "Kamida 8 ta belgi, harf va raqam", valid: false };

  const len = pw.length;
  const hasLetter = /[a-zA-ZЀ-ӿ]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasMixedCase = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const hasSymbol = /[^\w\s]/.test(pw);
  const valid = len >= 8 && /[a-zA-Z]/.test(pw) && hasDigit;

  if (!valid) {
    if (len < 8) return { score: 1, label: "Juda qisqa", hint: `Yana ${8 - len} ta belgi kerak`, valid };
    if (!hasDigit) return { score: 1, label: "Zaif", hint: "Kamida bitta raqam qo'shing", valid };
    if (!hasLetter) return { score: 1, label: "Zaif", hint: "Kamida bitta harf qo'shing", valid };
  }

  let score = 2;
  if (len >= 12) score++;
  if ((hasMixedCase || hasSymbol) && len >= 10) score++;
  if (/^(.)\1+$/.test(pw) || /^(?:1234|abcd|qwer|password|parol)/i.test(pw)) score = Math.min(score, 2);

  const s = Math.min(4, score) as 2 | 3 | 4;
  const meta = {
    2: { label: "O'rtacha", hint: "Uzunroq qiling yoki katta harf / belgi qo'shing" },
    3: { label: "Yaxshi", hint: "Yaxshi parol — 12+ belgi va belgilar bilan yanada kuchli" },
    4: { label: "Kuchli", hint: "Zo'r! Bu parolni boshqa saytlarda ishlatmang" },
  }[s];
  return { score: s, label: meta.label, hint: meta.hint, valid: true };
}
