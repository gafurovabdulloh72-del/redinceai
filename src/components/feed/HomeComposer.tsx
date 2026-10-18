"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/groups/GroupFeed";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";

/** Bosh sahifadagi kompozitor — ijodkor o'z profil lentasiga post joylaydi; joylangach lenta yangilanadi */
export function HomeComposer() {
  const router = useRouter();
  const til = useLocale();
  const onPosted = useCallback(async () => {
    router.refresh();
  }, [router]);
  return <Composer base="/api/profil/postlar" onPosted={onPosted} kind="channel" placeholder={tr(til, FEED.composerPlaceholder)} />;
}
