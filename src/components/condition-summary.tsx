"use client";

import { useTranslations } from "next-intl";
import { PANELS, type DamageMap } from "@/lib/car-catalog";
import { DamageDiagram, DamageLegend } from "./damage-diagram";

export type CarCondition = {
  options: string[] | null;
  accident: string | null;
  owners: number | null;
  damage: DamageMap | null;
};

// 딜러·관리자가 보는 차량 상태표 (사고 이력·소유자 수·외판 그림·옵션)
export function ConditionSummary({ condition }: { condition: CarCondition }) {
  const t = useTranslations("condition");
  const damage = condition.damage ?? {};
  const marked = PANELS.filter((p) => damage[p]);
  const options = condition.options ?? [];

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
