import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/datetime";
import { formatKm, formatTenge } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

// 최근 낙찰 사례·현황은 5분마다 새로 만든다 (정적 페이지 유지)
export const revalidate = 300;

type Sale = { make: string; model: string; year: number; mileage_km: number; price: number; completed_at: string };
type Stats = { live_auctions: number; approved_dealers: number; completed_deals: number };

export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const common = await getTranslations("common");

  // 공개 함수는 GET으로 불러야 Next 캐시에 담긴다
  const supabase = createPublicClient();
  const [salesResult, statsResult] = supabase
    ? await Promise.all([
        supabase.rpc("recent_sales", { p_limit: 6 }, { get: true }),
        supabase.rpc("public_stats", undefined, { get: true }),
      ])
    : [null, null];
  const sales = (salesResult?.data ?? []) as Sale[];
  const stats = (statsResult?.data?.[0] ?? null) as Stats | null;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <section className="flex flex-col gap-3 pt-6">
        <div className="flex gap-2">
          <Badge tone="verified">{common("verifiedDealer")}</Badge>
          <Badge tone="review">{common("depreciationReview")}</Badge>
        </div>
        <h1 className="text-[28px] leading-tight font-bold text-navy">{t("headline")}</h1>
        <p className="text-ink/80">{t("sub")}</p>
      </section>

      {stats && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["statLive", stats.live_auctions],
              ["statDealers", stats.approved_dealers],
              ["statSold", stats.completed_deals],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-white p-3 shadow-sm">
              <dd className="price text-title font-bold text-navy">{value}</dd>
              <dt className="text-caption text-ink/60">{t(key)}</dt>
            </div>
          ))}
        </dl>
      )}

      <Link
        href="/price"
        className="flex items-center justify-between gap-3 rounded-xl border border-steppe/30 bg-steppe/5 p-4"
      >
        <div>
          <p className="text-subtitle font-semibold text-navy">📊 {t("priceTitle")}</p>
          <p className="text-caption text-ink/70">{t("priceSub")}</p>
        </div>
        <span className="shrink-0 text-subtitle font-bold text-steppe">→</span>
      </Link>

      <ol className="flex flex-col gap-3">
        {(["step1", "step2", "step3"] as const).map((step, i) => (
          <li key={step} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-steppe font-bold text-white">
              {i + 1}
            </span>
            <span className="text-subtitle font-semibold">{t(step)}</span>
          </li>
        ))}
      </ol>

      {sales.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitle font-semibold">{t("recentSales")}</h2>
          <ul className="divide-y divide-ink/10 rounded-xl bg-white shadow-sm">
            {sales.map((sale) => (
              <li key={`${sale.completed_at}-${sale.model}`} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold">
                    {sale.make} {sale.model} · {sale.year}
                  </p>
                  <p className="text-caption text-ink/60">
                    {formatKm(sale.mileage_km)} · {formatDate(sale.completed_at, locale)}
                  </p>
                </div>
                <span className="price shrink-0 text-subtitle font-bold text-gold">{formatTenge(sale.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-caption text-ink/70">{t("promise")}</p>

      {/* 판매자 화면 원칙: 하단 고정 큰 버튼 하나 */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface pt-2 pb-4">
        <Link
          href="/login?next=/sell"
          className="flex h-14 items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white"
        >
          {t("cta")}
        </Link>
        <Link href="/login?next=/dealer" className="py-2 text-center text-caption text-steppe">
          {t("dealerCta")}
        </Link>
      </div>
    </div>
  );
}
