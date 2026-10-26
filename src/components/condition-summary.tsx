"use client";

import { useTranslations } from "next-intl";
import { PANELS, type DamageMap } from "@/lib/car-catalog";
import { DamageDiagram, DamageLegend } from "./damage-diagram";

export type CarCondition = {
  options: string[] | null;
  accident: string | null;
  owners: number | null;
  damage: DamageMap | null;
  // 상태 상세 (예전에 등록한 차는 없을 수 있다)
  spare_key?: boolean | null;
  tire_state?: string | null;
  wheel_scratches?: number | null;
  panel_scratches?: string | null;
  repair_needed?: boolean | null;
  pros?: string | null;
};

// 딜러·관리자가 보는 차량 상태표 (사고 이력·소유자 수·외판 그림·옵션)
export function ConditionSummary({ condition }: { condition: CarCondition }) {
  const t = useTranslations("condition");
  const damage = condition.damage ?? {};
  const marked = PANELS.filter((p) => damage[p]);
  const options = condition.options ?? [];
  const na = t("notStated");
  const wheels = condition.wheel_scratches;
  // [항목, 값, 감가 요인인지]
  const details: [string, string, boolean][] = [
    [
      t("detail.spareKeyLabel"),
      condition.spare_key == null ? na : t(condition.spare_key ? "detail.has" : "detail.hasNot"),
      condition.spare_key === false,
    ],
    [
      t("detail.tiresLabel"),
      condition.tire_state ? t(`detail.tireStates.${condition.tire_state as "ok"}`) : na,
      Boolean(condition.tire_state && condition.tire_state !== "ok"),
    ],
    [
      t("detail.wheelsLabel"),
      wheels == null ? na : wheels === 0 ? t("detail.none") : t("detail.wheelsCount", { count: wheels }),
      Boolean(wheels),
    ],
    [
      t("detail.panelsLabel"),
      condition.panel_scratches ? t(`detail.panelScratches.${condition.panel_scratches as "none"}`) : na,
      Boolean(condition.panel_scratches && condition.panel_scratches !== "none"),
    ],
    [
      t("detail.repairLabel"),
      condition.repair_needed == null ? na : t(condition.repair_needed ? "detail.repairYes" : "detail.none"),
      condition.repair_needed === true,
    ],
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-subtitle font-semibold">{t("title")}</h2>
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-caption text-ink/60">{t("accident")}</dt>
          <dd
            className={`text-body font-semibold ${condition.accident === "major" ? "text-danger" : ""}`}
          >
            {condition.accident
              ? t(`accidents.${condition.accident as "none"}`)
              : t("notStated")}
          </dd>
        </div>
        <div className="rounded-lg bg-surface p-3">
          <dt className="text-caption text-ink/60">{t("owners")}</dt>
          <dd className="text-body font-semibold">
            {condition.owners
              ? condition.owners >= 4
                ? t("ownersMany")
                : t("ownersCount", { count: condition.owners })
              : t("notStated")}
          </dd>
        </div>
      </dl>

      <dl className="grid grid-cols-2 gap-2 text-caption">
        {details.map(([label, value, warn]) => (
          <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2">
            <dt className="text-ink/60">{label}</dt>
            <dd className={`text-right font-semibold ${warn ? "text-danger" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-4">
        <DamageDiagram damage={damage} className="h-56 w-auto shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <DamageLegend />
          {marked.length === 0 ? (
            <p className="text-body text-ink/70">{t("noDamage")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-body">
              {marked.map((panel) => (
                <li key={panel}>
                  {t(`panels.${panel}`)} ·{" "}
                  <span className="font-semibold">
                    {t(`kinds.${damage[panel]!}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {condition.pros && (
        <div className="rounded-lg bg-steppe/5 p-3">
          <p className="mb-1 text-caption text-ink/60">👍 {t("detail.pros")}</p>
          <p className="text-body whitespace-pre-line">{condition.pros}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-caption text-ink/60">{t("options")}</p>
        {options.length === 0 ? (
          <p className="text-body text-ink/70">{t("noOptions")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {options.map((o) => (
              <li
                key={o}
                className="rounded-full bg-steppe/10 px-2.5 py-1 text-caption font-semibold text-navy"
              >
                {t(`optionNames.${o as "sunroof"}`)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
