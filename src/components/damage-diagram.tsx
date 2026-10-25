"use client";

import { useTranslations } from "next-intl";
import {
  PANELS,
  type DamageKind,
  type DamageMap,
  type Panel,
} from "@/lib/car-catalog";

// 위에서 본 차량 그림. 앞이 위쪽. [x, y, width, height]
const SHAPES: Record<Panel, [number, number, number, number]> = {
  front_bumper: [34, 4, 132, 26],
  hood: [44, 34, 112, 84],
  fl_fender: [8, 38, 32, 80],
  fr_fender: [160, 38, 32, 80],
  fl_door: [8, 122, 32, 86],
  fr_door: [160, 122, 32, 86],
  roof: [50, 158, 100, 132],
  rl_door: [8, 212, 32, 84],
  rr_door: [160, 212, 32, 84],
  rl_quarter: [8, 300, 32, 78],
  rr_quarter: [160, 300, 32, 78],
  trunk: [44, 332, 112, 52],
  rear_bumper: [34, 388, 132, 26],
};

// 유리(눌리지 않음)
const GLASS: [number, number, number, number][] = [
  [48, 122, 104, 32],
  [48, 294, 104, 34],
];

// 표시 글자는 언어별 첫 글자(condition.short.*)
export const DAMAGE_STYLE: Record<DamageKind, { fill: string; text: string }> =
  {
    scratch: { fill: "#fde8e8", text: "#d64545" },
    dent: { fill: "#f8c4c4", text: "#a32626" },
    painted: { fill: "#cceff6", text: "#14213d" },
    replaced: { fill: "#14213d", text: "#ffffff" },
  };

// 차량 외판 상태 그림. onSelect 를 주면 부위를 누를 수 있다
export function DamageDiagram({
  damage,
  selected,
  onSelect,
  className = "",
}: {
  damage: DamageMap;
  selected?: Panel | null;
  onSelect?: (panel: Panel) => void;
  className?: string;
}) {
  const t = useTranslations("condition");
  return (
    <svg
      viewBox="0 -22 200 462"
      className={className}
      role="img"
      aria-label={t("diagram")}
    >
      <text x={100} y={-8} textAnchor="middle" fontSize={13} fill="#1f293399">
        ▲ {t("front")}
      </text>
      <text x={100} y={434} textAnchor="middle" fontSize={13} fill="#1f293399">
        {t("rear")}
      </text>
      {/* 바퀴 */}
      {[60, 318].flatMap((y) =>
        [2, 188].map((x) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={10}
            height={46}
            rx={4}
            fill="#1f2933"
          />
        )),
      )}
      {GLASS.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={8} fill="#e6eaf0" />
      ))}
      {PANELS.map((panel) => {
        const [x, y, w, h] = SHAPES[panel];
        const kind = damage[panel];
        const style = kind ? DAMAGE_STYLE[kind] : null;
        const active = selected === panel;
        return (
          <g
            key={panel}
            onClick={onSelect ? () => onSelect(panel) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
            role={onSelect ? "button" : undefined}
            aria-label={`${t(`panels.${panel}`)}${kind ? ` · ${t(`kinds.${kind}`)}` : ""}`}
            aria-pressed={onSelect ? active : undefined}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={10}
              fill={style?.fill ?? "#ffffff"}
              stroke={active ? "#00a3c4" : "#1f293340"}
              strokeWidth={active ? 4 : 1.5}
            />
            {kind && style && (
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontWeight={700}
                fill={style.text}
              >
                {t(`short.${kind}`)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function DamageLegend() {
  const t = useTranslations("condition");
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink/70">
      {(Object.keys(DAMAGE_STYLE) as DamageKind[]).map((kind) => (
        <li key={kind} className="flex items-center gap-1">
          <span
            className="inline-flex size-5 items-center justify-center rounded text-[11px] font-bold"
            style={{
              background: DAMAGE_STYLE[kind].fill,
              color: DAMAGE_STYLE[kind].text,
            }}
          >
            {t(`short.${kind}`)}
          </span>
          {t(`kinds.${kind}`)}
        </li>
      ))}
    </ul>
  );
}
