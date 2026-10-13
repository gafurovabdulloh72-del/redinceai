import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSettings } from "@/lib/payments/settings";

export const metadata: Metadata = {
  title: "Ro'yxatdan o'tish",
  description: "Redince'da bepul hisob yarating — mijoz sifatida mutaxassis toping yoki mutaxassis sifatida buyurtma oling.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const role = first(sp.role) === "specialist" ? "specialist" : "client";
  const settings = await getSettings();
  const subscription = { price: settings.subscriptionPrice, trialDays: settings.subscriptionTrialDays, enforced: settings.subscriptionEnforced === 1 };
  return <AuthForm mode="register" defaultRole={role} next={first(sp.next)} reason={first(sp.reason)} subscription={subscription} />;
}
