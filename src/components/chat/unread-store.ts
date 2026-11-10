"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * «Chat» nishonining JONLI qiymati (QA A2 / B6): yon panel, pastki tab, brauzer sarlavhasi va buyurtma kartasidagi
 * «Chat» tugmasi bir manbadan o'qiydi. Ilgari son server tomonda bir marta chizilardi — yangi xabar kelsa foydalanuvchi
 * sahifani qayta yuklamaguncha hech qanday belgi ko'rmasdi (chat xabarlari bildirishnomalar ro'yxatiga yozilmaydi).
 *
 * Ishlash tartibi: bitta umumiy yengil so'rov (`GET /api/chat/unread` — hech narsa yozmaydi), faqat tab KO'RINIB turganda:
 * 25 s oraliq, ketma-ket o'zgarishsiz javoblarda 60 s gacha sekinlashadi; tab qayta ko'ringanda / fokus olganda darhol.
 * Chat sahifasi ochiq bo'lsa DmChat o'z ro'yxatidagi sonlarni `publishChatUnread` bilan beradi (qo'shimcha so'rovsiz).
 * 401 (sessiya tugagan) — so'rovlar to'xtaydi.
 */
export interface ChatUnread {
  total: number;
  dm: number;
  groups: number;
  orders: number;
  /** Buyurtma id → o'qilmagan xabarlar soni */
  orderUnread: Record<string, number>;
  /** Serverdan kamida bir marta olinganmi (aks holda — sahifa bilan kelgan boshlang'ich qiymat) */
  live: boolean;
}

const EMPTY: ChatUnread = { total: 0, dm: 0, groups: 0, orders: 0, orderUnread: {}, live: false };
const BASE_MS = 25_000;
const SLOW_MS = 60_000;

let snap: ChatUnread = EMPTY;
const subs = new Set<() => void>();
let users = 0;
let timer: number | null = null;
let inflight = false;
let stopped = false;
let unchanged = 0;
let lastFetch = 0;

function emit(next: ChatUnread) {
  const same = next.total === snap.total && next.dm === snap.dm && next.groups === snap.groups && next.orders === snap.orders && next.live === snap.live && JSON.stringify(next.orderUnread) === JSON.stringify(snap.orderUnread);
  if (same) return false;
  snap = next;
  for (const f of subs) f();
  return true;
}

async function fetchNow() {
  if (inflight || stopped || typeof document === "undefined" || document.hidden) return;
  inflight = true;
  lastFetch = Date.now();
  try {
    const res = await fetch("/api/chat/unread", { cache: "no-store" });
    if (res.status === 401) {
      stopped = true;
      return;
    }
    const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: Partial<ChatUnread> } | null;
    if (!j?.ok || !j.data) return;
    const d = j.data;
    const changed = emit({ total: Number(d.total ?? 0), dm: Number(d.dm ?? 0), groups: Number(d.groups ?? 0), orders: Number(d.orders ?? 0), orderUnread: d.orderUnread ?? {}, live: true });
    unchanged = changed ? 0 : unchanged + 1;
  } catch {
    /* tarmoq yo'q — keyingi urinishda */
  } finally {
    inflight = false;
  }
}

function schedule() {
  if (timer !== null) window.clearTimeout(timer);
  if (stopped || users === 0) return;
  timer = window.setTimeout(
    async () => {
      await fetchNow();
      schedule();
    },
    unchanged >= 6 ? SLOW_MS : BASE_MS,
  );
}

function onVisible() {
  if (document.hidden) return;
  // Tab qaytdi / oyna fokus oldi: oxirgi so'rovdan 4 s o'tgan bo'lsa darhol yangilaymiz
  if (Date.now() - lastFetch > 4000) {
    unchanged = 0;
    void fetchNow().then(schedule);
  }
}

function attach() {
  users++;
  if (users > 1) return;
  stopped = false;
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  // Birinchi so'rov biroz kechikib — sahifa yuklanishiga xalaqit bermasin (boshlang'ich qiymat serverdan kelgan)
  timer = window.setTimeout(async () => {
    await fetchNow();
    schedule();
  }, 2500);
}

function detach() {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("focus", onVisible);
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const getSnap = () => snap;
const getServerSnap = () => EMPTY;

/**
 * Jonli nishon. `initialTotal` — sahifa bilan kelgan (server hisoblagan) son: birinchi so'rov javobigacha shu ko'rsatiladi
 * (gidratsiyada farq bo'lmaydi). `enabled=false` (mehmon) — so'rov yuborilmaydi.
 */
export function useChatUnread(initialTotal = 0, enabled = true): ChatUnread {
  const s = useSyncExternalStore(subscribe, getSnap, getServerSnap);
  useEffect(() => {
    if (!enabled) return;
    attach();
    return detach;
  }, [enabled]);
  return s.live ? s : { ...EMPTY, total: initialTotal, dm: initialTotal };
}

/** Darhol yangilash (masalan, suhbat o'qilgach yoki buyurtma chati yopilgach) — 400 ms ichidagi takror chaqiriqlar birlashadi */
let kick: number | null = null;
export function refreshChatUnread() {
  if (typeof window === "undefined" || stopped) return;
  if (kick !== null) window.clearTimeout(kick);
  kick = window.setTimeout(() => {
    kick = null;
    unchanged = 0;
    void fetchNow().then(schedule);
  }, 400);
}

/** Chat sahifasi o'z ro'yxatidan hisoblagan sonlar (so'rovsiz, darhol) — buyurtma taqsimoti saqlanadi */
export function publishChatUnread(part: { dm: number; groups: number; orders?: number; orderUnread?: Record<string, number> }) {
  const orderUnread = part.orderUnread ?? snap.orderUnread;
  const orders = part.orders ?? Object.values(orderUnread).reduce((a, b) => a + b, 0);
  emit({ total: part.dm + part.groups + orders, dm: part.dm, groups: part.groups, orders, orderUnread, live: true });
}
