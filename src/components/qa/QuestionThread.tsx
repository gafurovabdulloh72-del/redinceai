"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, ThumbsUp, Trash2 } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import type { AnswerView, QuestionDetail } from "@/lib/qa/service";
import { timeAgo } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SAVOL } from "@/lib/i18n/dict/community";

/**
 * Savol sahifasining jonli qismi: javoblar ro'yxati («Eng foydali» yuqorida),
 * «Foydali» (upvote, optimistik toggle), savol egasi uchun «Eng foydali» belgisi,
 * javob yozish formasi (bir savolga 1 ta), o'chirish (egasi/admin).
 */
export function QuestionThread({ initial, viewer }: { initial: QuestionDetail; viewer: { id: string; isAdmin: boolean } | null }) {
  const router = useRouter();
  const til = useLocale();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [q, setQ] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/savollar/${initial.id}`, { cache: "no-store" });
    if (r.ok) setQ((await r.json()).data);
  }, [initial.id]);

  async function vote(a: AnswerView) {
    if (!viewer) {
      router.push(`/auth/kirish?next=/savollar/${q.id}`);
      return;
    }
    // Optimistik
    setQ((prev) => ({
      ...prev,
      answers: prev.answers.map((x) => (x.id === a.id ? { ...x, votedByMe: !x.votedByMe, upvotesCount: x.upvotesCount + (x.votedByMe ? -1 : 1) } : x)),
    }));
    const r = await fetch(`/api/javoblar/${a.id}/ovoz`, { method: "POST" });
    if (!r.ok) {
      toast((await r.json().catch(() => ({})))?.error ?? tr(til, SAVOL.actionFail), "error");
      await refresh();
    }
  }

  async function accept(a: AnswerView) {
    const r = await fetch(`/api/savollar/${q.id}/qabul`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answerId: a.id }),
    });
    if (r.ok) {
      toast(a.isAccepted ? tr(til, SAVOL.acceptOff) : tr(til, SAVOL.acceptOn), "success");
      await refresh();
    } else toast((await r.json().catch(() => ({})))?.error ?? tr(til, SAVOL.actionFail), "error");
  }

  async function removeAnswer(a: AnswerView) {
    if (!(await confirm({ title: tr(til, SAVOL.deleteConfirm), danger: true }))) return;
    const r = await fetch(`/api/javoblar/${a.id}`, { method: "DELETE" });
    if (r.ok) {
      toast(tr(til, SAVOL.deleted), "success");
      await refresh();
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!viewer) {
      router.push(`/auth/kirish?next=/savollar/${q.id}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/savollar/${q.id}/javob`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      if (!r.ok) {
        setErr((await r.json().catch(() => ({})))?.error ?? tr(til, SAVOL.sendFail));
        return;
      }
      setDraft("");
      toast(tr(til, SAVOL.sent), "success");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const canAnswer = viewer && !q.mine && !q.myAnswerId;

  return (
    <div className="grid gap-4">
      <h2 className="text-[15px] font-bold text-fg">
        {q.answersCount > 0 ? SAVOL.answersCount[til](q.answersCount) : tr(til, SAVOL.noAnswers)}
      </h2>
      {q.answers.length > 0 && (
        <ul className="grid gap-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
          {q.answers.map((a) => (
            <li key={a.id} className={`m-plain card p-4 ${a.isAccepted ? "ring-1 ring-success-text/40" : ""}`}>
              <div className="flex items-center gap-2.5">
                <Avatar name={a.author.name} src={a.author.avatarUrl} size={34} decorative />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-fg">
                    {a.author.slug ? (
                      <a href={`/mutaxassislar/${a.author.slug}`} className="hover:underline">
                        {a.author.name}
                      </a>
                    ) : (
                      a.author.name
                    )}
                  </p>
                  <p className="truncate text-[12px] text-fg-3">
                    {a.author.title ?? tr(til, SAVOL.userFallback)} · {timeAgo(a.createdAt)}
                  </p>
                </div>
                {a.isAccepted && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success-text">
                    <Award size={12} /> {tr(til, SAVOL.best)}
                  </span>
                )}
              </div>
              <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{a.body}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => vote(a)}
                  disabled={a.mine}
                  aria-pressed={a.votedByMe}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition disabled:opacity-40 ${
                    a.votedByMe ? "border-fg bg-fg text-bg" : "border-line text-fg-2 hover:border-fg/40"
                  }`}
                >
                  <ThumbsUp size={13} /> {tr(til, SAVOL.helpful)}{a.upvotesCount > 0 ? ` · ${a.upvotesCount}` : ""}
                </button>
                {q.mine && (
                  <button
                    type="button"
                    onClick={() => accept(a)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition ${
                      a.isAccepted ? "border-success-text/50 text-success-text" : "border-line text-fg-2 hover:border-fg/40"
                    }`}
                  >
                    <Award size={13} /> {a.isAccepted ? tr(til, SAVOL.unmark) : tr(til, SAVOL.best)}
                  </button>
                )}
                {(a.mine || viewer?.isAdmin) && (
                  <button type="button" onClick={() => removeAnswer(a)} className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition hover:text-fg" aria-label={tr(til, SAVOL.deleteAria)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canAnswer && (
        <form onSubmit={submitAnswer} className="card grid gap-3 p-4 max-sm:!border-0 max-sm:!bg-transparent max-sm:!p-0 max-sm:!shadow-none">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-fg-2">{tr(til, SAVOL.yourAnswer)}</span>
            <textarea
              className="field min-h-28 resize-y"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={tr(til, SAVOL.answerPh)}
              maxLength={4000}
              required
              minLength={10}
            />
          </label>
          {err && <p className="text-[13px] font-semibold text-danger">{err}</p>}
          <div>
            <Button type="submit" disabled={busy || draft.trim().length < 10}>
              {busy ? tr(til, SAVOL.sending) : tr(til, SAVOL.sendAnswer)}
            </Button>
          </div>
        </form>
      )}
      {viewer && q.myAnswerId && <p className="text-[13px] text-fg-3">{tr(til, SAVOL.alreadyAnswered)}</p>}
      {!viewer && (
        <p className="text-[13.5px] text-fg-2">
          {tr(til, SAVOL.loginToAnswer)}{" "}
          <a href={`/auth/kirish?next=/savollar/${q.id}`} className="font-bold text-fg underline">
            {tr(til, SAVOL.loginLink)}
          </a>
          .
        </p>
      )}
    </div>
  );
}
