import type { ReactNode } from "react";

/**
 * Blog maqolasi matni (markdown-lite, xom HTML YO'Q — hammasi matn sifatida):
 *  - "## Sarlavha" → h2, "### Sarlavha" → h3
 *  - "- band" ketma-ket qatorlar → ro'yxat
 *  - "> iqtibos" → blockquote
 *  - bo'sh qator — yangi xatboshi; **qalin** va [matn](https://havola) ichkarida
 */

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(INLINE).forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(<strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("[")) {
      const m = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (m) {
        out.push(
          <a key={`${keyBase}-${i}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">
            {m[1]}
          </a>,
        );
      } else out.push(part);
    } else out.push(part);
  });
  return out;
}

export function ArticleBody({ body }: { body: string }) {
  const lines = body.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="grid gap-1.5 pl-5">
        {items.map((it, i) => (
          <li key={i} className="list-disc marker:text-fg-4">
            {inline(it, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>,
    );
  };
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    para = [];
    blocks.push(<p key={`p-${blocks.length}`}>{inline(text, `p-${blocks.length}`)}</p>);
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      flushPara();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-2 font-display text-[17px] font-semibold text-fg">
          {inline(line.slice(4), `h3-${blocks.length}`)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      flushPara();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mt-4 font-display text-[21px] font-semibold text-fg">
          {inline(line.slice(3), `h2-${blocks.length}`)}
        </h2>,
      );
    } else if (line.startsWith("> ")) {
      flushList();
      flushPara();
      blocks.push(
        <blockquote key={`q-${blocks.length}`} className="border-l-2 border-accent/60 pl-4 text-fg-2 italic">
          {inline(line.slice(2), `q-${blocks.length}`)}
        </blockquote>,
      );
    } else if (line.startsWith("- ")) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList();
  flushPara();

  return <div className="grid gap-4 text-[15.5px] leading-[1.75] text-fg-2">{blocks}</div>;
}
