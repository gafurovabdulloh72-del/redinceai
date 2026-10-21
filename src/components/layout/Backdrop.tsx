/**
 * Fon (v5 "Jonli"): --bg + juda xira "aurora" — chap tepada coral, o'ngda binafsha yorug'lik (yorug'da 6–7%, qorong'uda 9–10%).
 * Iliqlik va chuqurlik beradi, matn o'qilishiga halaqit bermaydi; fixed — aylantirganda siljimaydi (kamroq repaint).
 */
export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-bg"
      style={{
        backgroundImage:
          "radial-gradient(38rem 24rem at 4% -4%, var(--aurora-1), transparent 70%), radial-gradient(34rem 22rem at 100% 0%, var(--aurora-2), transparent 70%)",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
