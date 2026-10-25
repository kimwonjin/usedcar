import { useTranslations } from "next-intl";

// 판매자에게 보여주는 관심도: 상세를 본 딜러 수, 찜한 딜러 수 (누구인지는 공개하지 않음)
export function AuctionInterest({ viewers, favorites, tip }: { viewers: number; favorites: number; tip?: "noBids" | null }) {
  const t = useTranslations("interest");
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="price text-title font-bold text-navy">{viewers}</p>
          <p className="text-caption text-ink/60">{t("viewers")}</p>
        </div>
        <div>
          <p className="price text-title font-bold text-navy">{favorites}</p>
          <p className="text-caption text-ink/60">{t("favorites")}</p>
        </div>
      </div>
      {tip === "noBids" && <p className="text-caption text-ink/70">💡 {t(viewers > 0 ? "tipViewedNoBids" : "tipNoViews")}</p>}
    </section>
  );
}
