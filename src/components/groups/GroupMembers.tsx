"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Crown, Download, Search, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { relativeTime } from "@/lib/chat/time";
import type { MemberView } from "@/lib/groups/service";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Action = "approve" | "reject" | "remove" | "promote" | "demote" | "unban";
type ListResp = { ok: boolean; data?: { items: MemberView[] }; error?: string };
type Filter = "all" | "online" | "admins";

const M = {
  requests: { uz: "So'rovlar", ru: "Заявки" },
  approveAll: { uz: "Hammasini qabul qilish", ru: "Принять все" },
  approve: { uz: "Qabul qilish", ru: "Принять" },
  reject: { uz: "Rad etish", ru: "Отклонить" },
  members: { uz: "A'zolar", ru: "Участники" },
  csvHint: { uz: "Ism, taxallus, rol, sana — kontaktlarsiz", ru: "Имя, ник, роль, дата — без контактов" },
  searchPh: { uz: "Ism bo'yicha…", ru: "По имени…" },
  searchAria: { uz: "A'zolarni qidirish", ru: "Поиск участников" },
  filterAria: { uz: "A'zolar filtri", ru: "Фильтр участников" },
  all: { uz: "Hammasi", ru: "Все" },
  online: { uz: "Onlayn", ru: "В сети" },
  admins: { uz: "Adminlar", ru: "Админы" },
  adminCan: { uz: "Admin nimalarni qila oladi?", ru: "Что может админ?" },
  adminCan1: { uz: "So'rovlarni tasdiqlaydi/rad etadi, a'zoni chiqaradi (adminlarni faqat egasi chiqaradi)", ru: "Принимает/отклоняет заявки, исключает участников (админов — только владелец)" },
  adminCan2: { uz: "Chat xabarini qadaydi/o'chiradi, mavzularni boshqaradi, kanalda post yozadi", ru: "Закрепляет/удаляет сообщения, управляет темами, пишет посты в канале" },
  adminCan3: { uz: "Efir boshlaydi va boshqaradi, sozlamalarni (nom, rasm, qoidalar, muhokama) o'zgartiradi", ru: "Запускает эфиры, меняет настройки (название, фото, правила, обсуждение)" },
  adminCan4: { uz: "Admin qilish/olish va jamoani o'chirish — faqat egasida qoladi", ru: "Назначать админов и удалять сообщество может только владелец" },
  demote: { uz: "Adminlikdan olish", ru: "Снять админа" },
  promote: { uz: "Admin qilish", ru: "Сделать админом" },
  remove: { uz: "Chiqarish", ru: "Исключить" },
  removeQ: { uz: "jamoadan chiqarilsinmi?", ru: "— исключить из сообщества?" },
  removeText: { uz: "U chatni ko'ra olmaydi va qayta qo'shila olmaydi. Keyin «Chiqarilganlar» ro'yxatidan qaytarishingiz mumkin.", ru: "Он(а) не сможет читать чат и вступить снова. Позже можно вернуть из списка «Исключённые»." },
  noneFound: { uz: "Bunday a'zo topilmadi", ru: "Участник не найден" },
  noneOnline: { uz: "Hozir hech kim onlayn emas", ru: "Сейчас никого нет в сети" },
  noneAdmins: { uz: "Adminlar yo'q", ru: "Админов нет" },
  banned: { uz: "Chiqarilganlar", ru: "Исключённые" },
  hide: { uz: "Yashirish", ru: "Скрыть" },
  show: { uz: "Ko'rsatish", ru: "Показать" },
  loading: { uz: "Yuklanmoqda…", ru: "Загрузка…" },
  noBanned: { uz: "Hech kim chiqarilmagan.", ru: "Никто не исключён." },
  unban: { uz: "Qaytarish", ru: "Вернуть" },
  owner: { uz: "Egasi", ru: "Владелец" },
  admin: { uz: "Admin", ru: "Админ" },
  bannedState: { uz: "Chiqarilgan", ru: "Исключён(а)" },
  approved: { uz: "Qabul qilindi", ru: "Принято" },
  rejected: { uz: "So'rov rad etildi", ru: "Заявка отклонена" },
  removed: { uz: "A'zo chiqarildi", ru: "Участник исключён" },
  unbanned: { uz: "Qaytarildi — endi qayta qo'shila oladi", ru: "Возвращён(а) — может вступить снова" },
  approvedN: { uz: "ta so'rov qabul qilindi", ru: "заявок принято" },
  fail: { uz: "Bajarilmadi", ru: "Не выполнено" },
  noRequests: { uz: "Kutayotgan so'rov yo'q", ru: "Заявок нет" },
} as const;

