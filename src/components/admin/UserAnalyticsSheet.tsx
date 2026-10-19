"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarCheck, Clock, Footprints, TrendingUp } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Spinner } from "@/components/ui";
import { formatMinutes, type UserAnalytics } from "@/lib/analytics/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type ApiResponse = { ok: true; data: UserAnalytics } | { ok: false; error: string };

/** Admin: bitta foydalanuvchining faollik tahlili — pastki varaqda (statistika + 30 kunlik grafik + asosiy faoliyat) */
export function UserAnalyticsSheet({ user, onClose }: { user: { id: string; name: string } | null; onClose: () => void }) {
  const [data, setData] = useState<UserAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setData(null);
    setError(null);
    let alive = true;
    void fetch(`/api/admin/users/${encodeURIComponent(user.id)}/analytics`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((j) => {
        if (!alive) return;
        if (j.ok) setData(j.data);
        else setError(j.error || "Yuklab bo'lmadi");
      })
      .catch(() => alive && setError("Tarmoq xatosi"));
    return () => {
      alive = false;
    };
  }, [user]);

  const maxMin = data ? Math.max(1, ...data.series.map((s) => s.minutes)) : 1;
  const maxAct = data ? Math.max(1, ...data.activity.map((a) => a.count)) : 1;

  return (
    <Sheet open={Boolean(user)} onClose={onClose} title={user ? `${user.name} — analitika` : "Analitika"} desktop="center" size="lg">
      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-16 text-fg-3">
          <Spinner /> Yuklanmoqda…
        </div>
      )}
      {error && <p role="alert" className="py-10 text-center text-[13px] font-semibold text-danger-text">{error}</p>}
      {data && (
        <div className="space-y-5">
          {/* Asosiy ko'rsatkichlar */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Tile icon={CalendarCheck} label="Faol kunlar" value={`${data.activeDays.total}`} sub={`30 kunda ${data.activeDays.month}`} />
            <Tile icon={Clock} label="Jami vaqt" value={formatMinutes(data.minutes.total)} sub={`haftada ${formatMinutes(data.minutes.week)}`} />
            <Tile icon={TrendingUp} label="30 kun vaqt" value={formatMinutes(data.minutes.month)} sub={`kuniga ~${formatMinutes(data.avg.minutesPerActiveDay)}`} />
            <Tile icon={Footprints} label="Tashriflar" value={`${data.visits.total}`} sub={`haftada ${data.visits.week}`} />
          </div>

          {/* 30 kunlik grafik */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-fg-4">
              <Activity size={13} /> So&apos;nggi 30 kun (daqiqa/kun)
            </h3>
            <div className="card-elevated flex h-28 items-end gap-[3px] p-3">
              {data.series.map((s) => (
                <div key={s.day} className="group relative flex h-full flex-1 items-end" title={`${s.label}: ${formatMinutes(s.minutes)}`}>
                  <div
                    className={cn("w-full rounded-[3px] transition-all", s.minutes > 0 ? "bg-accent" : "bg-fg/8")}
                    style={{ height: `${Math.max(s.minutes > 0 ? 6 : 2, Math.round((s.minutes / maxMin) * 100))}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-fg-4">
              <span>{data.series[0]?.label}</span>
              <span>{data.series[Math.floor(data.series.length / 2)]?.label}</span>
              <span>{data.series[data.series.length - 1]?.label}</span>
            </div>
          </section>

          {/* Asosiy faoliyat */}
          <section>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-fg-4">Asosiy faoliyat (jami)</h3>
            {data.activity.length === 0 ? (
              <p className="text-[13px] text-fg-3">Hali faoliyat yo&apos;q.</p>
            ) : (
              <ul className="space-y-2">
                {data.activity.map((a) => (
                  <li key={a.key} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[13px] font-medium text-fg-2">{a.label}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-fg/8">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((a.count / maxAct) * 100)}%` }} />
                    </span>
                    <span className="w-12 shrink-0 text-right text-[13px] font-bold tabular-nums text-fg">{a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Meta */}
          <section className="grid grid-cols-1 gap-1.5 border-t border-line pt-4 text-[12.5px] text-fg-3 sm:grid-cols-3">
            <Meta label="Ro'yxatdan o'tgan" value={formatDate(data.user.createdAt)} />
            <Meta label="Oxirgi faollik" value={data.user.lastSeenAt ? timeAgo(data.user.lastSeenAt) : "—"} />
            <Meta label="Oxirgi kirish" value={data.user.lastLoginAt ? timeAgo(data.user.lastLoginAt) : "—"} />
          </section>
          <p className="text-[11px] leading-relaxed text-fg-4">Vaqt taqribiy — saytda faol bo'lgan daqiqalar (5 daqiqalik oynalar) yig'indisi.</p>
        </div>
      )}
    </Sheet>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: string; sub: string }) {
  return (
    <div className="card p-3">
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-fg-3">
        <Icon size={13} /> {label}
      </span>
      <p className="mt-1 text-[16px] font-bold leading-tight text-fg">{value}</p>
      <p className="mt-0.5 text-[11px] text-fg-4">{sub}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex justify-between gap-2 sm:flex-col sm:justify-start">
      <span className="font-semibold text-fg-4">{label}</span>
      <span className="text-fg-2">{value}</span>
    </span>
  );
}
