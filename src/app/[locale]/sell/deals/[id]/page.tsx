import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { ClaimCard } from "@/components/deal/claim-card";
import { MeetingForm } from "@/components/deal/meeting-form";
import { PageHeader } from "@/components/page-header";
import { Stars } from "@/components/stars";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadDeal } from "@/lib/deals";
import { formatTenge } from "@/lib/format";
import { ClaimComment, DealActions, RatingForm } from "./deal-actions";

// S8 거래 진행: 딜러 연락처·만남 일정, 감가 사유 확인, 거래 완료, 딜러 평가
export default async function SellerDealPage({ params }: PageProps<"/[locale]/sell/deals/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("deal");

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/sell", locale });
  const loaded = await loadDeal(id);
  if (!loaded || loaded.deal.seller_id !== user.id) notFound();
  const { deal, claims, supabase } = loaded;
  const car = deal.auctions.cars;

  const [{ data: dealer }, { data: dealerProfile }] = await Promise.all([
    supabase.from("dealers").select("business_name, rating, address").eq("id", deal.dealer_id).maybeSingle(),
    supabase.from("profiles").select("phone").eq("id", deal.dealer_id).maybeSingle(),
  ]);
  const active = deal.status === "scheduled" || deal.status === "depreciation_review";
  const approvedDeduction = claims.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amount, 0);
  const expected = deal.agreed_price - approvedDeduction;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title={`${car.make} ${car.model} · ${car.year}`} backHref="/sell" backLabel={t("backToHome")}>
        <StatusBadge kind="deal" status={deal.status} />
      </PageHeader>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-caption text-ink/60">{deal.final_price ? t("finalPrice") : t("expectedPrice")}</p>
        <p className="price text-price font-bold text-gold">{formatTenge(deal.final_price ?? expected)}</p>
        {approvedDeduction > 0 && (
          <p className="price text-caption text-ink/60">
            {t("agreedPrice")} {formatTenge(deal.agreed_price)} − {t("deduction")} {formatTenge(approvedDeduction)}
          </p>
        )}
      </section>

      <section className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-subtitle font-semibold">{dealer?.business_name}</p>
            <Badge tone="verified">✓</Badge>
          </div>
          <div className="flex items-center gap-2 text-caption text-ink/60">
            <Stars rating={dealer?.rating ?? 0} />
            <span className="price">{dealerProfile?.phone}</span>
          </div>
          {dealer?.address && <p className="truncate text-caption text-ink/60">{dealer.address}</p>}
        </div>
        {dealerProfile?.phone && (
          <a href={`tel:${dealerProfile.phone}`} className="shrink-0 rounded-lg bg-navy px-4 py-2 text-body font-semibold text-white">
            {t("call")}
          </a>
        )}
      </section>

      {active && (
        <ol className="flex flex-col gap-1 rounded-xl bg-white p-4 text-caption text-ink/70 shadow-sm">
          <li>1. {t("step1")}</li>
          <li>2. {t("step2")}</li>
          <li className="font-semibold text-danger">3. {t("step3")}</li>
          <li>4. {t("step4")}</li>
        </ol>
      )}

      <MeetingForm dealId={deal.id} meetingAt={deal.meeting_at} meetingPlace={deal.meeting_place} editable={active} />

      {claims.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitle font-semibold">{t("claims")}</h2>
          <p className="text-caption text-ink/60">{t("claimsSellerHint")}</p>
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} agreedPrice={deal.agreed_price}>
              {claim.status === "submitted" && !claim.seller_comment && <ClaimComment claimId={claim.id} />}
            </ClaimCard>
          ))}
        </section>
      )}

      <DealActions dealId={deal.id} status={deal.status} />
      {deal.status === "completed" && deal.seller_rating === null && <RatingForm dealId={deal.id} />}
      {deal.seller_rating !== null && (
        <p className="text-center text-caption text-ink/60">
          {t("rated")} <span className="text-gold">{"★".repeat(deal.seller_rating)}</span>
        </p>
      )}
    </div>
  );
}
