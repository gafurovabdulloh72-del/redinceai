import { z } from "zod";

/**
 * STORY DIZAYNI (2026-11-11) — muharrirda qo'yilgan matn uslubi/joyi, stiker joyi va media sig'ishi.
 * Klientga xavfsiz (muharrir, ko'ruvchi va server sxemasi shu yagona manbadan oladi). Koordinatalar — tuval
 * o'lchamiga NISBATAN (0…1), shrift o'lchami — tuval kengligining foizi (`cqw`): har qanday ekranda bir xil ko'rinadi.
 * `stories.design` null bo'lsa (eski story'lar) ko'ruvchi avvalgi ko'rinishda chizadi.
 */
export const STORY_TEXT_COLORS = ["#ffffff", "#0b0b0c", "#ff5a36", "#ffd166", "#06d6a0", "#4cc9f0", "#a78bfa", "#f472b6"] as const;
export const STORY_FONTS = ["sans", "serif", "mono", "brand"] as const;
export const STORY_TEXT_STYLES = ["plain", "box", "soft"] as const;
export const STORY_ALIGNS = ["left", "center", "right"] as const;
export const STORY_TEXT_SIZE = { min: 3.6, max: 12, step: 0.2 } as const;

export type StoryFont = (typeof STORY_FONTS)[number];
export type StoryTextStyle = (typeof STORY_TEXT_STYLES)[number];
export type StoryAlign = (typeof STORY_ALIGNS)[number];

export interface StoryTextDesign {
  /** Matn markazi (0…1) */
  x: number;
  y: number;
  /** Shrift o'lchami — tuval kengligining foizi */
  size: number;
  color: string;
  style: StoryTextStyle;
  font: StoryFont;
  align: StoryAlign;
}
export interface StoryDesign {
  text?: StoryTextDesign;
  /** Stiker markazi vertikal bo'yicha (0…1) */
  stickerY?: number;
  /** Media: contain — to'liq ko'rinadi (standart); cover — tuvalni to'ldiradi */
  fit?: "contain" | "cover";
}

const frac = z.coerce.number().min(0.04).max(0.96);
export const storyDesignSchema = z
  .object({
    text: z
      .object({
        x: frac,
        y: frac,
        size: z.coerce.number().min(STORY_TEXT_SIZE.min).max(STORY_TEXT_SIZE.max),
        color: z.enum(STORY_TEXT_COLORS),
        style: z.enum(STORY_TEXT_STYLES),
        font: z.enum(STORY_FONTS),
        align: z.enum(STORY_ALIGNS),
      })
      .optional(),
    stickerY: frac.optional(),
    fit: z.enum(["contain", "cover"]).optional(),
  })
  .strict();

export const defaultTextDesign = (kind: "media" | "text"): StoryTextDesign =>
  kind === "text" ? { x: 0.5, y: 0.5, size: 8, color: "#ffffff", style: "plain", font: "sans", align: "center" } : { x: 0.5, y: 0.76, size: 5.6, color: "#ffffff", style: "soft", font: "sans", align: "center" };

export const STORY_FONT_FAMILY: Record<StoryFont, string> = {
  sans: "var(--font-sans)",
  serif: "var(--font-serif)",
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  brand: "var(--font-brand)",
};
export const STORY_FONT_LABEL: Record<StoryFont, string> = { sans: "Oddiy", serif: "Klassik", mono: "Mashinka", brand: "Qalin" };

/** Rang ustida o'qiladigan matn rangi (oq yoki qora) */
export function contrastOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#0b0b0c" : "#ffffff";
}
