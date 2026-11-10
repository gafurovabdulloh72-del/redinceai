"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";
import type { ArticleCard } from "@/lib/blog";
import { cn, formatDate } from "@/lib/utils";

/**
 * Admin blog muharriri (kamchilik #48): ro'yxat + yaratish/tahrirlash formasi.
 * Matn — markdown-lite (## sarlavha, - ro'yxat, **qalin**, [matn](url)); muqova — URL yoki yuklash.
 */

type Api<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

interface Draft {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  isPublished: boolean;
}

const EMPTY: Draft = { id: null, slug: "", title: "", excerpt: "", body: "", coverUrl: "", isPublished: false };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’ʻ`]/g, "")
    .replace(/o‘|oʻ/g, "o")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function AdminBlog({ initial }: { initial: ArticleCard[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = async () => {
    const r = (await (await fetch("/api/admin/blog")).json()) as Api<{ items: ArticleCard[] }>;
    if (r.ok) setItems(r.data.items);
  };

  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(draft.id ? `/api/admin/blog/${draft.id}` : "/api/admin/blog", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: draft.slug, title: draft.title, excerpt: draft.excerpt, body: draft.body, coverUrl: draft.coverUrl, isPublished: draft.isPublished }),
      });
      const j = (await res.json()) as Api<unknown>;
      if (!j.ok) {
        setErrors(j.fields ?? {});
        toast(j.error, "error");
        return;
      }
      toast(draft.id ? "Saqlandi" : "Maqola yaratildi", "success");
      setDraft(null);
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: ArticleCard) {
    if (!(await confirm({ title: `«${a.title}» o'chirilsinmi?`, danger: true }))) return;
    const res = await fetch(`/api/admin/blog/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("O'chirildi", "success");
      setItems((l) => l.filter((x) => x.id !== a.id));
    } else toast("O'chirilmadi", "error");
  }

  /** Tahrirlash: to'liq matn (body) API'dan id bo'yicha olinadi */
  async function edit(a: ArticleCard) {
    const res = (await (await fetch(`/api/admin/blog?id=${encodeURIComponent(a.id)}`)).json()) as Api<{ item: (ArticleCard & { body: string }) | null }>;
    const full = res.ok ? res.data.item : null;
    if (!full) {
      toast("Maqola topilmadi", "error");
      return;
    }
    setDraft({ id: a.id, slug: full.slug, title: full.title, excerpt: full.excerpt, body: full.body, coverUrl: full.coverUrl ?? "", isPublished: full.isPublished });
  }

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = (await res.json()) as Api<{ url: string }>;
      if (j.ok) setDraft((d) => (d ? { ...d, coverUrl: j.data.url } : d));
      else toast(j.error, "error");
    } finally {
      setUploading(false);
    }
  }

  if (draft) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-bold text-fg">{draft.id ? "Maqolani tahrirlash" : "Yangi maqola"}</p>
          <button type="button" onClick={() => setDraft(null)} aria-label="Yopish" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
            <X size={15} />
          </button>
        </div>
        <label className="grid gap-1 text-[12.5px] font-semibold text-fg-3">
          Sarlavha
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: draft.id ? draft.slug : slugify(e.target.value) })} maxLength={160} className="field h-10 text-[14px] font-normal text-fg" />
          {errors.title && <span className="font-normal text-danger">{errors.title}</span>}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[12.5px] font-semibold text-fg-3">
            Manzil (slug)
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} maxLength={80} className="field h-10 font-mono text-[13px] font-normal text-fg" />
            {errors.slug && <span className="font-normal text-danger">{errors.slug}</span>}
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold text-fg-3">
            Muqova (URL yoki yuklash)
            <span className="flex gap-2">
              <input value={draft.coverUrl} onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })} maxLength={500} placeholder="/uploads/… yoki https://…" className="field h-10 min-w-0 flex-1 text-[13px] font-normal text-fg" />
              <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-[12px] border border-line px-3 text-[12.5px] text-fg-2 hover:border-fg hover:text-fg">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Yuklash
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadCover(e.target.files[0])} />
              </label>
            </span>
          </label>
        </div>
        <label className="grid gap-1 text-[12.5px] font-semibold text-fg-3">
          Qisqa tavsif (ro&apos;yxat kartasi va SEO description)
          <textarea value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} maxLength={300} rows={2} className="field resize-y py-2 text-[13.5px] font-normal text-fg" />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold text-fg-3">
          Matn — markdown-lite: ## sarlavha · - ro&apos;yxat · **qalin** · [matn](https://havola) · &gt; iqtibos
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={16} className="field resize-y py-2 font-mono text-[13px] font-normal leading-relaxed text-fg" />
          {errors.body && <span className="font-normal text-danger">{errors.body}</span>}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Saqlash
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-fg-2">
            <input type="checkbox" checked={draft.isPublished} onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })} /> E&apos;lon qilingan
          </label>
          {draft.id && (
            <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-fg-3 hover:text-fg">
              <Eye size={14} /> Ko&apos;rish
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    // grid-cols-[minmax(0,1fr)]: grid ustuni kontentning eng kichik kengligidan (uzun sarlavha/slug) kengaymasin — telefonda
    // qator ekrandan chiqib ketardi (x≈529); `truncate` faqat `min-w-0` bo'lgan flex elementda ishlaydi
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div>
        <Button type="button" onClick={() => setDraft({ ...EMPTY })}>
          <Plus size={15} /> Yangi maqola
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-fg-3">Hali maqola yo&apos;q — birinchisini yozing.</p>
      ) : (
        <ul className="min-w-0 divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex min-w-0 items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <a href={`/blog/${a.slug}`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[14px] font-semibold text-fg hover:underline">
                    {a.title}
                  </a>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold", a.isPublished ? "bg-success-soft text-success-text" : "bg-fg/8 text-fg-3")}>{a.isPublished ? "E'lon qilingan" : "Qoralama"}</span>
                </span>
                <span className="block truncate text-[12px] text-fg-3">
                  /blog/{a.slug}
                  {a.publishedAt ? ` · ${formatDate(new Date(a.publishedAt))}` : ""}
                </span>
              </span>
              <button type="button" onClick={() => void edit(a)} aria-label="Tahrirlash" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => void remove(a)} aria-label="O'chirish" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-danger-text">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
