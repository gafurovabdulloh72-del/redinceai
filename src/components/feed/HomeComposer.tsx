"use client";

import { useCallback } from "react";
import { Composer } from "@/components/groups/GroupFeed";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";

/** Bosh sahifa lentasi «yangi post» hodisasi — HomeFeed eshitadi va postni tepaga qo'shadi (to'liq qayta yuklashsiz) */
export const FEED_POSTED_EVENT = "feed:posted";

/** Bosh sahifadagi kompozitor — ijodkor o'z profil lentasiga post (so'rovnoma bilan) joylaydi */
export function HomeComposer() {
  const til = useLocale();
  const onPosted = useCallback((id?: string) => {
    window.dispatchEvent(new CustomEvent(FEED_POSTED_EVENT, { detail: { id } }));
  }, []);
  return <Composer base="/api/profil/postlar" onPosted={onPosted} kind="channel" allowPoll placeholder={tr(til, FEED.composerPlaceholder)} />;
}
