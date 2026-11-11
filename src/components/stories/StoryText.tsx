import type { CSSProperties } from "react";
import { STORY_FONT_FAMILY, contrastOn, type StoryTextDesign } from "@/lib/stories/design";

/**
 * Story matni — muharrir tuvalida ham, ko'ruvchida ham AYNAN shu komponent chizadi (ko'rinish bir xil bo'lsin).
 * Ota element `container-type: inline-size` bo'lishi shart: o'lchamlar `cqw` (tuval kengligining foizi).
 * Uslublar: plain — soyali matn; box — har qatorga rangli fon (Instagram «klassik»); soft — xira qora taglik.
 */
export function storyTextStyles(d: StoryTextDesign): { wrap: CSSProperties; inner: CSSProperties } {
  const base: CSSProperties = {
    fontFamily: STORY_FONT_FAMILY[d.font],
    fontSize: `${d.size}cqw`,
    lineHeight: d.style === "box" ? 1.42 : 1.22,
    fontWeight: d.font === "serif" ? 600 : 700,
    textAlign: d.align,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    letterSpacing: d.font === "mono" ? "-0.02em" : undefined,
  };
  if (d.style === "box") {
    return {
      wrap: base,
      inner: { background: d.color, color: contrastOn(d.color), padding: "0.12em 0.42em", borderRadius: "0.34em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" },
    };
  }
  if (d.style === "soft") {
    return {
      wrap: { ...base, background: "rgba(0,0,0,0.46)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: "0.5em 0.75em", borderRadius: "0.7em", color: d.color === "#0b0b0c" ? "#ffffff" : d.color },
      inner: {},
    };
  }
  return { wrap: { ...base, color: d.color, textShadow: d.color === "#0b0b0c" ? "0 1px 2px rgba(255,255,255,0.35)" : "0 1px 3px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.4)" }, inner: {} };
}

export function StoryText({ text, design, className }: { text: string; design: StoryTextDesign; className?: string }) {
  const s = storyTextStyles(design);
  return (
    <div
      className={className}
      style={{ position: "absolute", left: `${design.x * 100}%`, top: `${design.y * 100}%`, transform: "translate(-50%, -50%)", width: "max-content", maxWidth: "86cqw", ...s.wrap }}
      data-no-auto
    >
      <span style={s.inner}>{text}</span>
    </div>
  );
}
