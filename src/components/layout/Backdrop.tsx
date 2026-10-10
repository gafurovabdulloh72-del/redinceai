/**
 * Fon: Paper (yorug') rejimda iliq qog'oz + juda nozik to'r; Noir (qorong'u) rejimda
 * chuqur qora + yumshoq nur dog'lari. Faqat CSS, sekin "drift" animatsiya.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {/* Nur dog'lari */}
      <div
        className="absolute -right-[20%] -top-[30%] h-[80vmax] w-[80vmax] rounded-full opacity-[0.22] blur-[120px] animate-drift dark:opacity-[0.28]"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-[35%] -left-[25%] h-[80vmax] w-[80vmax] rounded-full opacity-[0.18] blur-[130px] animate-drift dark:opacity-[0.26]"
        style={{ background: "radial-gradient(closest-side, var(--accent-2), transparent 70%)", animationDelay: "-11s" }}
      />
      {/* Nozik to'r — faqat yuqori qismda */}
      <div
        className="absolute inset-x-0 top-0 h-[70vh] opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 80%)",
        }}
      />
      {/* Donachalar */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
