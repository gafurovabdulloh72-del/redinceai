import type { FileAttachment, PostMusic } from "@/lib/db/schema";
import type { UserBrief } from "@/lib/groups/service";

/** Story qatoridagi bitta muallif (halqa) — klientga xavfsiz DTO */
export interface StoryRailItem {
  author: UserBrief;
  count: number;
  latestAt: number;
  /** Hammasini ko'rganmi (kulrang halqa) */
  allSeen: boolean;
  isMe: boolean;
}

export interface StoryView {
  id: string;
  media: FileAttachment | null;
  caption: string | null;
  bg: string | null;
  music: PostMusic | null;
  createdAt: number;
  expiresAt: number;
  seen: boolean;
  /** Faqat egasiga (va adminga): ko'rishlar soni; boshqalarga null */
  viewsCount: number | null;
}

export interface AuthorStories {
  author: UserBrief;
  items: StoryView[];
  isMe: boolean;
}
