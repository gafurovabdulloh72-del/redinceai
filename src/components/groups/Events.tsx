import { ExternalLink, RadioTower } from "lucide-react";
import { CalendarLinks } from "@/components/groups/CalendarLinks";
import type { PostView } from "@/lib/groups/service";
import { cn, formatDateTime } from "@/lib/utils";

/** Yaqinlashayotgan jonli efir / yig'ilishlar — lenta tepasida (3 tagacha) */
export function EventsCard({ events }: { events: PostView[] }) {
  return (
    <section className="card mb-4 p-4 sm:p-5" aria-labelledby="events-h">
      <h2 id="events-h" className="flex items-center gap-2 text-[15px] font-bold text-fg">
        <RadioTower size={16} className="text-fg-3" /> Yaqin efirlar
      </h2>
      <ul className="mt-3 grid gap-2">
        {events.map((e) => (
          <EventRow key={e.id} e={e} />
        ))}
      </ul>
    </section>
  );
}

export function EventRow({ e, past = false }: { e: PostView; past?: boolean }) {
  const at = e.eventAt ?? 0;
  const live = !past && Date.now() >= at && Date.now() < at + 2 * 60 * 60 * 1000;
  const title = e.body.split("\n")[0] || "Jonli efir";
  return (
    <li className={cn("flex flex-wrap items-center gap-3 rounded-[14px] px-3.5 py-2.5", live ? "bg-accent-soft/60" : "bg-surface-2")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", live ? "bg-accent text-white" : "bg-fg/6 text-fg-2")}>
        <RadioTower size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-fg">{title}</p>
        <p className="text-[12px] text-fg-3">
          {live ? "Hozir jonli efirda · " : ""}
          {formatDateTime(at)}
        </p>
      </div>
      {past ? (
        e.eventUrl ? (
          <a href={e.eventUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 hover:text-fg">
            Yozuv <ExternalLink size={13} />
          </a>
        ) : null
      ) : (
        <>
          {e.eventUrl ? (
            <a href={e.eventUrl} target="_blank" rel="noopener noreferrer" className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold", live ? "btn-accent" : "border border-line-2 text-fg-2 hover:text-fg")}>
              {live ? "Qo'shilish" : "Havola"} <ExternalLink size={13} />
            </a>
          ) : (
            <span className="text-[12px] text-fg-4">Havola efir oldidan</span>
          )}
          <CalendarLinks title={title} at={at} url={e.eventUrl} compact />
        </>
      )}
    </li>
  );
}

/** «Efirlar» bo'limi: yaqinlashayotganlar va o'tganlar */
export function EventsList({ ev }: { ev: { upcoming: PostView[]; past: PostView[] } }) {
  if (!ev.upcoming.length && !ev.past.length) {
    return (
      <div className="card flex flex-col items-center gap-2 px-5 py-12 text-center" data-reveal="scale">
        <p className="text-[15px] font-semibold text-fg">Efirlar hali e&apos;lon qilinmagan</p>
        <p className="text-[13px] text-fg-3">Egasi lentada efir vaqti va havolasini e&apos;lon qiladi.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {ev.upcoming.length > 0 && (
        <section className="card p-4 sm:p-5" aria-labelledby="up-h">
          <h2 id="up-h" className="text-[15px] font-bold text-fg">
            Yaqin efirlar <span className="font-semibold text-fg-3">{ev.upcoming.length}</span>
          </h2>
          <ul className="stagger mt-3 grid gap-2">
            {ev.upcoming.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        </section>
      )}
      {ev.past.length > 0 && (
        <section className="card p-4 sm:p-5" aria-labelledby="past-h">
          <h2 id="past-h" className="text-[15px] font-bold text-fg">
            O&apos;tgan efirlar <span className="font-semibold text-fg-3">{ev.past.length}</span>
          </h2>
          <ul className="mt-3 grid gap-2">
            {ev.past.map((e) => (
              <EventRow key={e.id} e={e} past />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
