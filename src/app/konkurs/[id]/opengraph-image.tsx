import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";
import { getChallenge } from "@/lib/challenges/service";
import { SITE_URL } from "@/lib/site-url";
import { OgMark, OgWordmark, brandFonts } from "@/lib/og/brand";

export const alt = `${SITE.name} — ijod konkursi`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Konkurs uchun dinamik OG rasm (kamchilik #45): nom, holat, ishlar soni, muddat.
 * Profil OG naqshi bilan bir xil palitra; tashqi rasm yuklanmaydi (muqova bo'lsa ham) —
 * tarmoq bloklansa rasm buzilmasin. Emoji ishlatilmaydi (satori tarmoqdan yuklaydi).
 */
const HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
const font = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

export default async function ChallengeOgImage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getChallenge(id, null).catch(() => null);

  if (!c) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#121213", color: "#fff", fontFamily: font, fontSize: 56, fontWeight: 700 }}>
          {SITE.name}
        </div>
      ),
      { ...size, status: 404 },
    );
  }

  const title = c.title.length > 60 ? `${c.title.slice(0, 59)}…` : c.title;
  const state = c.state === "open" ? "Ochiq konkurs" : c.state === "soon" ? "Tez kunda" : "Yakunlangan";
  const until = new Date(c.endsAt);
  const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const untilLabel = `${until.getDate()}-${months[until.getMonth()]}gacha`;

  const chip = (text: string, accent = false) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 52,
        padding: "0 24px",
        borderRadius: 9999,
        fontSize: 24,
        fontWeight: 600,
        background: accent ? "rgba(255,90,54,0.18)" : "rgba(255,255,255,0.08)",
        color: accent ? "#ff8a6b" : "#ffffff",
        border: accent ? "1px solid rgba(255,90,54,0.4)" : "1px solid rgba(255,255,255,0.14)",
      }}
    >
      {text}
    </div>
  );

  const brand = await brandFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px", background: "#121213", color: "#ffffff", fontFamily: font, position: "relative" }}>
        <div style={{ position: "absolute", right: -200, top: -240, width: 700, height: 700, borderRadius: 9999, background: "#ff5a36", opacity: 0.26 }} />
        <div style={{ position: "absolute", left: -240, bottom: -320, width: 640, height: 640, borderRadius: 9999, background: "#7b61ff", opacity: 0.14 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <OgMark size={56} />
            <OgWordmark fontSize={34} />
          </div>
          {chip("Ijod konkursi", true)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Kubok belgisi SVG (emoji emas) */}
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#ffc24a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" />
          </svg>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, letterSpacing: -2, lineHeight: 1.08 }}>{title}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {chip(state, c.state === "open")}
            {chip(`${c.entriesCount} ta ish`)}
            {c.state !== "done" && chip(untilLabel)}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.55)" }}>{HOST}</div>
        </div>
      </div>
    ),
    { ...size, ...brand },
  );
}
