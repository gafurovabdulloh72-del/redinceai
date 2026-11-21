import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Claude API — strukturali JSON javob (vakansiya saralash va h.k.).
 * Kalit: env `ANTHROPIC_API_KEY` (Vercel). Bo'lmasa null qaytadi — chaqiruvchi o'z zaxira mantiqiga o'tadi.
 * Model: env `ANTHROPIC_MODEL` (standart claude-opus-5-5). Rad etilsa server o'zi boshqa modelga o'tadi (`fallbacks: "default"`).
 * HECH QACHON xato tashlamaydi (tarmoq/limit/rad — null).
 */
const DEFAULT_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new Anthropic({ apiKey: key, maxRetries: 1 });
  return client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function claudeJson<S extends z.ZodType>(
  system: string,
  user: string,
  schema: S,
  opts: { timeoutMs?: number; maxTokens?: number; effort?: "low" | "medium" | "high" } = {},
): Promise<z.infer<S> | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const res = await c.beta.messages.parse(
      {
        model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 2048,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(schema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { timeout: opts.timeoutMs ?? 30_000 },
    );
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    return (res.parsed_output as z.infer<S> | null) ?? null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error("[claude] HTTP", e.status, e.message.slice(0, 200));
    else console.error("[claude]", e instanceof Error ? e.message : e);
    return null;
  }
}
