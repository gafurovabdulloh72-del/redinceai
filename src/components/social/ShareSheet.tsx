"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Search, Send } from "lucide-react";
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

  async function sendTo(p: Person) {
    if (sending || sent.has(p.username)) return;
    setSending(p.username);
    try {
      const body = `${note.trim() ? `${note.trim()}\n` : ""}${title ? `${title}\n` : ""}${abs}`.slice(0, 1900);
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: p.username, body }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Yuborilmadi");
      setSent((s) => new Set(s).add(p.username));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuborilmadi", "error");
    } finally {
      setSending(null);
    }
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
  return (
    <Sheet open={open} onClose={onClose} title="Ulashish" size="md">
      {loggedIn && (
        <>
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki @taxallus" aria-label="Kimga yuborish" className="field h-11 w-full pl-10 text-[14px]" />
          </label>
          <div className="mt-3 min-h-[148px]">
            {recent === null && !found ? (
              <div className="grid h-[148px] place-items-center text-fg-3">
                <Spinner />
              </div>
            ) : list.length === 0 ? (
              <p className="grid h-[148px] place-items-center text-center text-[13px] text-fg-3">{q ? "Hech kim topilmadi" : "Hali suhbatlar yo'q — ism bilan qidiring"}</p>
            ) : (
              <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
                {list.map((p) => {
                  const done = sent.has(p.username);
                  return (
                    <li key={p.key}>
                      <button type="button" onClick={() => void sendTo(p)} disabled={done || sending === p.username} className="press flex w-full flex-col items-center gap-1.5 text-center" aria-label={`${p.name} ga yuborish`}>
                        <span className="relative">
                          <Avatar name={p.name} src={p.avatarUrl} size={56} decorative />
                          <span className={cn("absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full ring-2 ring-surface", done ? "bg-success text-white" : "bg-accent text-white")}>
                            {sending === p.username ? <Spinner /> : done ? <Check size={13} strokeWidth={3} /> : <Send size={11} />}
                          </span>
                        </span>
                        <span className="w-full truncate text-[12px] font-medium text-fg-2">{done ? "Yuborildi" : p.name.split(" ")[0]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Izoh qo'shing (ixtiyoriy)" aria-label="Izoh" className="field mt-3 h-11 w-full text-[14px]" />
          <div className="my-4 h-px bg-line" />
        </>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => void copy()} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] border border-line bg-surface text-[14px] font-semibold text-fg transition hover:border-line-2">
          {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />} {copied ? "Nusxalandi" : "Havolani nusxalash"}
        </button>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(abs)}&text=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#229ED9] text-[14px] font-semibold text-white transition hover:brightness-110"
        >
          <Send size={16} /> Telegram
        </a>
      </div>
    </Sheet>
  );
}
