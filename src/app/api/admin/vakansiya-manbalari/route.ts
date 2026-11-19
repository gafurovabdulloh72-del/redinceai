import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { addSources, decideImport, deleteSource, listImports, listSources, runVacancyImport, updateSource } from "@/lib/vacancies/import";
import { PROFESSION_SLUGS } from "@/lib/vacancies/format";

export const maxDuration = 60;

/**
 * Admin: vakansiya manbalari (ochiq Telegram kanallari).
 * GET ?imports=pending|published|skipped|all — manbalar + oxirgi importlar
 * POST {action:"add", channels, mode} | {action:"run", sourceId?} | {action:"decide", id, decision:"publish"|"reject"}
 * PATCH {id, enabled?, mode?, professions?} · DELETE {id, removeVacancies}
 */
const postSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("add"), channels: z.string().trim().min(3).max(5000), mode: z.enum(["auto", "review"]).default("review") }),
  z.strictObject({ action: z.literal("run"), sourceId: z.string().max(40).optional() }),
  z.strictObject({ action: z.literal("decide"), id: z.string().min(1).max(40), decision: z.enum(["publish", "reject"]) }),
]);
const patchSchema = z.strictObject({
  id: z.string().min(1).max(40),
  enabled: z.boolean().optional(),
  mode: z.enum(["auto", "review"]).optional(),
  professions: z.array(z.enum(PROFESSION_SLUGS)).max(PROFESSION_SLUGS.length).optional(),
});
const deleteSchema = z.strictObject({ id: z.string().min(1).max(40), removeVacancies: z.boolean().default(false) });

export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const q = new URL(req.url).searchParams.get("imports");
  const status = q === "published" || q === "skipped" || q === "all" ? q : "pending";
  const [sources, imports] = await Promise.all([listSources(), listImports(status)]);
  return ok({ sources, imports, aiEnabled: Boolean(process.env.GEMINI_API_KEY?.trim()) });
});

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, postSchema);
  if (input.action === "add") {
    const r = await addSources(input.channels, input.mode);
    if (!r.added.length && !r.existing.length) throw new ApiError(422, "Kanal nomi topilmadi — @kanal yoki t.me/kanal ko'rinishida yozing", { channels: "Masalan: @montaj_vakansiya" });
    await audit(session.sub, "admin_vacancy_source_add", { targetType: "vacancy_source", meta: { added: r.added, mode: input.mode } }, req);
    return ok(r);
  }
  if (input.action === "run") {
    const r = await runVacancyImport({ force: true, sourceId: input.sourceId, budgetMs: 50_000 });
    return ok(r);
  }
  const r = await decideImport(input.id, input.decision);
  await audit(session.sub, input.decision === "publish" ? "admin_vacancy_import_publish" : "admin_vacancy_import_reject", { targetType: "vacancy_import", targetId: input.id }, req);
  return ok(r);
});

export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { id, ...patch } = await parseBody(req, patchSchema);
  await updateSource(id, patch);
  await audit(session.sub, "admin_vacancy_source_update", { targetType: "vacancy_source", targetId: id, meta: patch }, req);
  return ok({ id });
});

export const DELETE = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { id, removeVacancies } = await parseBody(req, deleteSchema);
  const r = await deleteSource(id, removeVacancies);
  await audit(session.sub, "admin_vacancy_source_delete", { targetType: "vacancy_source", targetId: id, meta: { removeVacancies, closed: r.closed } }, req);
  return ok(r);
});
