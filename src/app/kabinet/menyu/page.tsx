import type { Metadata } from "next";
import { MenuRedirect } from "./MenuRedirect";

export const metadata: Metadata = { title: "Menyu" };

/** Telefon «Profil» tabi: barcha kabinet bo'limlari, til, ko'rinish va chiqish bitta tushunarli ro'yxatda (KabinetNav chizadi). */
export default function MenuPage() {
  return <MenuRedirect />;
}
