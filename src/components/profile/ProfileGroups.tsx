import Link from "next/link";
import { Crown, Radio, UsersRound } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { tr, type Locale } from "@/lib/i18n";
import { PROFIL_X } from "@/lib/i18n/dict/profile";
import type { PublicGroupLite } from "@/lib/profile/groups";
import { cn } from "@/lib/utils";

/** «Jamoalari» — ijodkor a'zo bo'lgan ochiq jamoa/kanallar (6 tagacha); bo'lmasa bo'lim chiqmaydi */
export function ProfileGroups({ groups, til, className }: { groups: PublicGroupLite[]; til: Locale; className?: string }) {
  if (groups.length === 0) return null;
  return (
    <section className={cn("card m-flat p-5 sm:p-7", className)} aria-label={tr(til, PROFIL_X.groupsAria)}>
      <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">{tr(til, PROFIL_X.groupsTitle)}</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g.slug}>
            <Link href={`/jamoalar/${g.slug}`} className="hover-lift press flex items-center gap-3 rounded-[var(--r-md)] border border-line p-2.5">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-sm)] bg-surface-3 text-fg-3">
                <SafeImage src={g.coverUrl ?? undefined} alt="" className="absolute inset-0 h-full w-full object-cover" fallback={g.kind === "channel" ? <Radio size={18} aria-hidden /> : <UsersRound size={18} aria-hidden />} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
                  <span className="truncate">{g.name}</span>
                  {g.isOwner && <Crown size={12} className="shrink-0 text-fg-3" aria-label={tr(til, PROFIL_X.groupOwner)} />}
                </span>
                <span className="block truncate text-[12px] text-fg-3">
                  {tr(til, g.kind === "channel" ? PROFIL_X.groupChannel : PROFIL_X.groupGroup)} · {PROFIL_X.groupMembers[til](g.membersCount)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
