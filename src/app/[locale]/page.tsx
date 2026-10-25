import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Badge } from "@/components/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default function LandingPage({ params }: PageProps<"/[locale]">) {
  const locale = use(params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = useTranslations("landing");
  const common = useTranslations("common");

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
