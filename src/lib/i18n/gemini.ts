import "server-only";

/**
 * Gemini orqali uz→ru tarjima (avtomatik RU qatlam uchun). Env: GEMINI_API_KEY (Google AI Studio, bepul tarif),
 * ixtiyoriy GEMINI_MODEL (standart gemini-2.0-flash). Kalit yo'q — null (qatlam lug'at bilan cheklanadi).
 * Xost qat'iy (SSRF yo'q), so'rovda faqat UI matnlari ketadi.
 */
const HOST = "https://generativelanguage.googleapis.com";

export function isAutoTranslateConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

const SYSTEM = `Ты переводчик интерфейса веб-приложения «Kasb Egalari» (Узбекистан: маркетплейс видеографов/монтажёров/дизайнеров, соцсеть, курсы наставников, эфиры, вакансии). Переведи КАЖДУЮ строку с узбекского (латиница) на русский. Стиль: коротко, как в интерфейсе, обращение на «вы», кнопки — инфинитив («Сохранить»). Термины: mutaxassis → специалист, ijodkor → автор, mijoz → заказчик, buyurtma → заказ, efir → эфир, ustoz → наставник, jamoa → сообщество, taklif → отклик, e'lon → объявление, so'm → сум, Kasb Egalari — без перевода. Плейсхолдеры вида {x} или $\{x} сохраняй без изменений. Если строка не узбекская — верни её без изменений. Ответ — ТОЛЬКО JSON-массив строк той же длины и порядка, без пояснений.`;

export async function geminiTranslate(texts: string[]): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || texts.length === 0) return null;
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const url = `${HOST}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(texts) }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      console.error("[gemini] HTTP", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length !== texts.length || !arr.every((x) => typeof x === "string")) return null;
    return arr as string[];
  } catch (e) {
    console.error("[gemini]", e instanceof Error ? e.message : e);
    return null;
  }
}
