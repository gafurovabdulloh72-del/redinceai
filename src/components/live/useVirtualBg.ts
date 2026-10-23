"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalParticipant } from "livekit-client";
import { Track } from "livekit-client";

/** Virtual fon rejimi: o'chiq · bulutlash (kuchsiz/kuchli) · rasm */
export type BgMode = "off" | "blur" | "blur-strong" | "image";

/**
 * Virtual fon (Zoom naqshi): `@livekit/track-processors` (MediaPipe selfie segmentation) kamera
 * trekiga protsessor ulaydi — orqa fon bulutlanadi yoki rasm bilan almashtiriladi.
 *
 * DIQQAT: model va wasm CDN'dan yuklanadi (jsdelivr + storage.googleapis.com) — CSP'da
 * `script-src`/`connect-src`ga shu xostlar qo'shilgan. Brauzer qo'llab-quvvatlamasa
 * `supported=false` qaytadi va UI tugmani ko'rsatmaydi.
 */
export function useVirtualBg(localParticipant: LocalParticipant, onError?: (t: string) => void) {
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<BgMode>("off");
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<string>("");

  useEffect(() => {
    let alive = true;
    void import("@livekit/track-processors")
      .then((m) => alive && setSupported(m.supportsBackgroundProcessors()))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const apply = useCallback(
    async (next: BgMode, imageUrl?: string) => {
      if (busy) return;
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track) {
        onError?.("Avval kamerani yoqing");
        return;
      }
      setBusy(true);
      try {
        if (next === "off") {
          await track.stopProcessor();
          setMode("off");
          return;
        }
        const m = await import("@livekit/track-processors");
        if (next === "image") {
          const url = imageUrl ?? imageRef.current;
          if (!url) throw new Error("Rasm tanlanmadi");
          imageRef.current = url;
          await track.setProcessor(m.VirtualBackground(url));
        } else {
          await track.setProcessor(m.BackgroundBlur(next === "blur-strong" ? 20 : 10));
        }
        setMode(next);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Fonni qo'llab bo'lmadi");
      } finally {
        setBusy(false);
      }
    },
    [busy, localParticipant, onError],
  );

  return { supported, mode, busy, apply };
}
