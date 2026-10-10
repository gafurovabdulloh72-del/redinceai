import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG rasm: qorong'u "siyoh" fon, Redince, tagline, coral urg'u.
 * Shriftlar: satori woff2'ni o'qimaydi — tizim sans ishlatiladi (dizayn og'irlik va bo'shliq bilan ushlab turiladi).
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#121213",
          color: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          position: "relative",
        }}
      >
        {/* Coral nur */}
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -200,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background: "radial-gradient(closest-side, rgba(255,90,54,0.55), rgba(255,90,54,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -220,
            bottom: -260,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "radial-gradient(closest-side, rgba(123,97,255,0.35), rgba(123,97,255,0))",
          }}
        />
        {/* Nozik to'r */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Logo qatori */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "#ffffff",
              color: "#121213",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#121213" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h7a4 4 0 0 1 0 8H5z" />
              <path d="M5 12h6l5 8" />
              <path d="M5 4v16" />
            </svg>
            <div style={{ position: "absolute", right: 10, top: 10, width: 10, height: 10, borderRadius: 9999, background: "#ff5a36" }} />
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1.5 }}>
            Redince<span style={{ color: "#ff5a36" }}>.</span>
          </div>
        </div>

        {/* Sarlavha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "rgba(255,255,255,0.6)", fontSize: 20, letterSpacing: 5, textTransform: "uppercase", fontWeight: 700 }}>
            <div style={{ width: 36, height: 2, background: "#ff5a36" }} />
            O'zbekiston ijodkorlar xaritasi
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, lineHeight: 0.98, letterSpacing: -4 }}>
            <span>Ijodkorlarni</span>
            <span>
              <span style={{ color: "#ff5a36", fontStyle: "italic", fontWeight: 400, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: -2 }}>xaritada</span> toping
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.72)", maxWidth: 820, lineHeight: 1.35 }}>
            Videograf, montajor, dizayner va boshqa ijodkorlar — 14 ta hudud, bitta interaktiv xarita.
          </div>
        </div>

        {/* Pastki qator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "rgba(255,255,255,0.55)", fontSize: 20 }}>
          <div style={{ display: "flex", gap: 28 }}>
            <span>14 ta hudud</span>
            <span>·</span>
            <span>8 ta yo'nalish</span>
            <span>·</span>
            <span>Tasdiqlangan profillar</span>
          </div>
          <span style={{ color: "#ffffff", fontWeight: 600 }}>redince.uz</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
