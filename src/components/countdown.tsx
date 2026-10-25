"use client";

import { useSyncExternalStore } from "react";

// 1초마다 바뀌는 현재 시각. 서버 렌더링에서는 null이라 하이드레이션 불일치가 없다.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const getNow = () => Math.floor(Date.now() / 1000);
const getServerNow = () => null;

const URGENT_SECONDS = 60 * 60;

// inverse: 어두운 배경 위에서 쓸 때 (임박 시에도 읽히도록 금색)
export function Countdown({ endsAt, inverse = false }: { endsAt: string; inverse?: boolean }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  if (now === null) return <span className="price">--:--:--</span>;

  const left = Math.max(0, Math.floor(new Date(endsAt).getTime() / 1000) - now);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className={`price ${left < URGENT_SECONDS ? (inverse ? "text-gold" : "text-danger") : inverse ? "text-white" : "text-ink"}`}>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
