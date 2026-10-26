import { useTranslations } from "next-intl";
import { formatTenge } from "@/lib/format";
import type { DealerDepreciation } from "@/lib/dealer-grades";

export type DealerGrade = "top" | "trusted" | "new" | "standard" | "caution";

const STYLE: Record<DealerGrade, string> = {
  top: "bg-gold/15 text-navy",
  trusted: "bg-steppe/10 text-navy",
  new: "bg-ink/5 text-ink/70",
  standard: "bg-ink/5 text-ink/70",
  caution: "bg-danger/10 text-danger",
};
const ICON: Record<DealerGrade, string> = { top: "🏆", trusted: "✓", new: "🆕", standard: "", caution: "⚠️" };

// 딜러 등급 배지 (평점·완료 거래·최근 딜러 책임 취소로 DB에서 계산). 일반 등급은 표시하지 않는다
export function DealerGradeBadge({ grade }: { grade: DealerGrade | undefined }) {
  const t = useTranslations("dealerGrade");
  if (!grade || grade === "standard") return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${STYLE[grade]}`}>
      {ICON[grade]} {t(grade)}
    </span>
  );
}

// 방문 후 감가 기록: 평균 감가율, 감가한 거래 수, (기록이 충분하면) 입찰가 기준 예상 실수령액
export function DepreciationInfo({ record, amount }: { record: DealerDepreciation | undefined; amount?: number }) {
  const t = useTranslations("depreciation");
  if (!record || record.deals === 0) return <p className="text-caption text-ink/50">{t("none")}</p>;
  const enough = record.deals >= MIN_DEALS;
  const tone = !enough ? "text-ink/70" : record.avgRate >= HIGH_RATE ? "text-danger" : record.avgRate < LOW_RATE ? "text-success" : "text-ink/70";
  const expected = amount && enough && record.avgRate > 0 ? Math.round((amount * (1 - record.avgRate / 100)) / 1000) * 1000 : null;
  return (
    <div className="flex flex-col text-caption">
      <p className={`price font-semibold ${tone}`}>
        {enough && record.avgRate >= HIGH_RATE && "⚠️ "}
        {t("rate", { rate: record.avgRate.toFixed(1), deals: record.deals, reduced: record.reduced })}
        {!enough && <span className="font-normal text-ink/50"> · {t("few")}</span>}
      </p>
      {expected !== null && <p className="price text-ink/60">{t("expected", { amount: formatTenge(expected) })}</p>}
    </div>
  );
}

// 기록이 3건 미만이면 판단 근거로 약하므로 색·예상액을 표시하지 않는다
const MIN_DEALS = 3;
const LOW_RATE = 2;
const HIGH_RATE = 5;
