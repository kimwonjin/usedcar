import { useTranslations } from "next-intl";
import { formatTenge } from "@/lib/format";

export type MarketEstimate = { sample: number; avg_price: number | null };

// 비슷한 차(같은 모델, 연식 ±2년)의 평균 낙찰가. 판매 결정에 참고하도록 보여준다
export function MarketReference({ estimate }: { estimate: MarketEstimate | null }) {
  const t = useTranslations("market");
  if (!estimate?.sample || !estimate.avg_price) return null;
  return (
    <p className="rounded-xl bg-white p-4 text-caption text-ink/70 shadow-sm">
      📊 {t("reference", { price: formatTenge(estimate.avg_price), count: estimate.sample })}
    </p>
  );
}

// 금액이 시세보다 몇 % 높은지/낮은지
export function vsMarket(amount: number, estimate: MarketEstimate | null): number | null {
  if (!estimate?.sample || !estimate.avg_price) return null;
  return Math.round(((amount - estimate.avg_price) / estimate.avg_price) * 100);
}
