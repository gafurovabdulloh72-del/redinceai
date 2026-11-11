"use client";

import type React from "react";

import { useCallback, useEffect, useState } from "react";
import { Ago } from "@/components/ui/Ago";
import { KeyRound, LogOut, Monitor, Smartphone } from "lucide-react";
import { adminApi, errText } from "@/components/admin/admin-api";
import { Spinner } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Admin: foydalanuvchining kirish holati va sessiyalari (Foydalanuvchilar → «⋯» → «Sessiyalar va parol»).
 * «Hisobim o'g'irlandi» / «kira olmayapman» murojaatlari uchun: faol qurilmalar ro'yxati, bittasini yoki hammasini yopish,
 * parol tiklash havolasini yuborish (havola faqat foydalanuvchining o'z emaili/Telegramiga ketadi — admin uni ko'rmaydi).
 * GET/POST /api/admin/users/[id]/sessions, POST /api/admin/users/[id]/parol.
 * Tartib: holat → ikki asosiy amal → sessiyalar (uzun ro'yxat amallarni pastga surib yubormasin; 6 tadan ko'pi yig'ilgan).
 */
interface SessionRow {
  id: string | null;
  label: string;
  mobile: boolean;
  current: boolean;
  lastSeenAt: number;
  createdAt: number;
}
interface Data {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isBanned: boolean;
    lastLoginAt: number | null;
    passwordChangedAt: number | null;
    totpEnabled: boolean;
    emailVerified: boolean;
    telegramLinked: boolean;
    googleLinked: boolean;
    placeholderEmail: boolean;
  };
  sessions: SessionRow[];
}

/** Dastlab ko'rinadigan sessiyalar soni (qolgani «Yana N ta» ostida) */
const VISIBLE = 6;

/* Eslatma: matn qatorlari <div> — globals'dagi layersiz `p { text-wrap: pretty }` qoidasi `truncate`ni yengadi */
function Fact({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="min-w-0 rounded-[var(--r-sm)] border border-line px-3 py-2">
      <div className="truncate text-[11.5px] text-fg-4">{label}</div>
      <div className={cn("truncate text-[13px] font-semibold", tone === "ok" ? "text-success-text" : tone === "warn" ? "text-warning-text" : "text-fg")} title={typeof value === "string" ? value : undefined}>
        {value}
      </div>
    </div>
  );
}

