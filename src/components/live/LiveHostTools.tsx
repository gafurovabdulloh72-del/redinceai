"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, Hourglass, KeyRound, Loader2, Shuffle, Table2, UserCheck, UserX, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Resp<T> = { ok: boolean; data?: T; error?: string };
type WaitRow = { id: string; name: string; avatarUrl: string | null; at: number };
type Breakout = { id: string; name: string; position: number; members: { id: string; name: string }[] };
type AttendRow = { userId: string; name: string; username: string | null; sessions: number; firstAt: number; lastAt: number; minutes: number };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = (await r.json().catch(() => ({}))) as Resp<T>;
  if (!r.ok || !j.data) throw new Error(j.error || "Xatolik");
  return j.data;
}

/**
 * Kutish xonasi navbati (boshlovchi/hammuallif): har 4 s yangilanadi.
 * `onCount` — pastki paneldagi belgi uchun navbatdagilar soni.
 */
export function WaitingQueue({ streamId, flash, onCount }: { streamId: string; flash: (t: string) => void; onCount?: (n: number) => void }) {
  const [rows, setRows] = useState<WaitRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call<{ items: WaitRow[] }>(`/api/live/${streamId}/navbat`);
      setRows(d.items);
      onCount?.(d.items.length);
    } catch {
      setRows([]);
    }
  }, [streamId, onCount]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [load]);

  async function decide(userId: string, allow: boolean) {
    setBusy(userId);
    try {
      await call(`/api/live/${streamId}/navbat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, allow }) });
      setRows((l) => (l ?? []).filter((r) => (userId === "*" ? false : r.id !== userId)));
      if (userId === "*") onCount?.(0);
      flash(allow ? "Ruxsat berildi" : "Rad etildi");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <p className="py-6 text-center text-white/45"><Loader2 size={16} className="inline animate-spin" /></p>;
  if (!rows.length)
    return (
      <p className="px-3 py-6 text-center text-[13px] text-white/45">
        <Hourglass size={16} className="mx-auto mb-1.5 block text-white/35" />
        Navbatda hech kim yo&apos;q.
      </p>
    );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-[12.5px] font-semibold text-white/60">Navbatda {rows.length}</p>
        <button type="button" disabled={busy !== null} onClick={() => void decide("*", true)} className="h-8 rounded-lg bg-accent px-3 text-[12px] font-bold text-white disabled:opacity-50">
          Hammasiga ruxsat
        </button>
      </div>
      <ul className="divide-y divide-white/5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-[13px] font-bold">
              {r.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (r.name.trim()[0] ?? "?").toUpperCase()
              )}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r.name}</p>
            <button type="button" disabled={busy === r.id} onClick={() => void decide(r.id, true)} aria-label="Ruxsat berish" title="Ruxsat berish" className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white disabled:opacity-50">
              <UserCheck size={15} />
            </button>
            <button type="button" disabled={busy === r.id} onClick={() => void decide(r.id, false)} aria-label="Rad etish" title="Rad etish" className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-danger hover:bg-danger hover:text-white disabled:opacity-50">
              <UserX size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kirish qoidalari: kutish xonasi va efir kodi */
export function EntryRules({ streamId, waitingRoom, passcode, flash, onChange }: { streamId: string; waitingRoom: boolean; passcode: string | null; flash: (t: string) => void; onChange: (p: { waitingRoom: boolean; passcode: string | null }) => void }) {
  const [code, setCode] = useState(passcode ?? "");
  const [busy, setBusy] = useState(false);

  async function save(patch: { waitingRoom?: boolean; passcode?: string | null }) {
    setBusy(true);
    try {
      const r = await fetch(`/api/live/${streamId}/sozlama`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || "Saqlanmadi");
      onChange({ waitingRoom: patch.waitingRoom ?? waitingRoom, passcode: patch.passcode !== undefined ? patch.passcode : passcode });
      flash("Saqlandi");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <label className="flex items-center gap-2.5 rounded-xl bg-white/5 p-3">
        <input type="checkbox" checked={waitingRoom} disabled={busy} onChange={(e) => void save({ waitingRoom: e.target.checked })} className="h-4 w-4 accent-white" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">Kutish xonasi</span>
          <span className="block text-[11.5px] text-white/50">Har bir yangi odamni siz efirga qo&apos;shasiz</span>
        </span>
      </label>
      <div className="rounded-xl bg-white/5 p-3">
        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
          <KeyRound size={14} className="text-white/60" /> Efir kodi
        </p>
        <p className="mt-0.5 text-[11.5px] text-white/50">4–12 belgi (harf/raqam). Bo&apos;sh qoldirsangiz kod talab qilinmaydi.</p>
        <div className="mt-2 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12))}
            placeholder="Kodsiz"
            aria-label="Efir kodi"
            className="h-9 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-[13.5px] tracking-widest text-white outline-none placeholder:tracking-normal placeholder:text-white/35"
          />
          <button type="button" disabled={busy || (code.length > 0 && code.length < 4)} onClick={() => void save({ passcode: code || null })} className="h-9 shrink-0 rounded-lg bg-white/15 px-3 text-[12.5px] font-semibold hover:bg-white/25 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Kichik xonalar (breakout): yaratish, avtomatik taqsimlash, ochish/yopish */
export function BreakoutPanel({ streamId, open, viewerIds, flash, onOpenChange }: { streamId: string; open: boolean; viewerIds: string[]; flash: (t: string) => void; onOpenChange: (o: boolean) => void }) {
  const [rooms, setRooms] = useState<Breakout[] | null>(null);
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRooms((await call<{ items: Breakout[] }>(`/api/live/${streamId}/xonalar`)).items);
    } catch {
      setRooms([]);
    }
  }, [streamId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: unknown, after?: () => void) {
    setBusy(true);
    try {
      const d = await call<{ items?: Breakout[]; open?: boolean }>(`/api/live/${streamId}/xonalar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (d.items) setRooms(d.items);
      after?.();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {!rooms?.length ? (
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-[13.5px] font-semibold">Kichik xonalar</p>
          <p className="mt-0.5 text-[11.5px] text-white/50">Ishtirokchilarni guruhlarga bo&apos;lib alohida gaplashtiring.</p>
          <div className="mt-2.5 flex items-center gap-2">
            <label htmlFor="bo-count" className="text-[12.5px] text-white/60">
              Nechta
            </label>
            <input id="bo-count" type="number" min={2} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(2, Number(e.target.value) || 2)))} className="h-9 w-16 rounded-lg bg-white/10 px-2 text-center text-[13.5px] text-white outline-none" />
            <button type="button" disabled={busy} onClick={() => void act({ action: "create", count }, () => flash(`${count} ta xona yaratildi`))} className="btn-accent h-9 px-3 text-[12.5px]">
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Yaratish"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => void act({ action: "auto", userIds: viewerIds }, () => flash("Avtomatik taqsimlandi"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[12.5px] font-semibold hover:bg-white/20 disabled:opacity-50">
              <Shuffle size={14} /> Avtomatik
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act({ action: "open", open: !open }, () => {
                  onOpenChange(!open);
                  flash(open ? "Kichik xonalar yopildi" : "Kichik xonalar ochildi");
                })
              }
              className={cn("h-9 rounded-lg px-3 text-[12.5px] font-bold disabled:opacity-50", open ? "bg-danger text-white" : "btn-accent")}
            >
              {open ? "Yopish" : "Ochish"}
            </button>
            <button type="button" disabled={busy} onClick={() => void act({ action: "create", count: rooms.length }, () => flash("Xonalar qayta yaratildi"))} className="ml-auto h-9 rounded-lg px-2 text-[12px] text-white/50 hover:text-white">
              Tozalash
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {rooms.map((r) => (
              <li key={r.id} className="rounded-xl bg-white/5 p-2.5">
                <p className="text-[13px] font-semibold">
                  {r.name} <span className="font-normal text-white/45">· {r.members.length} kishi</span>
                </p>
                {r.members.length > 0 && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-white/50">{r.members.map((m) => m.name).join(", ")}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Davomat: jadval + CSV yuklab olish */
export function AttendancePanel({ streamId }: { streamId: string }) {
  const [rows, setRows] = useState<AttendRow[] | null>(null);
  useEffect(() => {
    void call<{ items: AttendRow[] }>(`/api/live/${streamId}/davomat`)
      .then((d) => setRows(d.items))
      .catch(() => setRows([]));
  }, [streamId]);

  if (rows === null)
    return (
      <p className="py-6 text-center text-white/45">
        <Loader2 size={16} className="inline animate-spin" />
      </p>
    );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/60">
          <Table2 size={14} /> {rows.length} ishtirokchi
        </p>
        <a href={`/api/live/${streamId}/davomat?csv=1`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[12px] font-semibold hover:bg-white/20">
          <Download size={13} /> CSV
        </a>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-white/45">Hali hech kim kirmagan.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{r.name}</span>
                <span className="block text-[11px] text-white/45">
                  {new Date(r.firstAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })} — {new Date(r.lastAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                  {r.sessions > 1 ? ` · ${r.sessions} kirish` : ""}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-[12.5px] font-semibold text-white/70">{r.minutes} daq</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Boshqaruv paneli tablari (navbat · xonalar · davomat · kirish) */
export function HostTools({ streamId, tab, setTab, waitingCount, waitingRoom, passcode, breakoutOpen, viewerIds, flash, onRules, onBreakoutOpen, onWaitingCount, onClose }: {
  streamId: string;
  tab: "navbat" | "xonalar" | "davomat" | "kirish";
  setTab: (t: "navbat" | "xonalar" | "davomat" | "kirish") => void;
  waitingCount: number;
  waitingRoom: boolean;
  passcode: string | null;
  breakoutOpen: boolean;
  viewerIds: string[];
  flash: (t: string) => void;
  onRules: (p: { waitingRoom: boolean; passcode: string | null }) => void;
  onBreakoutOpen: (o: boolean) => void;
  onWaitingCount: (n: number) => void;
  onClose: () => void;
}) {
  const tabs = [
    ["navbat", `Navbat${waitingCount ? ` ${waitingCount}` : ""}`],
    ["xonalar", "Xonalar"],
    ["davomat", "Davomat"],
    ["kirish", "Kirish"],
  ] as const;
  return (
    <>
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("h-8 rounded-lg px-2.5 text-[12.5px] font-semibold", tab === k ? "bg-white/15" : "text-white/60 hover:text-white")}>
            {label}
          </button>
        ))}
        <button type="button" aria-label="Yopish" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10">
          <X size={16} />
        </button>
      </div>
      {tab === "navbat" ? (
        <WaitingQueue streamId={streamId} flash={flash} onCount={onWaitingCount} />
      ) : tab === "xonalar" ? (
        <BreakoutPanel streamId={streamId} open={breakoutOpen} viewerIds={viewerIds} flash={flash} onOpenChange={onBreakoutOpen} />
      ) : tab === "davomat" ? (
        <AttendancePanel streamId={streamId} />
      ) : (
        <EntryRules streamId={streamId} waitingRoom={waitingRoom} passcode={passcode} flash={flash} onChange={onRules} />
      )}
    </>
  );
}

/** Hammuallif belgisi (ro'yxatdagi tugma) */
export function CohostToggle({ streamId, userId, on, flash, onToggle }: { streamId: string; userId: string; on: boolean; flash: (t: string) => void; onToggle: (on: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={on}
      title={on ? "Hammuallifni olib tashlash" : "Hammuallif qilish"}
      aria-label={on ? "Hammuallifni olib tashlash" : "Hammuallif qilish"}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch(`/api/live/${streamId}/hammuallif`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
          const j = (await r.json()) as Resp<{ on: boolean }>;
          if (!r.ok || !j.data) throw new Error(j.error || "Xatolik");
          onToggle(j.data.on);
          flash(j.data.on ? "Hammuallif qilindi" : "Hammuallif olib tashlandi");
        } catch (e) {
          flash(e instanceof Error ? e.message : "Xatolik");
        } finally {
          setBusy(false);
        }
      }}
      className={cn("grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-50", on ? "bg-accent text-white" : "bg-white/10 hover:bg-white/20")}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : on ? <Check size={14} /> : <UserCheck size={14} />}
    </button>
  );
}
