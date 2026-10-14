import { ImageResponse } from "next/og";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG, SITE } from "@/lib/constants";
import { GUEST_VIEWER, filterSpecialistForViewer } from "@/lib/privacy";
import { getSpecialistBySlug } from "@/lib/queries";
import { hashHue, initials } from "@/lib/utils";

export const alt = `${SITE.name} — mutaxassis profili`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Profil uchun dinamik OG rasm (F10): ism, kasb, yo'nalish, hudud, reyting, tasdiq belgisi.
 * Faqat MEHMON ko'radigan ma'lumot (filterSpecialistForViewer + GUEST_VIEWER): yashirin shahar o'rniga hudud markazi.
 * Tashqi rasm (avatar/muqova) yuklanmaydi — tarmoq bloklansa rasm buzilmasin; bosh harflar ishlatiladi.
 * Shriftlar: satori woff2'ni o'qimaydi — tizim sans (ildiz opengraph-image bilan bir xil).
 */
const HOST = (process.env.SITE_URL ?? "kasbegalari.vercel.app").replace(/^https?:\/\//, "").replace(/\/$/, "");

export default async function SpecialistOgImage({ params }: { params: { slug: string } | Promise<{ slug: string }> }) {
  const { slug } = await params;
  // undefined — baza xatosi (zaxira rasm, 200); null — profil yo'q / bloklangan (zaxira rasm, lekin 404)
  const raw = await getSpecialistBySlug(slug).catch(() => undefined);

  const font = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
  if (!raw) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#121213", color: "#fff", fontFamily: font, fontSize: 56, fontWeight: 700 }}>
          {SITE.name}
        </div>
      ),
      { ...size, status: raw === null ? 404 : 200 },
    );
  }

  const sp = filterSpecialistForViewer(raw, GUEST_VIEWER);
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const hue = hashHue(sp.slug);
  const place = region ? (sp.city && sp.city !== region.capital ? `${sp.city}, ${region.short}` : region.name) : sp.city;
  // Emoji va ★ belgisi ishlatilmaydi — satori ularni tarmoqdan yuklashga urinadi; belgilar SVG
  const rating = sp.reviewCount > 0 ? `${sp.rating.toFixed(1)} · ${sp.reviewCount} ta sharh` : "Yangi mutaxassis";
  const name = sp.user.name.length > 28 ? `${sp.user.name.slice(0, 27)}…` : sp.user.name;
  const title = sp.title.length > 60 ? `${sp.title.slice(0, 59)}…` : sp.title;

  const chip = (text: string, opts: { bg?: string; color?: string; border?: string; icon?: "pin" | "star" } = {}) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 52,
        padding: "0 24px",
        borderRadius: 9999,
        fontSize: 24,
        fontWeight: 600,
        background: opts.bg ?? "rgba(255,255,255,0.08)",
        color: opts.color ?? "#ffffff",
        border: opts.border ?? "1px solid rgba(255,255,255,0.14)",
      }}
    >
      {opts.icon === "pin" && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff5a36" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      )}
      {opts.icon === "star" && (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#ffc24a" />
        </svg>
      )}
      {text}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          background: "#121213",
          color: "#ffffff",
          fontFamily: font,
          position: "relative",
        }}
      >
        {/* Coral va binafsha nur — Studio palitrasi */}
        <div style={{ position: "absolute", right: -200, top: -240, width: 700, height: 700, borderRadius: 9999, background: "#ff5a36", opacity: 0.26 }} />
        <div style={{ position: "absolute", left: -240, bottom: -320, width: 640, height: 640, borderRadius: 9999, background: "#7b61ff", opacity: 0.14 }} />

        {/* Yuqori qator: logotip + yo'nalish */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#121213" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h7a4 4 0 0 1 0 8H5z" />
                <path d="M5 12h6l5 8" />
                <path d="M5 4v16" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
              {SITE.name}
              <span style={{ color: "#ff5a36" }}>.</span>
            </div>
          </div>
          {cat && chip(cat.name, { bg: "#ffffff", color: "#121213", border: "1px solid #ffffff" })}
        </div>

        {/* Markaz: avatar + ism + kasb */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 9999,
              background: `hsl(${hue} 45% 42%)`,
              border: "6px solid rgba(255,255,255,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 700,
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            {initials(sp.user.name)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
              {name}
              {sp.isVerified && (
                <svg width="52" height="52" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="11" fill="#ff5a36" />
                  <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 32, color: "rgba(255,255,255,0.78)" }}>{title}</div>
          </div>
        </div>

        {/* Pastki qator: hudud, reyting, tasdiq */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {place && chip(place, { icon: "pin" })}
            {chip(rating, sp.reviewCount > 0 ? { color: "#ffd27a", icon: "star" } : {})}
            {sp.isVerified && chip("Tasdiqlangan", { bg: "rgba(255,90,54,0.18)", color: "#ff8a6b", border: "1px solid rgba(255,90,54,0.4)" })}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.55)" }}>{HOST}</div>
        </div>
      </div>
    ),
    size,
  );
}
