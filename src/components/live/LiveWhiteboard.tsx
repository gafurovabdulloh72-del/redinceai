"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel } from "@livekit/components-react";
import { Eraser, Palette, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Doska chizig'i: nuqtalar 0..1 oralig'ida (har qanday ekran o'lchamida bir xil ko'rinadi) */
type Stroke = { color: string; w: number; pts: [number, number][] };
type Packet = { t: "stroke"; s: Stroke } | { t: "clear" } | { t: "ask" } | { t: "all"; list: Stroke[] };

const COLORS = ["#ffffff", "#ff5a36", "#ffcf40", "#4ade80", "#60a5fa", "#f472b6"] as const;
const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Umumiy doska (Zoom Whiteboard naqshi): chizish LiveKit data kanali (`topic=wb`) orqali
 * hammaga uzatiladi. Chizish huquqi — boshlovchi/hammuallif va sahnaga chiqarilganlar.
 * Tarix serverda saqlanmaydi: yangi kirgan odam `ask` yuboradi, chizgan odam `all` bilan javob beradi.
 */
export function LiveWhiteboard({ canDraw, onClose }: { canDraw: boolean; onClose: () => void }) {
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [pickColor, setPickColor] = useState(false);
  const strokes = useRef<Stroke[]>([]);
  const cur = useRef<Stroke | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [, bump] = useState(0);

  const paint = useCallback(() => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of [...strokes.current, ...(cur.current ? [cur.current] : [])]) {
      if (s.pts.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.w * (c.width / 1000);
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0] * c.width, s.pts[0][1] * c.height);
      for (const [x, y] of s.pts.slice(1)) ctx.lineTo(x * c.width, y * c.height);
      ctx.stroke();
    }
  }, []);

  const { send } = useDataChannel("wb", (msg) => {
    try {
      const p = JSON.parse(dec.decode(msg.payload)) as Packet;
      if (p.t === "stroke") strokes.current = [...strokes.current.slice(-400), p.s];
      else if (p.t === "clear") strokes.current = [];
      else if (p.t === "all") strokes.current = p.list.slice(-400);
      else if (p.t === "ask" && strokes.current.length) {
        void send(enc.encode(JSON.stringify({ t: "all", list: strokes.current } satisfies Packet)), { reliable: true }).catch(() => undefined);
        return;
      }
      paint();
      bump((n) => n + 1);
    } catch {
      /* buzuq paket */
    }
  });

  const push = useCallback((p: Packet, reliable = true) => void send(enc.encode(JSON.stringify(p)), { reliable }).catch(() => undefined), [send]);

  // Ochilganda mavjud chiziqlarni so'raymiz
  useEffect(() => {
    push({ t: "ask" });
  }, [push]);

  // O'lcham o'zgarsa qayta chizamiz
  useEffect(() => {
    const el = box.current;
    const c = cv.current;
    if (!el || !c) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint]);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  function down(e: React.PointerEvent) {
    if (!canDraw) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    cur.current = { color, w: width, pts: [at(e)] };
    paint();
  }
  function move(e: React.PointerEvent) {
    if (!cur.current) return;
    cur.current.pts.push(at(e));
    paint();
  }
  function up() {
    const s = cur.current;
    cur.current = null;
    if (!s || s.pts.length < 2) return paint();
    strokes.current = [...strokes.current.slice(-400), s];
    push({ t: "stroke", s });
    paint();
  }

  return (
    <div className="absolute inset-0 z-[12] flex flex-col rounded-xl bg-[#101013] p-2" role="region" aria-label="Umumiy doska">
      <div className="flex items-center gap-1.5 pb-2">
        <Pencil size={15} className="text-white/60" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">Doska{canDraw ? "" : " — faqat tomosha"}</p>
        {canDraw && (
          <>
            <div className="relative">
              <button type="button" onClick={() => setPickColor((o) => !o)} aria-label="Rang" className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20">
                <Palette size={15} style={{ color }} />
              </button>
              {pickColor && (
                <div className="absolute right-0 top-full z-10 mt-1 flex gap-1 rounded-xl bg-[#1f1f23] p-1.5 shadow-lg">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Rang ${c}`}
                      onClick={() => {
                        setColor(c);
                        setPickColor(false);
                      }}
                      className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-white" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5">
              <span className="text-[11px] text-white/60">Qalin</span>
              <input type="range" min={2} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Chiziq qalinligi" className="w-16 accent-white" />
            </label>
            <button
              type="button"
              onClick={() => {
                strokes.current = [];
                push({ t: "clear" });
                paint();
              }}
              aria-label="Tozalash"
              title="Tozalash"
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
            >
              <Eraser size={15} />
            </button>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Doskani yopish" className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10">
          <X size={16} />
        </button>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-[#1a1a1f]">
        <canvas ref={cv} className="absolute inset-0 h-full w-full" />
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={cn("absolute inset-0", canDraw ? "cursor-crosshair touch-none" : "pointer-events-none")}
          aria-hidden
        />
      </div>
    </div>
  );
}
