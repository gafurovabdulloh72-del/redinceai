import Link from "next/link";
import { BadgeCheck, Lock, Radio, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { CoverImage } from "@/components/specialists/CoverImage";
import { OfficialCover } from "./OfficialCover";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import type { MembershipState, UserBrief } from "@/lib/groups/service";
import { cn, compactCount } from "@/lib/utils";

export interface GroupCardData {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  region: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
  kind: "group" | "channel";
  isOfficial: boolean;
  membersCount: number;
  postsCount: number;
  owner: UserBrief;
  membership: MembershipState;
  /** A'zo oxirgi ko'rganidan keyin yangi faollik bor */
  hasUnread?: boolean;
  /** Muqova vertikal joylashuvi (0–100) */
  coverPosition?: number | null;
}

const MEMBERSHIP_LABEL: Partial<Record<NonNullable<MembershipState>, string>> = { owner: "Egasi", admin: "Admin", member: "A'zo", pending: "So'rov" };

/**
 * Jamoalar ro'yxatidagi karta (server komponent — hooks yo'q). v3: muqova ustida faqat bitta tur/yopiq belgisi,
 * yo'nalish·hudud·a'zolar bitta meta qatorida, hover — hairline qorayadi (ko'tarilish/soya yo'q).
 */
export function GroupCard({ g }: { g: GroupCardData }) {
  const cat = g.category ? CATEGORY_BY_SLUG[g.category] : null;
  const reg = g.region ? REGION_BY_SLUG[g.region] : null;
  const label = g.membership ? MEMBERSHIP_LABEL[g.membership] : null;
  const meta = [cat?.plural, reg?.short].filter(Boolean).join(" · ");
  return (
    <Link href={`/jamoalar/${g.slug}`} className="card m-plain group flex flex-col overflow-hidden transition-colors hover:border-fg/40 max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:px-4 max-sm:py-3" style={{ ["--cover-y" as string]: `${g.coverPosition ?? 50}%` }}>
      <div className="img-zoom relative aspect-[3/1] overflow-hidden bg-surface-3 [&_img]:[object-position:center_var(--cover-y)] max-sm:aspect-square max-sm:w-[54px] max-sm:shrink-0 max-sm:self-start max-sm:rounded-[12px]">
        {g.isOfficial && !g.coverUrl ? <OfficialCover name={g.name} compact /> : <CoverImage src={g.coverUrl} category={cat?.slug} seed={g.slug} />}
        {(g.kind === "channel" || g.isPrivate) && (
          <span className="absolute left-3 top-3 inline-flex h-7 items-center gap-1 rounded-full bg-ink/85 px-2.5 text-[11.5px] font-semibold text-ink-fg max-sm:hidden">
            {g.isPrivate ? <Lock size={11} /> : <Radio size={11} />} {g.isPrivate ? "Yopiq" : "Kanal"}
          </span>
        )}
        {label && <span className="absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-fg-2 max-sm:hidden">{label}</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 max-sm:p-0">
        <h3 className="flex items-start gap-1.5 font-display text-[17px] font-semibold leading-tight text-fg max-sm:text-[15.5px]">
          <span className="min-w-0">{g.name}</span>
          {g.isOfficial && <BadgeCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-label="Rasmiy kanal" />}
          {g.hasUnread && <span role="img" className="mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Yangi faollik" />}
        </h3>
        {g.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-fg-2 max-sm:mt-0.5 max-sm:line-clamp-1">{g.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12px] text-fg-3 max-sm:mt-1 max-sm:pt-0">
          <span className={cn("flex min-w-0 items-center gap-1.5", !meta && "gap-1")}>
            <Users size={13} className="shrink-0" /> {compactCount(g.membersCount)}
            {meta && <span className="truncate"> · {meta}</span>}
          </span>
          <span className="flex min-w-0 shrink items-center gap-1.5 max-sm:hidden">
            <Avatar name={g.owner.name} src={g.owner.avatarUrl} size={20} decorative />
            <span className="truncate text-fg-2">{g.owner.name}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
