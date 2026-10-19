import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { isGoogleConfigured } from "@/lib/auth/google";
import { getSettings } from "@/lib/payments/settings";

export const metadata: Metadata = {
  title: "Ro'yxatdan o'tish",
  description: "Kasb Egalari platformasida bepul hisob yarating — xizmat ko'rsating, buyurtma bering, ish toping yoki xodim qidiring; jamoalar va kanallar hammaga ochiq.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const role = first(sp.role) === "specialist" ? "specialist" : "client";
  // ?intent=service|order|job|hire — maqsad kartasi oldindan tanlangan (?role=specialist → service)
  const rawIntent = first(sp.intent);
  const intent = rawIntent === "service" || rawIntent === "order" || rawIntent === "job" || rawIntent === "hire" ? rawIntent : role === "specialist" ? "service" : undefined;
  const settings = await getSettings();
  const subscription = { price: settings.subscriptionPrice, trialDays: settings.subscriptionTrialDays, enforced: settings.subscriptionEnforced === 1 };
  return <AuthForm mode="register" defaultRole={role} defaultIntent={intent} next={first(sp.next)} reason={first(sp.reason)} subscription={subscription} googleEnabled={isGoogleConfigured()} />;
}
