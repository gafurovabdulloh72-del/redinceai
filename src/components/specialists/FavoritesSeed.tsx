"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { seedFavorites } from "./favorites-store";

const SeedContext = createContext<ReadonlySet<string> | null>(null);

/**
 * Server sevimli ID'larni biladigan sahifa (/kabinet/sevimlilar) uchun: SSR va gidratsiyada yuraklar darhol to'ldirilgan
 * (kontekst orqali), mount bo'lgach do'kon "ready" holatiga seed qilinadi — /api/favorites javobini kutish shart emas,
 * shu oraliqda bosilgan yurak ham to'g'ri (DELETE) so'rov yuboradi.
 */
export function FavoritesSeed({ viewerId, ids, children }: { viewerId: string; ids: string[]; children: ReactNode }) {
  const set = useMemo(() => new Set(ids), [ids]);
  useEffect(() => {
    seedFavorites(viewerId, ids);
  }, [viewerId, ids]);
  return <SeedContext.Provider value={set}>{children}</SeedContext.Provider>;
}

/** Seed qilingan ID'lar (FavoritesSeed ichida bo'lsa), aks holda null */
export function useFavoritesSeed(): ReadonlySet<string> | null {
  return useContext(SeedContext);
}
