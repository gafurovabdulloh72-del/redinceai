"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import { AlertCircle, Check, Paperclip, Pencil, Plus, Send, X, Zap } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { DM_BODY_MAX } from "@/lib/chat/constants";
import type { QuoteView } from "@/lib/chat/quote";
import type { Locale } from "@/lib/i18n";
import { chatT, type ChatKey } from "@/lib/i18n/dict/chat";
import { cn } from "@/lib/utils";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, uploadAttachment, type Attachment } from "./attachments";
import { CTRL_ENTER_KEY, readDraft, readQuickReplies, store, writeDraft } from "./chat-store";
import type { Msg } from "./chat-types";
import { Layer, MenuDivider, MenuItem } from "./DmPanels";
import { ReplyBar, iconBtn } from "./MessageParts";
import { VideoNoteRecorder, videoNoteSupported } from "./VideoNoteRecorder";
import { VoiceRecorder } from "./VoiceRecorder";

/** Mutaxassis uchun tayyor javoblar (foydalanuvchi qo'shganlari — `readQuickReplies`) */
const DEFAULT_QUICK: Record<Locale, string[]> = {
  uz: ["Assalomu alaykum! Xabaringizni oldim, tez orada javob beraman.", "Narx va muddatni aniqlashtirsak: qachongacha kerak va qanday formatda?", "Ish jarayonda — oraliq natijani tez orada yuboraman.", "Rahmat! Hamkorlikdan xursandman."],
  ru: ["Здравствуйте! Получил(а) ваше сообщение, скоро отвечу.", "Уточним цену и сроки: к какому числу нужно и в каком формате?", "Работа в процессе — скоро пришлю промежуточный результат.", "Спасибо! Рад(а) сотрудничеству."],
};

export interface ComposerHandle {
  focus: () => void;
  /** Suhbat oynasiga tashlangan (drag&drop) fayllar */
  addFiles: (list: File[]) => void;
}

/**
 * Shaxsiy suhbatning yozish maydoni. Matn holati shu komponentda — har harf kiritilganda xabarlar ro'yxati qayta
 * chizilmaydi. Qoralama suhbat bo'yicha saqlanadi (300 ms kechikish; suhbatdan chiqilganda darhol).
 *
 *  - uzun matn jimgina KESILMAYDI (QA B9): chegaraga yaqinlashganda sanagich, oshsa — xato va yuborish o'chiq;
 *  - tahrir: matnli xabar yoki biriktirmali xabar izohi (QA C6); Esc — bekor;
 *  - Enter: desktopda yuboradi (Shift+Enter — yangi qator); sensorli klaviaturada yoki «Ctrl+Enter» rejimida — yangi qator;
 *  - doira video tugmasi faqat brauzerda aniqlangach chiziladi (server/klient farqi gidratsiya xatosini berardi — QA A14).
 */
