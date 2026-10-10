import type { Metadata } from "next";
import { ResetConfirmForm } from "@/components/auth/ResetConfirmForm";
import { peekPasswordReset } from "@/lib/security/tokens";

export const metadata: Metadata = {
  title: "Yangi parol",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ResetConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await peekPasswordReset(token);
  return <ResetConfirmForm token={token} initiallyValid={valid} />;
}
