"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { pixelateRegion } from "@/lib/image";

type Rect = { x: number; y: number; width: number; height: number };

// 번호판이 보통 있는 자리(아래 가운데)에 가림 상자를 놓고 시작한다
const DEFAULT_RECT: Rect = { x: 0.33, y: 0.62, width: 0.34, height: 0.12 };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// 앞·뒤 사진의 번호판 가리기: 상자를 끌어 번호판 위에 놓고, 모서리로 크기를 바꾼다
export function PlateMaskEditor({
  blob,
  onDone,
  onCancel,
}: {
  blob: Blob;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("carForm.plateMask");
  const [url] = useState(() => URL.createObjectURL(blob));
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; start: Rect } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  function begin(mode: "move" | "resize", e: PointerEvent<HTMLElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: rect };
  }

  function move(e: PointerEvent<HTMLElement>) {
    const frame = frameRef.current?.getBoundingClientRect();
    if (!drag.current || !frame) return;
    const dx = (e.clientX - drag.current.startX) / frame.width;
    const dy = (e.clientY - drag.current.startY) / frame.height;
    const s = drag.current.start;
    if (drag.current.mode === "move") {
      setRect({ ...s, x: clamp(s.x + dx, 0, 1 - s.width), y: clamp(s.y + dy, 0, 1 - s.height) });
    } else {
      setRect({ ...s, width: clamp(s.width + dx, 0.08, 1 - s.x), height: clamp(s.height + dy, 0.04, 1 - s.y) });
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      onDone(await pixelateRegion(blob, rect));
    } catch {
      onDone(blob);
    }
  }

  const pct = (v: number) => `${v * 100}%`;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black p-4" role="dialog" aria-modal="true" aria-label={t("title")}>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3">
        <p className="text-subtitle font-semibold text-white">{t("title")}</p>
        <p className="text-caption text-white/70">{t("hint")}</p>
        <div className="flex flex-1 items-center justify-center">
          <div ref={frameRef} className="relative touch-none select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="max-h-[60vh] w-auto rounded-lg" draggable={false} />
            <div
              onPointerDown={(e) => begin("move", e)}
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              className="absolute cursor-move rounded border-2 border-steppe bg-black/60"
              style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.width), height: pct(rect.height) }}
            >
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-caption font-bold text-white">
                {t("box")}
              </span>
              <span
                onPointerDown={(e) => begin("resize", e)}
                onPointerMove={move}
                onPointerUp={() => (drag.current = null)}
                aria-label={t("resize")}
                className="absolute -right-3 -bottom-3 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-steppe"
              />
            </div>
          </div>
        </div>
        <button type="button" disabled={busy} onClick={confirm} className="h-12 rounded-xl bg-white font-bold text-navy disabled:opacity-50">
          {t("apply")}
        </button>
        <button type="button" disabled={busy} onClick={() => onDone(blob)} className="h-10 text-caption text-white/70">
          {t("skip")}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="h-10 text-caption text-white/50">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
