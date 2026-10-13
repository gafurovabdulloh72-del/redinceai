/** PATCH /api/proposals/[id] — klient yordamchisi (xato matni o'zbekcha, serverdan) */
export type ProposalActionName = "shortlist" | "decline" | "accept" | "withdraw";
type ApiResponse = { ok: true; data: { id: string; status: string; orderId?: string; href?: string } } | { ok: false; error: string; fields?: Record<string, string> };

export async function patchProposal(
  id: string,
  action: ProposalActionName,
  extra: { contactPhone?: string } = {},
): Promise<{ ok: true; href?: string } | { ok: false; error: string; fields?: Record<string, string> }> {
  try {
    const res = await fetch(`/api/proposals/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = (await res.json()) as ApiResponse;
    if (!json.ok) return { ok: false, error: json.error, fields: json.fields };
    return { ok: true, href: json.data.href };
  } catch {
    return { ok: false, error: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring." };
  }
}

/** PATCH /api/jobs/[id] — yopish / qayta ochish */
export async function patchJobState(id: string, action: "close" | "reopen"): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    return json.ok ? { ok: true } : { ok: false, error: json.error ?? "Xatolik" };
  } catch {
    return { ok: false, error: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring." };
  }
}
