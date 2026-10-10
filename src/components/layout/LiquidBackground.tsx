/**
 * Jonli gradient fon — Liquid Glass panellar aynan shu rangli fonni "sindiradi".
 * Faqat CSS animatsiya (GPU), JS yo'q.
 */
export function LiquidBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="absolute -left-[10%] -top-[15%] h-[60vmax] w-[60vmax] rounded-full opacity-70 blur-[90px] animate-blob-1"
        style={{ background: "radial-gradient(circle at 30% 30%, var(--blob-1), transparent 65%)" }}
      />
      <div
        className="absolute -right-[15%] -top-[10%] h-[55vmax] w-[55vmax] rounded-full opacity-70 blur-[100px] animate-blob-2"
        style={{ background: "radial-gradient(circle at 60% 40%, var(--blob-2), transparent 65%)" }}
      />
      <div
        className="absolute left-[20%] top-[45%] h-[50vmax] w-[50vmax] rounded-full opacity-60 blur-[110px] animate-blob-3"
        style={{ background: "radial-gradient(circle at 50% 50%, var(--blob-3), transparent 65%)" }}
      />
      <div
        className="absolute -bottom-[20%] -right-[10%] h-[55vmax] w-[55vmax] rounded-full opacity-60 blur-[100px] animate-blob-4"
        style={{ background: "radial-gradient(circle at 40% 60%, var(--blob-4), transparent 65%)" }}
      />
      <div
        className="absolute -bottom-[15%] left-[5%] h-[45vmax] w-[45vmax] rounded-full opacity-55 blur-[100px] animate-blob-2"
        style={{ background: "radial-gradient(circle at 50% 50%, var(--blob-5), transparent 65%)" }}
      />
      {/* Nozik donachalar — shishaga "material" hissi beradi */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
