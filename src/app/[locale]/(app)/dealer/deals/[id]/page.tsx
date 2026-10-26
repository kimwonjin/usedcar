import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { ClaimCard } from "@/components/deal/claim-card";
import { DealChat } from "@/components/deal/deal-chat";
import { InspectionForm, InspectionView } from "@/components/deal/inspection";
import { ReportButton } from "@/components/deal/report-button";
import { MeetingForm } from "@/components/deal/meeting-form";
import { TransferGuide } from "@/components/deal/transfer-guide";
import { TransferStatus } from "@/components/deal/transfer-status";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadDeal } from "@/lib/deals";
import { dealerFee, loadFeeBands, loadFeesEnabled } from "@/lib/fees";
import { formatTenge } from "@/lib/format";
import { ClaimForm } from "./claim-form";
import { DealerCancelButton } from "./dealer-cancel-button";

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
  const { deal, claims, messages, counterpartName, transferDocUrls, regDocUrls, inspection } = loaded;
  const hasIssue = Boolean(inspection && Object.values(inspection.items).includes("issue"));
  const car = deal.auctions.cars;
  const [feeBands, feesEnabled] = await Promise.all([loadFeeBands(loaded.supabase), loadFeesEnabled(loaded.supabase)]);
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
          {t("plate")} <span className="price">{car.plate_number}</span>
          {deal.status !== "cancelled" && ` · ${t("fee")} ${feesEnabled ? formatTenge(dealerFee(price, feeBands)) : t("feeFree")}`}
        </p>
      </section>

      <DealChat
        dealId={deal.id}
        myId={user.id}
        counterpartName={counterpartName || t("seller")}
        initialMessages={messages}
        open={deal.status !== "cancelled"}
        notificationUrl={`/dealer/deals/${deal.id}`}
      />

      <MeetingForm dealId={deal.id} meetingAt={deal.meeting_at} meetingPlace={deal.meeting_place} editable={active} />

      {deal.status !== "cancelled" && (
        <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-subtitle font-semibold">🪪 {t("regDoc")}</h2>
            {car.owner_verified_at && <Badge tone="verified">✓ {t("ownerVerified")}</Badge>}
          </div>
          {regDocUrls.length > 0 ? (
            <div className="flex gap-2">
              {regDocUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={t("regDoc")} className="h-24 w-32 rounded-lg object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-caption text-ink/60">{t("regDocMissing")}</p>
          )}
          <p className="price text-caption text-ink/60">VIN {car.vin ?? "—"} · {car.plate_number}</p>
        </section>
      )}

      {active ? (
        <InspectionForm dealId={deal.id} userId={user.id} initial={inspection} />
      ) : (
        inspection && <InspectionView inspection={inspection} />
      )}
      {deal.status === "completed" && (
        <TransferStatus
          dealId={deal.id}
          userId={user.id}
          role="dealer"
          dueAt={deal.transfer_due_at}
          submittedAt={deal.transfer_submitted_at}
          docUrls={transferDocUrls}
        />
      )}
      {deal.status !== "cancelled" && <TransferGuide dealId={deal.id} role="dealer" />}

      <section className="flex flex-col gap-3">
        <h2 className="text-subtitle font-semibold">{t("claims")}</h2>
        {claims.length === 0 && <p className="text-caption text-ink/60">{t("noClaims")}</p>}
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} agreedPrice={deal.agreed_price} />
        ))}
        {/* 감가는 현장 점검표에 문제 항목을 표시해야 청구할 수 있다 (DB 규칙과 같음) */}
        {deal.status === "scheduled" &&
          (hasIssue ? (
            <ClaimForm dealId={deal.id} userId={user.id} agreedPrice={deal.agreed_price} />
          ) : (
            <p className="text-caption text-ink/60">{t("claimNeedsInspection")}</p>
          ))}
        {deal.status === "depreciation_review" && <p className="text-caption text-ink/60">{t("underReview")}</p>}
      </section>

      {deal.status === "cancelled" && deal.cancel_reason && (
        <p className="rounded-xl bg-white p-4 text-caption text-ink/70 shadow-sm">
          {t("cancelledReason")}: {t(`reasons.${deal.cancel_reason}` as Parameters<typeof t>[0])}
        </p>
      )}
      {active && <DealerCancelButton dealId={deal.id} />}
      <ReportButton dealId={deal.id} />
    </div>
  );
}
