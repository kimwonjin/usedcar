"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const ZOOM = 2.5;

// 차량 사진 갤러리: 큰 사진 + 썸네일, 누르면 전체 화면.
// 전체 화면에서는 좌우로 밀거나 화살표로 넘기고, 두 번 탭하면 확대(끌어서 이동)한다
export function PhotoGallery({ photos }: { photos: { url: string; label: string }[] }) {
  const t = useTranslations("gallery");
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gesture = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  const count = photos.length;
  const current = photos[Math.min(index, Math.max(count - 1, 0))];

  const go = (step: number) => {
    setIndex((i) => (i + step + count) % count);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const close = () => {
    setOpen(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // 전체 화면: 키보드(← → Esc), 뒤 화면 스크롤 막기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // go·close는 매번 새로 만들어지지만 동작은 같다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, count]);

  if (count === 0) return null;

  function down(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    // 확대 중에는 끌어서 이동
    if (scale > 1) setOffset({ x: g.ox + dx, y: g.oy + dy });
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = e.clientX - g.x;
    // 확대하지 않은 상태에서 옆으로 밀면 사진 넘기기
    if (scale === 1 && g.moved && Math.abs(dx) > 50) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (g.moved) return;
    // 두 번 탭: 확대/원래대로
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale((s) => (s > 1 ? 1 : ZOOM));
      setOffset({ x: 0, y: 0 });
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen(true)} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5">
        {/* 서명 URL(1시간 만료)이라 next/image 최적화를 거치지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.label} className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 rounded bg-ink/70 px-2 py-0.5 text-caption text-white">
          {current.label} · {index + 1}/{count}
        </span>
        <span className="absolute right-2 bottom-2 rounded bg-ink/70 px-2 py-0.5 text-caption text-white">⤢</span>
      </button>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => setIndex(i)}
            className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-steppe" : "border-transparent"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.label} className="size-full object-cover" />
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={current.label}>
          <div className="flex items-center justify-between gap-3 p-3 text-white">
            <span className="text-body">
              {current.label} · {index + 1}/{count}
            </span>
            <button type="button" onClick={close} aria-label={t("close")} className="p-2 text-title">
              ✕
            </button>
          </div>
          <div
            className="relative flex flex-1 touch-none items-center justify-center overflow-hidden select-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => (gesture.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.label}
              draggable={false}
              className="max-h-full max-w-full object-contain transition-transform duration-150"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            />
            {count > 1 && scale === 1 && (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => go(-1)}
                  aria-label={t("prev")}
                  className="absolute left-2 rounded-full bg-white/15 px-3 py-2 text-title text-white"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => go(1)}
                  aria-label={t("next")}
                  className="absolute right-2 rounded-full bg-white/15 px-3 py-2 text-title text-white"
                >
                  ›
                </button>
              </>
            )}
          </div>
          <p className="p-3 text-center text-caption text-white/60">{t(scale > 1 ? "zoomedHint" : "hint")}</p>
        </div>
      )}
    </div>
  );
}
