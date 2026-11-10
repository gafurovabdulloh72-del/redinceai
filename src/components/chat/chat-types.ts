import type { CallInfo } from "@/lib/call/format";
import type { ReactionSummary } from "@/lib/chat/constants";
import type { QuoteView } from "@/lib/chat/quote";
import type { Attachment } from "./attachments";
import type { ConvPrefsView } from "./DmPanels";

/** Chat bo'limining klient turlari (API javoblari bilan bir xil shakl — lib/chat/dm.ts, inbox.ts, unread.ts) */

/** Suhbatdosh (lib/chat/dm.ts `PeerView`): vaqtlar ms; maxfiylik/blok bo'lsa null */
export interface Peer {
  id: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  isBanned?: boolean;
  slug?: string | null;
  /** Tasdiqlangan mutaxassis — sarlavhada ko'k belgi */
  isVerified?: boolean;
  lastSeenAt?: number | null;
  lastActiveAt?: number | null;
}

export type AttachKind = QuoteView["kind"];

export interface ConvRow {
  id: string;
  peer: Peer;
  last: { body: string; mine: boolean; at: number; hasFiles: boolean; voice?: boolean; deleted?: boolean; kind?: AttachKind } | null;
  sortAt?: number;
  unread: number;
  prefs: ConvPrefsView;
  peerTyping?: boolean;
  ttlSeconds?: number;
}

/** Telegram inbox: men a'zo bo'lgan guruh/kanal qatori (lib/chat/inbox.ts GroupInboxRow) */
export interface GroupRow {
  kind: "group" | "channel";
  id: string;
  slug: string;
  name: string;
  coverUrl: string | null;
  isOfficial: boolean;
  membersCount: number;
  last: { body: string; at: number; by: string | null; hasFiles: boolean; kind?: AttachKind } | null;
  unread: number;
  muted: boolean;
  pinned: boolean;
  folderId: string | null;
  canManage?: boolean;
  isOwner?: boolean;
  archived?: boolean;
  lastPostId?: string | null;
  /** Hozir yozayotgan a'zo nomi */
  typing?: string | null;
}

/** O'qilmagan xabari bor buyurtma chati (lib/chat/unread.ts OrderInboxRow) */
export interface OrderRow {
  orderId: string;
  title: string;
  peerName: string;
  last: { body: string; at: number; hasFiles: boolean } | null;
  unread: number;
  href: string;
}

/** Chat turlari filtri (Telegram «papkalari»ning birinchi qatori) */
export type ChatType = "all" | "dm" | "group" | "channel";

export interface Msg {
  id: string;
  mine: boolean;
  body: string;
  attachments: Attachment[];
  at: number;
  replyTo: QuoteView | null;
  editedAt?: number | null;
  deleted?: boolean;
  forwardedFrom?: string | null;
  /** Qo'ng'iroq yozuvi (oddiy xabar emas) */
  call?: CallInfo | null;
  reactions?: ReactionSummary[];
  /** Yo'qoladigan xabar: shu vaqtda (ms) o'chadi */
  expiresAt?: number | null;
  /** Faqat klientda: optimistik yuborish holati */
  pending?: "sending" | "failed";
  /** Faqat klientda: yuborilmagan xabar sababi (pufakcha ostida ko'rsatiladi; qayta yuborilganda yo'qoladi) */
  error?: string;
  /** Qayta yuborish uchun saqlanadi */
  replyToId?: string | null;
}

/** Chat papkasi (dm_folders) */
export interface FolderRow {
  id: string;
  name: string;
  count: number;
}