/**
 * A'zolar ro'yxati + (boshqaruvchilar uchun) qo'shilish so'rovlari va chiqarilganlar.
 * Amallar: tasdiqlash/rad etish/hammasini tasdiqlash (egasi, admin), chiqarish (adminlarni faqat egasi; tasdiq so'raydi),
 * admin qilish/olish (faqat egasi), qaytarish (unban). CSV eksport — faqat egasi (kontaktlarsiz).
 * `flat` — varaq (Sheet) ichida: ichki kartalar ramkasiz (karta ichida karta bo'lmasin). `onChanged` — a'zolar/so'rovlar
 * soni o'zgarganda (chat paneli sarlavhasi va ro'yxat yangilanishi uchun).
 */
export function GroupMembers({
  slug,
  canManage,
  isOwner,
  viewerId,
  initialActive,
  initialPending,
  flat = false,
  onChanged,
}: {
  slug: string;
  canManage: boolean;
  isOwner: boolean;
  viewerId: string | null;
  initialActive: MemberView[];
  initialPending: MemberView[];
  flat?: boolean;
  onChanged?: (counts: { active: number; pending: number }) => void;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(initialPending);
  const [banned, setBanned] = useState<MemberView[] | null>(null);
  const [showBanned, setShowBanned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Nisbiy vaqt («3 kun oldin») — faqat klientda hisoblanadi (server/klient soati farqi gidratsiyani buzmasin)
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const base = `/api/groups/${encodeURIComponent(slug)}/members`;
  // Ism bo'yicha lokal filtr (katta jamoalarda ro'yxat uzun) + Onlayn / Adminlar
  const needle = q.trim().toLowerCase();
  const shown = active.filter((m) => (!needle || m.user.name.toLowerCase().includes(needle)) && (filter === "all" || (filter === "online" ? m.user.online : m.role !== "member")));
  const onlineCount = active.filter((m) => m.user.online).length;
  const adminCount = active.filter((m) => m.role !== "member").length;
  const box = flat ? "" : "card p-4 sm:p-5";

  async function refresh() {
    const [a, p, b] = await Promise.all([
      fetch(base, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>),
      canManage ? fetch(`${base}?status=pending`, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>) : Promise.resolve(null),
      canManage && showBanned ? fetch(`${base}?status=banned`, { cache: "no-store" }).then((r) => r.json() as Promise<ListResp>) : Promise.resolve(null),
    ]);
    if (a.ok && a.data) setActive(a.data.items);
    if (p?.ok && p.data) setPending(p.data.items);
    if (b?.ok && b.data) setBanned(b.data.items);
    onChanged?.({ active: a.ok && a.data ? a.data.items.length : active.length, pending: p?.ok && p.data ? p.data.items.length : pending.length });
  }

  async function act(m: MemberView, action: Action) {
    if (busyId) return;
    // Chiqarish — qaytarib bo'lmaydigan ta'sirli amal (a'zo chatdan uziladi): tasdiq so'raladi
    if (action === "remove" && !(await confirm({ title: `${m.user.name} ${M.removeQ[til]}`, text: M.removeText[til], confirmLabel: M.remove[til], danger: true }))) return;
    setBusyId(m.user.id);
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: m.user.id, action }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || M.fail[til]);
      await refresh();
      if (action === "approve") toast(M.approved[til]);
      if (action === "reject") toast(M.rejected[til], "info");
      if (action === "remove") toast(M.removed[til], "info");
      if (action === "unban") toast(M.unbanned[til], "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : M.fail[til], "error");
    } finally {
      setBusyId(null);
    }
  }

  async function approveAll() {
    if (busyId) return;
    setBusyId("*");
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_all" }) });
      const j = (await res.json()) as { ok: boolean; data?: { count: number }; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || M.fail[til]);
      await refresh();
      toast(`${j.data?.count ?? 0} ${M.approvedN[til]}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : M.fail[til], "error");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBanned() {
    const next = !showBanned;
    setShowBanned(next);
    if (next && banned === null) {
      const r = (await fetch(`${base}?status=banned`, { cache: "no-store" }).then((x) => x.json())) as ListResp;
      setBanned(r.ok && r.data ? r.data.items : []);
    }
  }

  return (
    <div className={cn("grid", flat ? "gap-5" : "gap-4")}>
      {canManage && (pending.length > 0 || flat) && (
        <section className={cn(box, pending.length > 0 && "animate-fade-in")} aria-labelledby="pending-h" data-pending-requests>
          <div className="flex items-center justify-between gap-3">
            <h3 id="pending-h" className="text-[15px] font-bold text-fg">
              {M.requests[til]} <span className="font-semibold text-fg-3">{pending.length}</span>
            </h3>
            {pending.length > 1 && (
              <TextBtn disabled={busyId !== null} onClick={() => void approveAll()}>
                {M.approveAll[til]}
              </TextBtn>
            )}
          </div>
          {pending.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-fg-3">{M.noRequests[til]}</p>
          ) : (
            <ul className="stagger mt-2 divide-y divide-line">
              {pending.map((m) => (
                <MemberRow
                  key={m.user.id}
                  m={m}
                  til={til}
                  now={now}
                  right={
                    <div className="flex shrink-0 items-center gap-1.5">
                      <IconBtn icon={Check} label={`${m.user.name} — ${M.approve[til]}`} tone="ok" disabled={busyId !== null} onClick={() => void act(m, "approve")} />
                      <IconBtn icon={X} label={`${m.user.name} — ${M.reject[til]}`} tone="danger" disabled={busyId !== null} onClick={() => void act(m, "reject")} />
                    </div>
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={box} aria-labelledby="members-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="members-h" className="text-[15px] font-bold text-fg">
            {M.members[til]} <span className="font-semibold text-fg-3">{active.length}</span>
          </h3>
          {isOwner && (
            <a href={`${base}?format=csv`} download className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg" title={M.csvHint[til]}>
              <Download size={13} /> CSV
            </a>
          )}
        </div>
        {active.length >= 5 && (
          <div className="expand-in mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            {active.length >= 8 && (
              <label className="relative block min-w-0 flex-1">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder={M.searchPh[til]} aria-label={M.searchAria[til]} data-autofocus-skip className="field h-10 w-full !rounded-full pl-10 text-[13.5px] max-md:text-[16px]" />
              </label>
            )}
            <div className="segment flex" role="group" aria-label={M.filterAria[til]}>
              {(
                [
                  { key: "all", label: M.all[til], n: active.length },
                  { key: "online", label: M.online[til], n: onlineCount },
                  { key: "admins", label: M.admins[til], n: adminCount },
                ] as const
              ).map((o) => (
                <button key={o.key} type="button" aria-pressed={filter === o.key} data-active={filter === o.key} onClick={() => setFilter(o.key)} className="segment-item flex-1 whitespace-nowrap">
                  {o.label} <span className="ml-1 text-fg-3">{o.n}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {canManage && (
          /* Kamchilik #13: admin nima qila olishini tushuntirish — yig'ilgan karta */
          <details className="mt-3 rounded-[12px] border border-line px-3.5 py-2.5 text-[13px] text-fg-2">
            <summary className="cursor-pointer select-none font-semibold text-fg">{M.adminCan[til]}</summary>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-[12.5px] leading-relaxed text-fg-3">
              <li>{M.adminCan1[til]}</li>
              <li>{M.adminCan2[til]}</li>
              <li>{M.adminCan3[til]}</li>
              <li>{M.adminCan4[til]}</li>
            </ul>
          </details>
        )}
        <ul className="stagger mt-2 divide-y divide-line" key={filter + needle}>
          {shown.map((m) => {
            const self = m.user.id === viewerId;
            const manageable = canManage && !self && m.role !== "owner" && (m.role !== "admin" || isOwner);
            return (
              <MemberRow
                key={m.user.id}
                m={m}
                til={til}
                now={now}
                right={
                  manageable ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {isOwner &&
                        (m.role === "admin" ? (
                          <TextBtn disabled={busyId !== null} onClick={() => void act(m, "demote")}>
                            {M.demote[til]}
                          </TextBtn>
                        ) : (
                          <TextBtn disabled={busyId !== null} onClick={() => void act(m, "promote")}>
                            {M.promote[til]}
                          </TextBtn>
                        ))}
                      <TextBtn tone="danger" disabled={busyId !== null} onClick={() => void act(m, "remove")}>
                        {M.remove[til]}
                      </TextBtn>
                    </div>
                  ) : null
                }
              />
            );
          })}
        </ul>
        {shown.length === 0 && <p className="py-6 text-center text-[13px] text-fg-3">{needle ? M.noneFound[til] : filter === "online" ? M.noneOnline[til] : M.noneAdmins[til]}</p>}
      </section>

      {canManage && (
        <section className={box} aria-labelledby="banned-h">
          <button type="button" onClick={() => void toggleBanned()} aria-expanded={showBanned} className="flex min-h-10 w-full items-center justify-between text-left">
            <h3 id="banned-h" className="text-[15px] font-bold text-fg">
              {M.banned[til]} {banned && <span className="font-semibold text-fg-3">{banned.length}</span>}
            </h3>
            <span className="text-[12.5px] font-semibold text-fg-3">{showBanned ? M.hide[til] : M.show[til]}</span>
          </button>
          {showBanned && (
            <div className="expand-in">
              {banned === null ? (
                <p className="py-4 text-[13px] text-fg-3">{M.loading[til]}</p>
              ) : banned.length === 0 ? (
                <p className="py-4 text-[13px] text-fg-3">{M.noBanned[til]}</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {banned.map((m) => (
                    <MemberRow
                      key={m.user.id}
                      m={m}
                      til={til}
                      now={now}
                      right={
                        <TextBtn disabled={busyId !== null} onClick={() => void act(m, "unban")}>
                          {M.unban[til]}
                        </TextBtn>
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MemberRow({ m, right, til, now }: { m: MemberView; right?: ReactNode; til: Locale; now: number }) {
  const name = (
    <span className="block truncate text-[14px] font-semibold text-fg" data-no-auto>
      {m.user.name}
    </span>
  );
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="relative shrink-0">
        <Avatar name={m.user.name} src={m.user.avatarUrl} size={38} decorative />
        {m.user.online && <span role="img" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" title={M.online[til]} aria-label={M.online[til]} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {m.user.slug ? (
            <Link href={`/mutaxassislar/${m.user.slug}`} className="min-w-0 underline-offset-2 hover:underline">
              {name}
            </Link>
          ) : (
            <span className="min-w-0">{name}</span>
          )}
          {m.role === "owner" && <RoleChip icon={Crown}>{M.owner[til]}</RoleChip>}
          {m.role === "admin" && <RoleChip icon={ShieldCheck}>{M.admin[til]}</RoleChip>}
        </div>
        <p className="truncate text-[12px] text-fg-3">
          {m.status === "banned" ? M.bannedState[til] : now ? relativeTime(m.joinedAt, til, now) : ""}
          {m.note && (
            <span className="text-fg-2" data-no-auto>
              {" "}
              · «{m.note}»
            </span>
          )}
        </p>
      </div>
      {right}
    </li>
  );
}

function RoleChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-bold text-fg-2">
      <Icon size={11} /> {children}
    </span>
  );
}

function IconBtn({ icon: Icon, label, tone, disabled, onClick }: { icon: LucideIcon; label: string; tone: "ok" | "danger"; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press flex h-10 w-10 items-center justify-center rounded-full border transition disabled:opacity-50",
        tone === "ok" ? "border-success/40 text-success-text hover:bg-success-soft" : "border-line-2 text-fg-3 hover:border-danger/40 hover:text-danger-text",
      )}
    >
      <Icon size={17} />
    </button>
  );
}

function TextBtn({ tone = "default", disabled, onClick, children }: { tone?: "default" | "danger"; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press inline-flex h-9 items-center rounded-full border border-line-2 px-3 text-[12.5px] font-semibold transition disabled:opacity-50 max-sm:h-10",
        tone === "danger" ? "text-danger-text hover:border-danger/40" : "text-fg-2 hover:border-fg hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
