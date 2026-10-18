"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Megaphone, Send } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Audience = "all" | "specialists" | "clients";
/** Auditoriyaning kanal kesimi: sayt (hammaga), Telegram (ulaganlar), email (yoqilganlar) */
interface ChannelStat {
  total: number;
  telegram: number;
  email: number;
}
interface Counts {
  all: ChannelStat;
  specialists: ChannelStat;
  clients: ChannelStat;
  emailConfigured: boolean;
  telegramEnabled: boolean;
  /** So'nggi e'lonlar: saytdagi qo'ng'iroqchaga yozilgani va o'qilgani */
  recent: Array<{ title: string; total: number; readCount: number; at: number }>;
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

  async function send(test = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), href: href.trim(), audience, email, test }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        data?: { sent: number; channels?: { site: number; telegram: number; email: number } };
        error?: string;
        fields?: Record<string, string>;
      };
      // Maydon xatosi bo'lsa aynan uni ko'rsatamiz ("Ma'lumotlarni tekshiring"dan ko'ra aniqroq)
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborib bo'lmadi");
      if (test) {
        // Forma tozalanmaydi — admin testdan keyin xuddi shu matnni hammaga yuboradi
        setDone("Test faqat o'zingizga yuborildi — Telegram va saytdagi qo'ng'iroqchani tekshiring");
      } else {
        const ch = j.data?.channels;
        setDone(
          ch
            ? `Yuborildi — saytda: ${ch.site} ta, Telegramga: ${ch.telegram} ta, emailga: ${ch.email} ta`
            : `Yuborildi: ${j.data?.sent ?? 0} ta foydalanuvchiga${email ? " (email bilan)" : ""}`,
        );
        setTitle("");
        setBody("");
        setHref("");
        setConfirming(false);
      }
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

        {/* Jonli ko'rinish: foydalanuvchi saytda va Telegramda nimani ko'radi */}
        {(title.trim() || body.trim()) && (
          <div className="expand-in grid gap-3 sm:grid-cols-2" aria-label="Ko'rinish">
            <div className="rounded-[var(--r-sm)] border border-line p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">Saytda (qo&apos;ng&apos;iroqcha)</p>
              <div className="mt-2 flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                  <Bell size={14} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-fg">{title.trim() || "Sarlavha"}</p>
                  <p className="line-clamp-2 text-[12.5px] leading-snug text-fg-2">{body.trim() || "Matn…"}</p>
                  {href.trim() && <p className="mt-0.5 truncate text-[11.5px] text-fg-4">{href.trim()}</p>}
                </div>
              </div>
            </div>
            <div className="rounded-[var(--r-sm)] border border-line p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">Telegramda</p>
              <div className="mt-2 max-w-[92%] rounded-[12px] rounded-tl-[4px] bg-surface-2 px-3 py-2 text-[13px] leading-snug text-fg">
                <p className="font-semibold">{title.trim() || "Sarlavha"}</p>
                <p className="whitespace-pre-wrap text-fg-2">{body.trim() || "Matn…"}</p>
              </div>
              {href.trim() && <p className="mt-1.5 inline-flex rounded-[8px] border border-line px-2.5 py-1 text-[12px] font-semibold text-fg-2">{href.trim().startsWith("https://") ? "Havolani ochish" : "Saytda ochish"}</p>}
            </div>
          </div>
        )}

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
                {counts && <span className={audience === a ? "opacity-70" : "text-fg-3"}>{counts[a].total}</span>}
              </button>
            ))}
          </div>
          {counts && target && (
            <p className="text-[12.5px] leading-relaxed text-fg-3">
              Kanallar kesimi: saytda <strong className="text-fg-2">{target.total}</strong> ta · Telegramga{" "}
              <strong className="text-fg-2">{counts.telegramEnabled ? target.telegram : 0}</strong> ta
              {counts.telegramEnabled ? " (botni ulaganlar)" : " (bot sozlanmagan)"} · emailga{" "}
              <strong className="text-fg-2">{counts.emailConfigured ? target.email : 0}</strong> ta
              {counts.emailConfigured ? " (email yoqilganlar)" : " (sozlanmagan)"}
            </p>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-fg-2">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
            disabled={counts ? !counts.emailConfigured : false}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)] disabled:opacity-40"
          />
          <span>
            Email orqali ham yuborilsin{" "}
            <span className="text-fg-3">(email bildirishnomani o'chirganlarga bormaydi; Resend kvotasini hisobga oling)</span>
            {counts && !counts.emailConfigured && (
              <span className="mt-1 block text-[12.5px] font-semibold text-warning-text">
                Email hali sozlanmagan — Vercel'da RESEND_API_KEY va MAIL_FROM yo'q, shuning uchun xat chiqmaydi. Xabar sayt bildirishnomasi + Telegram orqali boradi.
              </span>
            )}
          </span>
        </label>

        {/* Yuborish: ikki bosqichli tasdiq */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {!confirming ? (
            <>
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
              <button
                type="button"
                disabled={!valid || busy}
                onClick={() => void send(true)}
                title="Xabar auditoriyaga emas, faqat sizning o'zingizga boradi — natijani ko'rish uchun"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg-2 transition hover:text-fg disabled:opacity-50"
              >
                {busy ? "Yuborilmoqda…" : "O'zimga test"}
              </button>
            </>
          ) : (
            <>
              <span className="text-[13px] font-semibold text-fg">
                {AUDIENCE_LABEL[audience]} — {target?.total ?? "…"} ta foydalanuvchiga yuboriladi. Tasdiqlaysizmi?
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send()}
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

        {/* So'nggi e'lonlar: yetib borgani (qo'ng'iroqcha) va o'qilgani — "ketdimi?" savoliga dalil */}
        {counts && counts.recent.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">So&apos;nggi e&apos;lonlar</p>
            <ul className="mt-1 divide-y divide-line">
              {counts.recent.map((b) => (
                <li key={`${b.title}-${b.at}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg">{b.title}</span>
                  <span className="shrink-0 text-fg-3">
                    {formatDateTime(b.at)} · {b.total} ta qo&apos;ng&apos;iroqchada ·{" "}
                    <span className={b.readCount > 0 ? "font-semibold text-success-text" : ""}>{b.readCount} tasi o&apos;qidi</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-relaxed text-fg-4">
              Sayt bildirishnomasi foydalanuvchi saytga kirganda ko&apos;rinadi. Darhol telefoniga yetib borishi uchun foydalanuvchi Telegram botni ulagan bo&apos;lishi
              (kabinetda eslatma chiqadi) yoki email sozlangan bo&apos;lishi kerak.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
