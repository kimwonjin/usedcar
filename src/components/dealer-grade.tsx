import { useTranslations } from "next-intl";

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
