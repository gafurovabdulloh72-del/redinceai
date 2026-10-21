"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";

/** Admin: mentorni mentorlikdan olib tashlash (kurslari yashiriladi, ma'lumot o'chmaydi) */
export function RemoveMentorButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!(await confirm({ title: `${name} mentorlikdan olib tashlansinmi?`, text: "Sahifasi va kurslari ommaga ko'rinmay qoladi. Ma'lumotlar o'chmaydi — keyin qayta mentor qilish mumkin.", confirmLabel: "Olib tashlash", danger: true }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/mentors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xatolik");
      showToast("Mentorlikdan olib tashlandi", "success");
      router.push("/admin/mentorlik");
    } catch {
      showToast("Bajarilmadi", "error");
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={() => void run()} disabled={busy} className="text-[13px] font-semibold text-danger-text hover:underline disabled:opacity-60">
      Mentorlikdan olib tashlash
    </button>
  );
}