export function UserSecuritySheet({ user, onClose }: { user: { id: string; name: string } | null; onClose: () => void }) {
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const id = user?.id ?? null;

  const load = useCallback(async (uid: string) => {
    try {
      setData(await adminApi<Data>(`/api/admin/users/${encodeURIComponent(uid)}/sessions`));
      setError(null);
    } catch (e) {
      setError(errText(e, "Yuklab bo'lmadi"));
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setData(null);
    setError(null);
    setShowAll(false);
    void load(id);
  }, [id, load]);

  async function revokeOne(s: SessionRow) {
    if (!id || !s.id) return;
    setBusy(s.id);
    try {
      await adminApi(`/api/admin/users/${encodeURIComponent(id)}/sessions`, { method: "POST", json: { action: "revoke", sessionId: s.id } });
      setData((d) => (d ? { ...d, sessions: d.sessions.filter((x) => x.id !== s.id) } : d));
      showToast("Sessiya yopildi");
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function revokeAll() {
    if (!id || !data) return;
    if (!(await confirm({ title: "Barcha sessiyalarni tugatasizmi?", text: `${data.user.name} barcha qurilmalardan chiqariladi va qayta kirishi kerak bo'ladi. Unga bildirishnoma yuboriladi.`, confirmLabel: "Tugatish", danger: true }))) return;
    setBusy("all");
    try {
      await adminApi(`/api/admin/users/${encodeURIComponent(id)}/sessions`, { method: "POST", json: { action: "revoke_all" } });
      setData((d) => (d ? { ...d, sessions: [] } : d));
      showToast("Barcha sessiyalar tugatildi");
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function sendReset() {
    if (!id || !data) return;
    const where = data.user.placeholderEmail ? "ulangan Telegramiga" : `emailiga (${data.user.email})`;
    if (!(await confirm({ title: "Parol tiklash havolasini yuborasizmi?", text: `Havola foydalanuvchining ${where} ketadi, 1 soat amal qiladi va bir marta ishlaydi. Siz havolani ko'rmaysiz.`, confirmLabel: "Yuborish" }))) return;
    setBusy("reset");
    try {
      const d = await adminApi<{ channel: "email" | "telegram" }>(`/api/admin/users/${encodeURIComponent(id)}/parol`, { method: "POST", json: {} });
      showToast(d.channel === "telegram" ? "Havola Telegramga yuborildi" : "Havola emailga yuborildi");
    } catch (e) {
      showToast(errText(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const u = data?.user;
  // Server «shu qurilma»ni faqat admin o'z hisobiga qaraganda belgilaydi — demak bu o'zining qatori
  const self = Boolean(data?.sessions.some((s) => s.current));
  const sessions = data?.sessions ?? [];
  const shown = showAll ? sessions : sessions.slice(0, VISIBLE);

  return (
    <Sheet open={Boolean(user)} onClose={onClose} title={user ? `${user.name} — sessiyalar va parol` : "Sessiyalar va parol"} desktop="center" size="lg">
      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-16 text-fg-3">
          <Spinner /> Yuklanmoqda…
        </div>
      )}
      {error && (
        <p role="alert" className="py-10 text-center text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}
      {data && u && (
        <div className="space-y-4 pb-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="Oxirgi kirish" value={u.lastLoginAt ? <Ago at={u.lastLoginAt} /> : "Hali kirmagan"} />
            <Fact label="Parol o'zgartirilgan" value={u.passwordChangedAt ? formatDateTime(u.passwordChangedAt) : "O'zgartirilmagan"} />
            <Fact label="Ikki bosqichli himoya" value={u.totpEnabled ? "Yoqilgan" : "Yoqilmagan"} tone={u.totpEnabled ? "ok" : undefined} />
            <Fact label="Email" value={u.placeholderEmail ? "Yo'q (Telegram hisobi)" : u.emailVerified ? "Tasdiqlangan" : "Tasdiqlanmagan"} tone={u.placeholderEmail || !u.emailVerified ? "warn" : "ok"} />
            <Fact label="Telegram" value={u.telegramLinked ? "Ulangan" : "Ulanmagan"} />
            <Fact label="Google" value={u.googleLinked ? "Ulangan" : "Ulanmagan"} />
          </div>

          {self ? (
            <p className="rounded-[var(--r-sm)] bg-fg/[0.04] px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-3">Bu — sizning hisobingiz. O&apos;z sessiyalaringiz va parolingizni Kabinet → Xavfsizlik bo&apos;limida boshqaring.</p>
          ) : (
            // sm:flex-1 (flex-1 emas): ustun yo'nalishida `flex: 1 1 0%` balandlikni nolga tortadi — tugma h-11 o'rniga matn bo'yiga siqilardi
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void sendReset()} disabled={busy !== null || u.isBanned} title={u.isBanned ? "Bloklangan foydalanuvchiga yuborilmaydi" : undefined} className="btn-ink inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[13.5px] font-semibold disabled:opacity-50 sm:flex-1">
                <KeyRound size={15} /> {busy === "reset" ? "Yuborilmoqda…" : "Parol tiklash havolasini yuborish"}
              </button>
              <button type="button" onClick={() => void revokeAll()} disabled={busy !== null || sessions.length === 0} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-danger/40 px-4 text-[13.5px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-50 sm:flex-1">
                <LogOut size={15} /> {busy === "all" ? "Tugatilmoqda…" : "Barcha sessiyalarini tugatish"}
              </button>
            </div>
          )}

          <section aria-labelledby="h-sessiyalar">
            <h3 id="h-sessiyalar" className="mb-2 flex items-center justify-between gap-2 text-[12.5px] font-semibold text-fg-3">
              Faol sessiyalar
              <span className="tabular-nums text-fg-4">{sessions.length} ta</span>
            </h3>
            {sessions.length === 0 ? (
              <p className="rounded-[var(--r-sm)] border border-line px-3 py-5 text-center text-[13px] text-fg-3">Faol sessiya yo&apos;q — foydalanuvchi hech qaysi qurilmada kirmagan.</p>
            ) : (
              <>
                <ul className="divide-y divide-line rounded-[var(--r-sm)] border border-line">
                  {shown.map((s, i) => {
                    const Icon = s.mobile ? Smartphone : Monitor;
                    return (
                      <li key={s.id ?? `cur-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                        <Icon size={17} className="shrink-0 text-fg-3" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-fg">
                            <span className="min-w-0 truncate">{s.label}</span>
                            {s.current && <span className="shrink-0 rounded-full bg-success-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-success-text">shu qurilma</span>}
                          </div>
                          {/* Ikki bo'lak alohida: tor ekranda sana kesilmaydi — «kirgan» butunligicha keyingi qatorga tushadi */}
                          <div className="flex flex-wrap gap-x-3 text-[12px] text-fg-3">
                            <span className="whitespace-nowrap">faol: <Ago at={s.lastSeenAt} /></span>
                            <span className="whitespace-nowrap">kirgan: {formatDateTime(s.createdAt)}</span>
                          </div>
                        </div>
                        {s.id && !s.current && !self && (
                          <button type="button" onClick={() => void revokeOne(s)} disabled={busy !== null} className="inline-flex h-8 shrink-0 items-center rounded-full border border-line-2 px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
                            {busy === s.id ? "…" : "Yopish"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {sessions.length > VISIBLE && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-2 inline-flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold text-fg-2 transition-colors hover:bg-fg/6 hover:text-fg">
                    {showAll ? "Kamroq ko'rsatish" : `Yana ${sessions.length - VISIBLE} ta ko'rsatish`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}