export function DmComposer({
  ref,
  convId,
  locale,
  viewerRole,
  replyTo,
  replyQuote,
  editing,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onDraft,
}: {
  ref?: Ref<ComposerHandle>;
  convId: string;
  locale: Locale;
  viewerRole?: string | null;
  replyTo: Msg | null;
  /** Javob paneli uchun iqtibos (replyTo'dan hisoblangan) */
  replyQuote: QuoteView | null;
  editing: Msg | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  /** Yangi xabar (optimistik yuborishni suhbat o'zi bajaradi) */
  onSend: (body: string, attachments: Attachment[], replyToId: string | null) => void;
  /** Tahrirni saqlash — xato bo'lsa tashlaydi (matni foydalanuvchiga ko'rsatiladi) */
  onSaveEdit: (m: Msg, body: string) => Promise<void>;
  /** Qoralama o'zgardi (chat ro'yxatidagi «Qoralama» belgisi uchun) */
  onDraft?: (text: string) => void;
}) {
  const t = useCallback((k: ChatKey, v?: Record<string, string | number>) => chatT(locale, k, v), [locale]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploads, setUploads] = useState<Array<{ key: string; name: string; progress: number; ctl: AbortController }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plusMenu, setPlusMenu] = useState<HTMLElement | null>(null);
  const [ctrlEnter, setCtrlEnter] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [quick, setQuick] = useState<string[]>([]);
  const [canVideoNote, setCanVideoNote] = useState(false);
  const [flying, setFlying] = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ text: "", editing: false, files: 0, uploads: 0 });
  latest.current = { text, editing: Boolean(editing), files: files.length, uploads: uploads.length };
  /** Foydalanuvchi matnni haqiqatan o'zgartirganmi (qoralama faqat shunda yoziladi) */
  const dirty = useRef(false);
  /** Tahrir boshlanganda yozib turilgan matn (tahrir tugagach qaytariladi) */
  const stash = useRef("");
  const prevEditing = useRef<string | null>(null);
  const typingSentAt = useRef(0);
  const typingOn = useRef(false);
  const draftCb = useRef(onDraft);
  draftCb.current = onDraft;

  /* ---------------- Boshlang'ich holat (faqat brauzerda) ---------------- */
  useEffect(() => {
    setText(readDraft(convId));
    setCtrlEnter(store.get(CTRL_ENTER_KEY) === "1");
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    setQuick(readQuickReplies());
    setCanVideoNote(videoNoteSupported());
  }, [convId]);

  // Qoralama: matn o'zgargach 300 ms da saqlanadi; komponent yo'qolganda (suhbat almashdi) — darhol
  useEffect(() => {
    if (editing || !dirty.current) return;
    const id = window.setTimeout(() => {
      writeDraft(convId, text);
      draftCb.current?.(text);
    }, 300);
    return () => window.clearTimeout(id);
  }, [text, editing, convId]);
  useEffect(
    () => () => {
      if (!dirty.current) return;
      const cur = latest.current.editing ? stash.current : latest.current.text;
      writeDraft(convId, cur);
      draftCb.current?.(cur);
    },
    [convId],
  );

  const focusSoon = useCallback(() => {
    window.setTimeout(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }, 40);
  }, []);

  // Tahrir boshlandi / tugadi: matn almashadi, avvalgi qoralama qaytadi
  useEffect(() => {
    const id = editing?.id ?? null;
    if (id === prevEditing.current) return;
    if (id && editing) {
      if (!prevEditing.current) stash.current = latest.current.text;
      setText(editing.body);
      setError(null);
      focusSoon();
    } else {
      setText(stash.current);
      stash.current = "";
    }
    prevEditing.current = id;
  }, [editing, focusSoon]);

  // Javob tanlanganda fokus yozish maydoniga
  useEffect(() => {
    if (replyTo) focusSoon();
  }, [replyTo, focusSoon]);

  // Yozish maydoni matnga qarab o'sadi (140px gacha)
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text, recording]);

  const failText = useCallback((e: unknown, fallback: string) => (e instanceof TypeError ? t("netError") : e instanceof Error && e.message ? e.message : fallback), [t]);

  /* ---------------- Fayllar ---------------- */
  const addFiles = useCallback(
    async (list: File[]) => {
      if (!list.length || latest.current.editing) return;
      setError(null);
      let room = MAX_ATTACHMENTS - latest.current.files - latest.current.uploads;
      for (const f of list) {
        if (room <= 0) {
          setError(t("maxFiles", { n: MAX_ATTACHMENTS }));
          break;
        }
        room--;
        const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const ctl = new AbortController();
        setUploads((u) => [...u, { key, name: f.name, progress: 0, ctl }]);
        try {
          const a = await uploadAttachment(f, { docs: true, signal: ctl.signal, onProgress: (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))) });
          setFiles((cur) => (cur.length < MAX_ATTACHMENTS && !cur.some((x) => x.url === a.url) ? [...cur, a] : cur));
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") room++;
          else setError(failText(e, t("uploadFail")));
        } finally {
          setUploads((u) => u.filter((x) => x.key !== key));
        }
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    [t, failText],
  );

  useImperativeHandle(ref, () => ({ focus: focusSoon, addFiles: (list) => void addFiles(list) }), [focusSoon, addFiles]);

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []).filter((i) => i.kind === "file" && i.type.startsWith("image/"));
    if (!items.length) return;
    e.preventDefault();
    void addFiles(items.map((i) => i.getAsFile()).filter((f): f is File => Boolean(f)));
  };

  /* ---------------- "Yozmoqda…" ---------------- */
  const pingTyping = (v: string) => {
    if (editing) return;
    const on = v.trim().length > 0;
    if (!on) {
      if (!typingOn.current) return;
      typingOn.current = false;
      typingSentAt.current = 0;
      void fetch(`/api/chat/${convId}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: false }) }).catch(() => undefined);
      return;
    }
    const n = Date.now();
    if (n - typingSentAt.current < 2500) return;
    typingSentAt.current = n;
    typingOn.current = true;
    void fetch(`/api/chat/${convId}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: true }) }).catch(() => undefined);
  };

  /* ---------------- Yuborish ---------------- */
  const len = text.trim().length;
  const over = len - DM_BODY_MAX;
  const nearLimit = len > DM_BODY_MAX - 200;
  const hasContent = editing ? len > 0 || editing.attachments.length > 0 : len > 0 || files.length > 0;
  const canSend = hasContent && over <= 0 && uploads.length === 0 && !busy;

  const send = async () => {
    if (!canSend) return;
    const body = text.trim();
    if (editing) {
      setBusy(true);
      setError(null);
      try {
        await onSaveEdit(editing, body);
      } catch (e) {
        setError(failText(e, t("editFail")));
      } finally {
        setBusy(false);
      }
      return;
    }
    onSend(body, files, replyTo?.id ?? null);
    setText("");
    setFiles([]);
    setError(null);
    dirty.current = false;
    typingOn.current = false;
    typingSentAt.current = 0;
    writeDraft(convId, "");
    draftCb.current?.("");
    setFlying(true);
    window.setTimeout(() => setFlying(false), 420);
  };

  const sendVoice = (a: Attachment) => {
    setError(null);
    onSend("", [a], replyTo?.id ?? null);
  };

  const cancelEdit = () => {
    setError(null);
    onCancelEdit();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (editing) (e.stopPropagation(), cancelEdit());
      else if (replyTo) (e.stopPropagation(), onCancelReply());
      return;
    }
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    // Sensorli ekran yoki Ctrl+Enter rejimi: Enter — yangi qator; aks holda Enter yuboradi (Shift+Enter — yangi qator)
    if (ctrlEnter || coarse) {
      if (mod) (e.preventDefault(), void send());
      return;
    }
    if (!e.shiftKey) (e.preventDefault(), void send());
  };

  // Javob / tahrir paneli: yopilish animatsiyasi paytida oxirgi ko'rsatilgan panel chiziladi
  const bar = editing ? ({ kind: "edit", m: editing } as const) : replyQuote ? ({ kind: "reply", q: replyQuote } as const) : null;
  const lastBar = useRef(bar);
  if (bar) lastBar.current = bar;
  const barPresence = usePresence(bar !== null, 160);
  const shownBar = bar ?? (barPresence.closing ? lastBar.current : null);
  const quickAll = [...DEFAULT_QUICK[locale], ...quick];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="shrink-0 border-t border-line bg-bg p-2 sm:p-2.5"
    >
      {barPresence.mounted &&
        shownBar &&
        (shownBar.kind === "edit" ? (
          <div className={cn(barPresence.closing ? "expand-out" : "expand-in", "mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-accent bg-accent-soft/60 py-1.5 pl-3 pr-1")} role="status">
            <Pencil size={14} className="shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold text-accent-text">{t(shownBar.m.attachments.length ? "editCaption" : "edit")}</span>
              <span className="block truncate text-[12.5px] text-fg-2" data-no-auto>
                {shownBar.m.body || t(shownBar.m.attachments.some((a) => a.type.startsWith("video/")) ? "video" : shownBar.m.attachments.some((a) => a.type.startsWith("image/")) ? "image" : "file")}
              </span>
            </span>
            <button type="button" onClick={cancelEdit} aria-label={t("cancel")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg">
              <X size={14} />
            </button>
          </div>
        ) : (
          <ReplyBar q={shownBar.q} onCancel={onCancelReply} closing={barPresence.closing} locale={locale} />
        ))}
      {!editing && (files.length > 0 || uploads.length > 0) && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={f.url} className="expand-in flex max-w-full items-center gap-1.5 rounded-full bg-fg/6 py-0.5 pl-2.5 pr-0.5 text-[12px] font-medium text-fg-2">
              <Paperclip size={12} className="shrink-0" aria-hidden="true" />
              <span className="max-w-[150px] truncate" data-no-auto>
                {f.name}
              </span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`${f.name} — ${t("removeFile")}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/10 hover:text-fg">
                <X size={12} />
              </button>
            </li>
          ))}
          {uploads.map((u) => (
            <li key={u.key} className="expand-in relative flex max-w-full items-center gap-1.5 overflow-hidden rounded-full bg-fg/6 py-0.5 pl-2.5 pr-0.5 text-[12px] font-medium text-fg-2" aria-live="polite">
              <span className="absolute inset-y-0 left-0 bg-fg/10 transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} aria-hidden="true" />
              <span className="relative max-w-[120px] truncate" data-no-auto>
                {u.name}
              </span>
              <span className="relative tabular-nums text-fg-4">{Math.round(u.progress * 100)}%</span>
              <button type="button" onClick={() => u.ctl.abort()} aria-label={`${u.name} — ${t("cancel")}`} className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/10 hover:text-fg">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT_DOCS} multiple className="sr-only" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} tabIndex={-1} aria-hidden="true" />
        {!recording && !editing && (
          <button type="button" onClick={(e) => setPlusMenu(plusMenu ? null : e.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(plusMenu)} aria-label={t("more")} className={cn(iconBtn, "text-fg-2", plusMenu && "bg-fg/6 text-fg")}>
            <Plus size={19} className={cn("transition-transform duration-200", plusMenu && "rotate-45")} />
          </button>
        )}
        {!recording && (
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => {
              dirty.current = true;
              setText(e.target.value);
              pingTyping(e.target.value);
            }}
            onKeyDown={onKey}
            onPaste={onPaste}
            rows={1}
            placeholder={t(editing ? (editing.attachments.length ? "captionPh" : "editPh") : replyTo ? "replyPh" : "write")}
            aria-label={t(editing ? "editField" : "msgField")}
            aria-invalid={over > 0 || undefined}
            className="field max-h-[140px] min-h-10 min-w-0 flex-1 resize-none !rounded-[20px] !py-2.5 text-[14px] leading-snug max-md:text-[16px]"
            style={{ height: 40 }}
          />
        )}
        {!recording && nearLimit && (
          <span className={cn("self-center text-[11px] tabular-nums", over > 0 ? "font-semibold text-danger-text" : "text-fg-4")} aria-label={over > 0 ? undefined : t("charsLeft", { n: DM_BODY_MAX - len })}>
            {DM_BODY_MAX - len}
          </span>
        )}
        {len > 0 || files.length > 0 || editing ? (
          <button type="submit" disabled={!canSend} aria-label={t(editing ? "save" : "send")} className="btn-accent press flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full disabled:opacity-40">
            {editing ? <Check size={17} /> : <Send size={17} className={cn("transition-[translate,opacity] duration-300 ease-out", flying && "-translate-y-6 translate-x-6 opacity-0")} />}
          </button>
        ) : (
          <>
            {canVideoNote && <VideoNoteRecorder onRecorded={sendVoice} onError={setError} onPhase={setRecording} />}
            <VoiceRecorder size="md" onRecorded={sendVoice} onError={setError} onPhase={setRecording} />
          </>
        )}
      </div>
      {(error || over > 0) && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-danger-text" role="alert">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" /> <span className="min-w-0 [overflow-wrap:anywhere]">{over > 0 ? t("tooLong", { n: DM_BODY_MAX, over }) : error}</span>
        </p>
      )}

      <Layer open={Boolean(plusMenu)} onClose={() => setPlusMenu(null)} label={t("more")} anchor={plusMenu} align="start" side="top" width="w-[270px]">
        <MenuItem icon={Paperclip} label={t("attach")} hint={t("attachHint")} disabled={files.length + uploads.length >= MAX_ATTACHMENTS} onClick={() => (setPlusMenu(null), fileRef.current?.click())} />
        {viewerRole === "specialist" && (
          <>
            <MenuDivider />
            <p className="px-3 pb-1 pt-1.5 text-[11.5px] font-semibold text-fg-4">{t("quick")}</p>
            <div className="max-h-48 overflow-y-auto">
              {quickAll.map((s) => (
                <MenuItem
                  key={s}
                  icon={Zap}
                  label={s}
                  onClick={() => {
                    setPlusMenu(null);
                    dirty.current = true;
                    setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${s}` : s));
                    focusSoon();
                  }}
                />
              ))}
            </div>
          </>
        )}
        {/* Sensorli klaviaturada Enter doim yangi qator — sozlama faqat klaviaturali qurilmada ma'noli */}
        {!coarse && (
          <>
            <MenuDivider />
            <MenuItem
              label={t("ctrlEnter")}
              hint={ctrlEnter ? "✓" : ""}
              active={ctrlEnter}
              onClick={() => {
                setCtrlEnter((v) => {
                  store.set(CTRL_ENTER_KEY, v ? null : "1");
                  return !v;
                });
              }}
            />
          </>
        )}
      </Layer>
    </form>
  );
}
