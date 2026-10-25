"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { formatTenge } from "@/lib/format";

export type BidEvent = { amount: number; created_at: string };

// 시간에 따른 최고가(계단형 선). 단일 계열이라 범례 없이 제목이 이름을 대신하고,
// 끝점에 현재 값, 포인터·키보드로 시점별 값, 아래 표에서 전체 기록을 볼 수 있다.
const W = 360;
const H = 150;
const PAD = { top: 16, right: 12, bottom: 22, left: 12 };
const LINE = "#0089A8"; // 검증 통과 색(명도·채도·대비 3:1 이상)

export function PriceChart({ events, startAt, endAt }: { events: BidEvent[]; startAt: string; endAt: string }) {
  const t = useTranslations("priceChart");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  // 입찰이 들어올 때마다 그 시점의 최고가
  const points = useMemo(
    () =>
      [...events]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .reduce<{ time: number; amount: number }[]>((acc, e) => {
          const top = acc.length ? acc[acc.length - 1].amount : 0;
          return e.amount > top ? [...acc, { time: new Date(e.created_at).getTime(), amount: e.amount }] : acc;
        }, []),
    [events],
  );

  if (points.length === 0) return null;

  const t0 = new Date(startAt).getTime();
  const t1 = Math.max(new Date(endAt).getTime(), points[points.length - 1].time);
  const low = points[0].amount;
  const high = points[points.length - 1].amount;
  const span = Math.max(high - low, high * 0.05);
  const x = (time: number) => PAD.left + ((time - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
  const y = (amount: number) => PAD.top + (1 - (amount - (low - span * 0.15)) / (span * 1.3)) * (H - PAD.top - PAD.bottom);

  // 계단형: 다음 입찰 전까지 최고가가 유지된다
  let d = `M ${x(points[0].time)} ${y(points[0].amount)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${x(points[i].time)} V ${y(points[i].amount)}`;
  }
  const lastX = x(Math.min(t1, Date.parse(endAt)));
  d += ` H ${Math.max(lastX, x(points[points.length - 1].time))}`;

  const active = hover !== null ? points[hover] : null;

  function pick(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    // 포인터 위치까지 들어온 마지막 입찰(계단의 현재 값)
    let index = 0;
    points.forEach((p, i) => {
      if (x(p.time) <= px) index = i;
    });
    setHover(index);
  }

  const time = (ms: number) =>
    new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Almaty", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(ms);

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-body font-semibold">{t("title")}</h2>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={t("aria", { amount: formatTenge(high), count: points.length })}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
            if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
          }}
        >
          {/* 기준선(헤어라인) */}
          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#E5E7EB" strokeWidth={1} />
          <path d={d} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active && (
            <line x1={x(active.time)} x2={x(active.time)} y1={PAD.top - 6} y2={H - PAD.bottom} stroke="#9CA3AF" strokeWidth={1} />
          )}
          {/* 끝점: 표면색 테두리 2px */}
          <circle cx={x(points[points.length - 1].time)} cy={y(high)} r={4} fill={LINE} stroke="#FFFFFF" strokeWidth={2} />
          {active && <circle cx={x(active.time)} cy={y(active.amount)} r={4} fill={LINE} stroke="#FFFFFF" strokeWidth={2} />}
          <text x={PAD.left} y={H - 6} fontSize={10} fill="#6B7280">
            {time(t0)}
          </text>
          <text x={W - PAD.right} y={H - 6} fontSize={10} fill="#6B7280" textAnchor="end">
            {time(t1)}
          </text>
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute top-0 rounded-lg border border-ink/10 bg-white px-2 py-1 shadow-md"
            style={{ left: `${(x(active.time) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="price text-body font-bold whitespace-nowrap">{formatTenge(active.amount)}</p>
            <p className="text-caption whitespace-nowrap text-ink/60">{time(active.time)}</p>
          </div>
        )}
      </div>
      <p className="text-caption text-ink/60">
        {t("summary", { from: formatTenge(low), to: formatTenge(high), count: points.length })}
      </p>
      <details className="text-caption">
        <summary className="cursor-pointer text-ink/60">{t("table")}</summary>
        <table className="mt-2 w-full">
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.time} className="border-t border-ink/5">
                <td className="py-1 text-ink/60">{time(p.time)}</td>
                <td className="price py-1 text-right font-semibold">{formatTenge(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
