"use client";

import { useState } from "react";

// 차량 사진 갤러리: 큰 사진 + 썸네일, 누르면 전체 화면 확대
export function PhotoGallery({ photos }: { photos: { url: string; label: string }[] }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  if (photos.length === 0) return null;
  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/5"
      >
        {/* 서명 URL(1시간 만료)이라 next/image 최적화를 거치지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.label} className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 rounded bg-ink/70 px-2 py-0.5 text-caption text-white">
          {current.label} · {index + 1}/{photos.length}
        </span>
      </button>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => setIndex(i)}
            className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${
              i === index ? "border-steppe" : "border-transparent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.label} className="size-full object-cover" />
          </button>
        ))}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.label} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
