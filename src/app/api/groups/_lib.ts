import "server-only";
import { ApiError } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { loadGroupBySlug } from "@/lib/groups/service";
import type { Group } from "@/lib/db/schema";

export type Viewer = { id: string; role: string } | null;

/** Ommaviy route'lar: sessiya bo'lsa ko'ruvchi, bo'lmasa null (xato emas) */
export async function optionalViewer(): Promise<Viewer> {
  const s = await getVerifiedSession();
  return s ? { id: s.sub, role: s.role } : null;
}

export async function groupOr404(slug: string): Promise<Group> {
  const g = await loadGroupBySlug(slug);
  if (!g) throw new ApiError(404, "Jamoa topilmadi");
  return g;
}
