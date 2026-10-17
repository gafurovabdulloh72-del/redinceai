import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";
import { SITE_URL } from "@/lib/site-url";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG rasm: qorong'u "siyoh" fon, Kasb Egalari, tagline, coral urg'u.
 * Shriftlar: satori woff2'ni o'qimaydi — tizim sans ishlatiladi (dizayn og'irlik va bo'shliq bilan ushlab turiladi).
 */
/** Ko'rsatiladigan domen — SITE_URL'dan (keyin .uz domen olinsa o'zi yangilanadi) */
const HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

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
        {/* Coral va binafsha nur (satori: oddiy doiralar, opacity bilan) */}
        <div style={{ position: "absolute", right: -220, top: -260, width: 760, height: 760, borderRadius: 9999, background: "#ff5a36", opacity: 0.28 }} />
        <div style={{ position: "absolute", right: -60, top: -100, width: 440, height: 440, borderRadius: 9999, background: "#ff5a36", opacity: 0.22 }} />
        <div style={{ position: "absolute", left: -260, bottom: -300, width: 680, height: 680, borderRadius: 9999, background: "#7b61ff", opacity: 0.16 }} />
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
            Kasb Egalari<span style={{ color: "#ff5a36" }}>.</span>
          </div>
        </div>

        {/* Sarlavha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "rgba(255,255,255,0.6)", fontSize: 20, letterSpacing: 5, textTransform: "uppercase", fontWeight: 700 }}>
            <div style={{ width: 36, height: 2, background: "#ff5a36" }} />
            Ijodkorlar va onlayn kasblar platformasi
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, lineHeight: 0.98, letterSpacing: -4 }}>
            <span>Ijodkorlarni</span>
            <span style={{ display: "flex" }}>
              <span style={{ color: "#ff5a36", fontWeight: 500, letterSpacing: -3 }}>xaritada</span>
              <span style={{ marginLeft: 26 }}>toping</span>
            </span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.72)", maxWidth: 820, lineHeight: 1.35 }}>
            Katalog va xarita, xavfsiz buyurtma, jamoalar va kanallar, vakansiyalar — 14 ta hudud, bitta tizim.
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
          <span style={{ color: "#ffffff", fontWeight: 600 }}>{HOST}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
