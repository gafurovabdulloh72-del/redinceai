import type { ReactNode } from "react";

/** `**qalin**` bo'laklarini <b> ga aylantiradi (boshqa markdown yo'q) */
function inline(s: string, key: string): ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={`${key}-${i}`}>{p.slice(2, -2)}</b> : <span key={`${key}-${i}`}>{p}</span>));
}

/**
 * Jamoa qoidalari — markdown-lite: `- ` yoki `• ` bilan boshlangan qatorlar ro'yxat, `**qalin**`, bo'sh qator — abzats.
 * Server komponent (hooks yo'q); HTML kiritilmaydi — faqat matn.
 */
export function RulesText({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="grid gap-1.5 pl-4">
        {items.map((it, i) => (
          <li key={i} className="list-disc marker:text-fg-4">
            {inline(it, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>,
    );
  };
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^(?:[-*•]\s+)(.+)$/.exec(line);
    if (m) {
      list.push(m[1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={`p-${blocks.length}`}>{inline(line, `p-${blocks.length}`)}</p>);
  }
  flush();
  return <div className={className}>{blocks}</div>;
}
