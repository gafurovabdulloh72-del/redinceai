/**
 * JSON-LD'ni `<script type="application/ld+json">` ichiga XAVFSIZ joylash (7-audit, 2026-11-10).
 *
 * `JSON.stringify` `<` belgisini qochirmaydi: foydalanuvchi matnida (savol sarlavhasi, maqola nomi, ism…)
 * `</script><script>…` bo'lsa, brauzer skript tegini yopib, qolganini HTML sifatida o'qiydi — saqlangan XSS.
 * Ikki sahifada qochirish hech narsa qilmaydigan `.replace(/</g, "<")` bo'lib qolgan edi. Shuning uchun endi
 * BITTA yordamchi: JSON-LD chiqaradigan har joy `jsonLdHtml()` dan foydalanadi — qo'lda `.replace` yozilmaydi.
 * `<`, `>`, `&` va JS satr ajratgichlari (U+2028 / U+2029) \uXXXX ko'rinishida — JSON ma'nosi o'zgarmaydi.
 */
const UNSAFE: Record<string, string> = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", [String.fromCharCode(0x2028)]: "\\u2028", [String.fromCharCode(0x2029)]: "\\u2029" };
const UNSAFE_RE = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE_RE, (c) => UNSAFE[c] ?? c);
}
