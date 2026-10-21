"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface UserHit {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}
export interface MentorRow {
  id: string;
  slug: string | null;
  isApproved: boolean;
  headline: string;
  photoUrl: string | null;
  coursesCount: number;
  studentsCount: number;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

/** Admin: foydalanuvchilar orasidan mentor tanlash (qidiruv) va mavjud mentorlarni boshqarish ro'yxati */
export function AdminMentorManager({ mentors }: { mentors: MentorRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UserHit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mentorUserIds = new Set(mentors.filter((m) => m.isApproved).map((m) => m.user.id));

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits(null);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(needle)}&holat=active`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { data?: { items: UserHit[] } }) => setHits((j.data?.items ?? []).slice(0, 8)))
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  async function make(u: UserHit) {
    if (busy) return;
    setBusy(u.id);
    try {
      const res = await fetch("/api/admin/mentors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: u.id }) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } };
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Xatolik");
      showToast(`${u.name} mentor qilindi`, "success");
      router.push(`/admin/mentorlik/${j.data.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-fg">
          <UserPlus size={16} /> Mentor qo&apos;shish
        </h2>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Foydalanuvchini ism yoki email bilan toping — tanlang, sahifasini o&apos;zingiz sozlab berasiz.</p>
        <label className="relative mt-3 block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email yoki @taxallus" aria-label="Foydalanuvchi qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        {hits && (
          <ul className="mt-2 divide-y divide-line rounded-[14px] border border-line">
            {hits.length === 0 && <li className="px-4 py-4 text-center text-[13px] text-fg-3">Hech kim topilmadi</li>}
            {hits.map((u) => {
              const already = mentorUserIds.has(u.id);
              return (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={u.name} src={u.avatarUrl} size={36} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                    <span className="block truncate text-[12px] text-fg-3">{u.email}</span>
                  </span>
                  {already ? (
                    <span className="text-[12px] font-semibold text-success-text">Mentor</span>
                  ) : (
                    <button type="button" onClick={() => void make(u)} disabled={busy !== null} className="btn-accent inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-60">
                      {busy === u.id && <Loader2 size={14} className="animate-spin" />} Mentor qilish
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <header className="border-b border-line px-4 py-3">
          <h2 className="font-display text-[16px] font-bold text-fg">
            Mentorlar <span className="font-normal text-fg-4">· {mentors.length}</span>
          </h2>
        </header>
        {mentors.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-fg-3">Hali mentor yo&apos;q — yuqoridan foydalanuvchi tanlang.</p>
        ) : (
          <ul className="divide-y divide-line">
            {mentors.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/mentorlik/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-fg/[0.03]">
                  <Avatar name={m.user.name} src={m.photoUrl ?? m.user.avatarUrl} size={44} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-fg">{m.user.name}</span>
                    <span className="block truncate text-[12.5px] text-fg-3">
                      {m.headline} · {m.coursesCount} bo&apos;lim · {m.studentsCount} talaba
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", m.isApproved ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text")}>{m.isApproved ? "Faol" : "Yashirin"}</span>
                  <span className="hidden shrink-0 text-[13px] font-semibold text-accent-text sm:block">Sozlash →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
