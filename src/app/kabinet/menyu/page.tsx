import type { Metadata } from "next";
import { MenuRedirect } from "./MenuRedirect";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";

export async function generateMetadata(): Promise<Metadata> {
  return { title: tr(await getLocale(), KABINET_NAV.menuTitle) };
}

/** Telefon «Profil» tabi: barcha kabinet bo'limlari, til, ko'rinish va chiqish bitta tushunarli ro'yxatda (KabinetNav chizadi). */
export default function MenuPage() {
  return <MenuRedirect />;
}
