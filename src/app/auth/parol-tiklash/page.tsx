import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const metadata: Metadata = {
  title: "Parolni tiklash",
  description: "Kasb Egalari hisobingiz parolini email orqali tiklang.",
  robots: { index: false, follow: false },
};

export default function ResetRequestPage() {
  return <ResetRequestForm />;
}
