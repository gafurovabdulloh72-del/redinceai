import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Kirish",
  description: "Redince hisobingizga kiring — kabinet, buyurtmalar va profil boshqaruvi.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = first(sp.next);
  return <AuthForm mode="login" next={next} />;
}
