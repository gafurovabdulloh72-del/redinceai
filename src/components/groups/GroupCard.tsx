import Link from "next/link";
import { Lock, MessageSquareText, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CoverImage } from "@/components/specialists/CoverImage";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import type { MembershipState, UserBrief } from "@/lib/groups/service";
import { cn } from "@/lib/utils";

export interface GroupCardData {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  region: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
  membersCount: number;
  postsCount: number;
  owner: UserBrief;
  membership: MembershipState;
}

const MEMBERSHIP_LABEL: Partial<Record<NonNullable<MembershipState>, string>> = { owner: "Egasi", admin: "Admin", member: "A'zo", pending: "So'rov yuborilgan" };

/** Jamoalar ro'yxatidagi karta (server komponent — hooks yo'q) */
export function GroupCard({ g }: { g: GroupCardData }) {
  const cat = g.category ? CATEGORY_BY_SLUG[g.category] : null;
  const reg = g.region ? REGION_BY_SLUG[g.region] : null;
  const label = g.membership ? MEMBERSHIP_LABEL[g.membership] : null;
  return (
    <Link href={`/jamoalar/${g.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]">
      <div className="relative aspect-[3/1] overflow-hidden bg-surface-3">
        <CoverImage src={g.coverUrl} category={cat?.slug} seed={g.slug} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {cat && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink/85 px-2.5 text-[11.5px] font-semibold text-ink-fg backdrop-blur">
              <CategoryIcon icon={cat.icon} size={12} /> {cat.plural}
            </span>
          )}
          {g.isPrivate && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-ink/85 px-2.5 text-[11.5px] font-semibold text-ink-fg backdrop-blur">
              <Lock size={11} /> Yopiq
            </span>
          )}
        </div>
        {label && <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">{label}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[17px] font-semibold leading-tight text-fg group-hover:text-accent">{g.name}</h3>
        {g.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fg-2">{g.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12px] text-fg-3">
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Users size={13} /> {g.membersCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquareText size={13} /> {g.postsCount}
            </span>
            {reg && <span className={cn("hidden sm:inline", "truncate")}>{reg.short}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={g.owner.name} src={g.owner.avatarUrl} size={22} decorative />
            <span className="truncate text-fg-2">{g.owner.name}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
