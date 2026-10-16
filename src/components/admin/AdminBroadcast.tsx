"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Megaphone, Send } from "lucide-react";

type Audience = "all" | "specialists" | "clients";
interface Counts {
  all: number;
  specialists: number;
  clients: number;
}

const AUDIENCE_LABEL: Record<Audience, string> = { all: "Hammaga", specialists: "Mutaxassislarga", clients: "Mijozlarga" };

/**
 * Admin: ommaviy e'lon/eslatma yuborish. Xabar har bir qabul qiluvchining saytdagi
 * bildirishnomasiga + Telegramiga (ulangan bo'lsa), belgilansa emailiga ham boradi.
 * Yuborishdan oldin ikki bosqichli tasdiq ("N ta foydalanuvchiga yuboriladi").
 */
export function AdminBroadcast() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [email, setEmail] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/broadcast")
      .then((r) => r.json())
      .then((j) => j?.ok && setCounts(j.data as Counts))
      .catch(() => undefined);
  }, []);

  const target = counts ? counts[audience] : null;
  const valid = title.trim().length >= 4 && body.trim().length >= 10;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), href: href.trim(), audience, email }),
      });
      const j = (await res.json()) as { ok: boolean; data?: { sent: number }; error?: string; fields?: Record<string, string> };
      // Maydon xatosi bo'lsa aynan uni ko'rsatamiz ("Ma'lumotlarni tekshiring"dan ko'ra aniqroq)
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborib bo'lmadi");
      setDone(`Yuborildi: ${j.data?.sent ?? 0} ta foydalanuvchiga${email ? " (email bilan)" : ""}`);
      setTitle("");
      setBody("");
      setHref("");
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuborib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">Sarlavha</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDone(null);
            }}
            maxLength={120}
            placeholder="Masalan: Texnik ishlar — bugun 22:00 dan 23:00 gacha"
            className="field h-11 w-full text-[14px]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">Matn</span>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDone(null);
            }}
            maxLength={600}
            rows={4}
            placeholder="Xabar matni — foydalanuvchi bildirishnomada va Telegramda ko'radi…"
            className="field w-full resize-y py-2.5 text-[14px] leading-relaxed"
          />
          <span className="text-right text-[11px] text-fg-3">{body.length}/600</span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">Havola (ixtiyoriy — sayt ichida yoki https://)</span>
          <input value={href} onChange={(e) => setHref(e.target.value)} maxLength={200} placeholder="/narxlar yoki https://t.me/kanal" className="field h-11 w-full text-[14px]" dir="ltr" />
        </label>

        {/* Auditoriya */}
        <div className="grid gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">Kimga</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Auditoriya">
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={audience === a}
                onClick={() => {
                  setAudience(a);
                  setConfirming(false);
                }}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition ${
                  audience === a ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg"
                }`}
              >
                {AUDIENCE_LABEL[a]}
                {counts && <span className={audience === a ? "opacity-70" : "text-fg-3"}>{counts[a]}</span>}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-fg-2">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            Email orqali ham yuborilsin{" "}
            <span className="text-fg-3">(email bildirishnomani o'chirganlarga bormaydi; Resend kvotasini hisobga oling)</span>
          </span>
        </label>

        {/* Yuborish: ikki bosqichli tasdiq */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {!confirming ? (
            <button
              type="button"
              disabled={!valid || busy}
              onClick={() => {
                setConfirming(true);
                setDone(null);
              }}
              className="btn-ink inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold disabled:opacity-50"
            >
              <Megaphone size={15} /> Yuborishga tayyorlash
            </button>
          ) : (
            <>
              <span className="text-[13px] font-semibold text-fg">
                {AUDIENCE_LABEL[audience]} — {target ?? "…"} ta foydalanuvchiga yuboriladi. Tasdiqlaysizmi?
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={send}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
              >
                <Send size={14} /> {busy ? "Yuborilmoqda…" : "Ha, yuborish"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="inline-flex h-10 items-center rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
                Bekor
              </button>
            </>
          )}
          {done && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success-text">
              <CheckCircle2 size={15} /> {done}
            </span>
          )}
          {error && <span className="text-[13px] font-semibold text-danger-text">{error}</span>}
        </div>
      </div>
    </div>
  );
}
