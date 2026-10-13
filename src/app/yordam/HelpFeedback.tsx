"use client";

import { useEffect, useState } from "react";
import { Send, ThumbsDown, ThumbsUp } from "lucide-react";

type Vote = "yes" | "no";
const KEY = (slug: string) => `redince-help-feedback:${slug}`;

/** "Foydali bo'ldimi?" — faqat shu brauzerda eslab qolinadi (serverga yuborilmaydi) */
export function HelpFeedback({ slug }: { slug: string }) {
  const [vote, setVote] = useState<Vote | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY(slug));
      if (v === "yes" || v === "no") setVote(v);
    } catch {
      /* xususiy rejim — e'tiborsiz */
    }
  }, [slug]);

  const choose = (v: Vote) => {
    setVote(v);
    try {
      localStorage.setItem(KEY(slug), v);
    } catch {
      /* e'tiborsiz */
    }
  };

  return (
    <section className="card-outline flex flex-col gap-3 !rounded-[var(--r-md)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="help-fb-title">
      <div role="status" aria-live="polite" className="min-w-0">
        <p id="help-fb-title" className="text-[14px] font-semibold text-fg">
          {vote === "yes" ? "Rahmat! Fikringiz biz uchun muhim." : vote === "no" ? "Rahmat — maqolani yaxshilaymiz." : "Maqola foydali bo'ldimi?"}
        </p>
        {vote === "no" && (
          <p className="mt-0.5 text-[13px] text-fg-2">
            Savolingiz qolgan bo&apos;lsa, bizga{" "}
            <a href="https://t.me/redince" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-accent-text underline-offset-2 hover:underline">
              <Send size={12} /> Telegram
            </a>{" "}
            orqali yozing.
          </p>
        )}
      </div>
      <div className="flex gap-2" role="group" aria-label="Baholash">
        <button
          type="button"
          onClick={() => choose("yes")}
          aria-pressed={vote === "yes"}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg aria-pressed:border-transparent aria-pressed:bg-success-soft aria-pressed:text-success-text"
        >
          <ThumbsUp size={15} /> Ha
        </button>
        <button
          type="button"
          onClick={() => choose("no")}
          aria-pressed={vote === "no"}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg aria-pressed:border-transparent aria-pressed:bg-danger-soft aria-pressed:text-danger-text"
        >
          <ThumbsDown size={15} /> Yo&apos;q
        </button>
      </div>
    </section>
  );
}
