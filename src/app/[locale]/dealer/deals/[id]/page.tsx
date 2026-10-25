import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClaimCard } from "@/components/deal/claim-card";
import { MeetingForm } from "@/components/deal/meeting-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadDeal } from "@/lib/deals";
import { dealerFee } from "@/lib/fees";
import { formatTenge } from "@/lib/format";
import { ClaimForm } from "./claim-form";

// D5 낙찰·거래: 판매자 연락처, 만남 일정, 감가 사유·사진 제출
export default async function DealerDealPage({ params }: PageProps<"/[locale]/dealer/deals/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("deal");

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dealer", locale });
  const loaded = await loadDeal(id);
  if (!loaded || loaded.deal.dealer_id !== user.id) notFound();
  const { deal, claims, supabase } = loaded;
  const car = deal.auctions.cars;

  const { data: seller } = await supabase.from("profiles").select("phone, full_name").eq("id", deal.seller_id).maybeSingle();
  const active = deal.status === "scheduled" || deal.status === "depreciation_review";
  const price = deal.final_price ?? deal.agreed_price;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title={`${car.make} ${car.model} · ${car.year}`} backHref="/dealer/activity" backLabel={t("backToActivity")}>
        <StatusBadge kind="deal" status={deal.status} />
      </PageHeader>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-caption text-ink/60">{deal.final_price ? t("finalPrice") : t("agreedPrice")}</p>
        <p className="price text-price font-bold text-gold">{formatTenge(price)}</p>
        <p className="mt-1 text-caption text-ink/60">
          {t("plate")} <span className="price">{car.plate_number}</span> · {t("fee")} {formatTenge(dealerFee(price))}
        </p>
      </section>

      <section className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-caption text-ink/60">{t("sellerContact")}</p>
          <p className="price text-subtitle font-semibold">{seller?.phone ?? "—"}</p>
        </div>
        {seller?.phone && (
          <a href={`tel:${seller.phone}`} className="rounded-lg bg-navy px-4 py-2 text-body font-semibold text-white">
            {t("call")}
          </a>
        )}
      </section>

      <MeetingForm dealId={deal.id} meetingAt={deal.meeting_at} meetingPlace={deal.meeting_place} editable={active} />

      <section className="flex flex-col gap-3">
        <h2 className="text-subtitle font-semibold">{t("claims")}</h2>
        {claims.length === 0 && <p className="text-caption text-ink/60">{t("noClaims")}</p>}
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} agreedPrice={deal.agreed_price} />
        ))}
        {deal.status === "scheduled" && <ClaimForm dealId={deal.id} userId={user.id} agreedPrice={deal.agreed_price} />}
        {deal.status === "depreciation_review" && <p className="text-caption text-ink/60">{t("underReview")}</p>}
      </section>
    </div>
  );
}
