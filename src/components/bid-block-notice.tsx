import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/datetime";

// 노쇼·딜러 사정 취소가 2회 쌓이면 7일 동안 입찰할 수 없다
export function BidBlockNotice({ until }: { until: string }) {
  const t = useTranslations("penalty");
  const locale = useLocale();
  return (
    <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
      <p className="text-body font-semibold text-danger">⛔ {t("blockedTitle")}</p>
      <p className="text-caption text-ink/70">{t("blockedUntil", { date: formatDateTime(until, locale) })}</p>
    </section>
  );
}
