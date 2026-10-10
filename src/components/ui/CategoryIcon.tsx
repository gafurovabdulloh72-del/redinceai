import { Box, Camera, Mic, Palette, PenTool, Scissors, Sparkles, Video, type LucideProps } from "lucide-react";
import type { Category } from "@/lib/constants";

const ICONS: Record<Category["icon"], React.ComponentType<LucideProps>> = {
  video: Video,
  scissors: Scissors,
  palette: Palette,
  camera: Camera,
  sparkles: Sparkles,
  box: Box,
  mic: Mic,
  "pen-tool": PenTool,
};

export function CategoryIcon({ icon, ...props }: { icon: Category["icon"] } & LucideProps) {
  const Cmp = ICONS[icon] ?? Video;
  return <Cmp {...props} />;
}
