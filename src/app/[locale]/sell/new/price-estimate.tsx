"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Estimate = { sample: number; avg_price: number | null; min_price: number | null; max_price: number | null };

// 예상 시세: 같은 제조사·모델, 연식 ±2년의 최근 완료 거래로 계산 (거래가 쌓일수록 정확해진다)
export function PriceEstimate({ make, model, year }: { make: string; model: string; year: number }) {
  const t = useTranslations("estimate");
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  useEffect(() => {
    createClient()
      .rpc("estimate_price", { p_make: make, p_model: model, p_year: year })
      .then(({ data }) => setEstimate(((data as Estimate[] | null)?.[0] ?? { sample: 0 }) as Estimate));
  }, [make, model, year]);

  if (!estimate) return null;
  if (!estimate.sample || !estimate.avg_price) {
    return <p className="rounded-xl bg-white p-4 text-caption text-ink/60 shadow-sm">📊 {t("noData")}</p>;
  }
  return (
    <section className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-sm">
      <p className="text-caption text-ink/60">📊 {t("title", { model: `${make} ${model}` })}</p>
      <p className="price text-title font-bold text-navy">{formatTenge(estimate.avg_price)}</p>
      <p className="price text-caption text-ink/60">
        {t("range", { min: formatTenge(estimate.min_price ?? 0), max: formatTenge(estimate.max_price ?? 0), count: estimate.sample })}
      </p>
      {estimate.sample < 5 && <p className="text-caption text-ink/50">{t("lowSample")}</p>}
    </section>
  );
}
