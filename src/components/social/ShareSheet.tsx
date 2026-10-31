"use client";

import { telegramShareHref } from "@/lib/telegram-share";
import { useEffect, useRef, useState } from "react";
import { Check, Link2, Search, Send } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Person {
  key: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Ulashish varag'i (Instagram uslubi): yuqorida — sayt ichidagi odamlar (so'nggi suhbatlar + @taxallus/ism qidiruvi),
 * bosilganda havola ixtiyoriy izoh bilan DM sifatida yuboriladi (POST /api/chat — dm_policy/blok qoidalari serverda);
 * pastda — havolani nusxalash va Telegram. Mehmon uchun faqat tashqi ulashish.
 */
export function ShareSheet({ open, onClose, url, title, loggedIn }: { open: boolean; onClose: () => void; url: string; title: string; loggedIn: boolean }) {
  const [recent, setRecent] = useState<Person[] | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const abs = url.startsWith("http") ? url : typeof window !== "undefined" ? `${window.location.origin}${url}` : url;

  useEffect(() => {
    if (!open || !loggedIn || recent) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: { items: Array<{ id: string; peer: { username: string | null; name: string; avatarUrl: string | null; isBanned: boolean } }> } }) => {
        const items = (j.data?.items ?? []).filter((c) => c.peer.username && !c.peer.isBanned).slice(0, 12);
        setRecent(items.map((c) => ({ key: c.id, username: c.peer.username as string, name: c.peer.name, avatarUrl: c.peer.avatarUrl })));
      })
      .catch(() => setRecent([]));
  }, [open, loggedIn, recent]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const needle = q.trim();
    if (!needle) {
      setFound(null);
      return;
    }
    timer.current = window.setTimeout(() => {
      fetch(`/api/users/mention?q=${encodeURIComponent(needle)}`)
        .then((r) => r.json())
        .then((j: { data?: { items: Array<{ id: string; username: string; name: string; avatarUrl: string | null }> } }) => setFound((j.data?.items ?? []).map((u) => ({ key: u.id, username: u.username, name: u.name, avatarUrl: u.avatarUrl }))))
        .catch(() => setFound([]));
    }, 250);
  }, [q]);

  const [picked, setPicked] = useState<Person[]>([]);
  const toggle = (p: Person) => setPicked((l) => (l.some((x) => x.username === p.username) ? l.filter((x) => x.username !== p.username) : [...l, p]));

  /** Tanlanganlarga bir vaqtda yuboradi (Instagram kabi); har biri alohida DM, xato bo'lsa xabar beriladi */
  async function sendAll() {
    if (sending || !picked.length) return;
    setSending("all");
    const body = `${note.trim() ? `${note.trim()}\n` : ""}${title ? `${title}\n` : ""}${abs}`.slice(0, 1900);
    let okCount = 0;
    let lastErr = "";
    for (const p of picked) {
      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: p.username, body }) });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Yuborilmadi");
        okCount++;
        setSent((x) => new Set(x).add(p.username));
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "Yuborilmadi";
      }
    }
    setSending(null);
    setPicked([]);
    setNote("");
    if (okCount) showToast(okCount === 1 ? "Yuborildi" : `${okCount} kishiga yuborildi`, "success");
    if (lastErr) showToast(lastErr, "error");
    if (okCount && !lastErr) onClose();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("Nusxalab bo'lmadi", "error");
    }
  }

  const list = found ?? recent ?? [];
  const actions = (
    <div className="no-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 pb-1 pt-1">
      <button type="button" onClick={() => void copy()} className="press flex w-[68px] shrink-0 flex-col items-center gap-1.5 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-fg/7 text-fg">{copied ? <Check size={22} className="text-success" /> : <Link2 size={22} />}</span>
        <span className="text-[11.5px] font-medium text-fg-2">{copied ? "Nusxalandi" : "Havola"}</span>
      </button>
      <a href={telegramShareHref(abs, title)} target="_blank" rel="noopener noreferrer" className="press flex w-[68px] shrink-0 flex-col items-center gap-1.5 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#229ED9] text-white">
          <Send size={22} />
        </span>
        <span className="text-[11.5px] font-medium text-fg-2">Telegram</span>
      </a>
    </div>
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ulashish"
      size="md"
      footer={
        loggedIn && picked.length > 0 ? (
          <div className="space-y-2.5 pb-1">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Xabar yozing…" aria-label="Izoh" className="h-11 w-full rounded-full bg-fg/6 px-4 text-[14px] text-fg outline-none placeholder:text-fg-3 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-fg/15" />
            <button type="button" onClick={() => void sendAll()} disabled={sending !== null} className="btn-accent flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold disabled:opacity-60">
              {sending ? <Spinner /> : <Send size={16} />} Yuborish{picked.length > 1 ? ` (${picked.length})` : ""}
            </button>
          </div>
        ) : (
          <div className="border-t border-line pb-1 pt-3">{actions}</div>
        )
      }
    >
      {loggedIn ? (
        <>
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish" aria-label="Kimga yuborish" className="h-11 w-full rounded-full bg-fg/6 pl-11 pr-4 text-[14.5px] text-fg outline-none placeholder:text-fg-3 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-fg/15" />
          </label>
          <div className="mt-4 min-h-[200px] pb-3">
            {recent === null && !found ? (
              <div className="grid h-[200px] place-items-center text-fg-3">
                <Spinner />
              </div>
            ) : list.length === 0 ? (
              <p className="grid h-[200px] place-items-center px-6 text-center text-[13.5px] leading-relaxed text-fg-3">{q ? "Hech kim topilmadi" : "Hali suhbatlar yo'q — ism bilan qidiring"}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
                {list.map((p) => {
                  const on = picked.some((x) => x.username === p.username);
                  const done = sent.has(p.username) && !on;
                  return (
                    <li key={p.key}>
                      <button type="button" onClick={() => toggle(p)} className="press flex w-full flex-col items-center gap-1.5 text-center" aria-pressed={on} aria-label={p.name}>
                        <span className="relative">
                          <span className={cn("block rounded-full p-[3px] transition", on ? "bg-accent" : "bg-transparent")}>
                            <Avatar name={p.name} src={p.avatarUrl} size={64} decorative />
                          </span>
                          {on && (
                            <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-accent text-white ring-2 ring-surface">
                              <Check size={14} strokeWidth={3} />
                            </span>
                          )}
                        </span>
                        <span className="w-full truncate px-1 text-[12.5px] font-medium text-fg">{p.name}</span>
                        {done && <span className="-mt-1 text-[11px] text-success-text">Yuborildi</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        actions
      )}
    </Sheet>
  );
}
