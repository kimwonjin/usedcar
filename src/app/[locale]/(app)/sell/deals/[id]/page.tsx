import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { ClaimCard } from "@/components/deal/claim-card";
import { InspectionView } from "@/components/deal/inspection";
import { DealChat } from "@/components/deal/deal-chat";
import { ReportButton } from "@/components/deal/report-button";
import { ShareSale } from "@/components/deal/share-sale";
import { MeetingForm } from "@/components/deal/meeting-form";
import { TransferGuide } from "@/components/deal/transfer-guide";
import { TransferStatus } from "@/components/deal/transfer-status";
import { PageHeader } from "@/components/page-header";
import { SaleProgress } from "@/components/sale-progress";
import { Stars } from "@/components/stars";
import { StatusBadge } from "@/components/status-badge";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadDeal } from "@/lib/deals";
import { formatTenge } from "@/lib/format";
import { ClaimComment, DealActions, RatingForm } from "./deal-actions";
import { ReassignPicker } from "./reassign-picker";
import type { TopBid } from "../../auctions/[id]/result-picker";
import { Link } from "@/i18n/navigation";
import { currentDeal } from "@/lib/supabase/rows";

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
  const { deal, claims, supabase, messages, transferDocUrls, inspection } = loaded;
  const car = deal.auctions.cars;

  const { data: dealer } = await supabase
    .from("dealers")
    .select("business_name, rating, address")
    .eq("id", deal.dealer_id)
    .maybeSingle();
  const active = deal.status === "scheduled" || deal.status === "depreciation_review";
  const approvedDeduction = claims.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.amount, 0);
  const expected = deal.agreed_price - approvedDeduction;
  // 낙찰 딜러 사정으로 취소된 거래: 차순위 딜러에게 넘겼으면 새 거래로 안내, 아직이면 경매 종료 7일 안에 다시 고르게 한다
  const reassign = await loadReassign();
  async function loadReassign() {
    if (deal.status !== "cancelled" || !["dealer_no_show", "dealer_cancelled"].includes(deal.cancel_reason ?? "")) return null;
    const { data: auction } = await supabase
      .from("auctions")
      .select("status, ends_at, deals(id, status, created_at)")
      .eq("id", deal.auction_id)
      .maybeSingle()
      .overrideTypes<{ status: string; ends_at: string; deals: { id: string; status: string; created_at: string }[] }, { merge: false }>();
    if (!auction || auction.status !== "accepted") return null;
    const latest = currentDeal(auction.deals);
    if (latest && latest.id !== deal.id) return { kind: "moved" as const, nextDealId: latest.id };
    const until = new Date(new Date(auction.ends_at).getTime() + 7 * 24 * 3600 * 1000).toISOString();
    if (until < new Date().toISOString()) return null;
    const { data: bids } = await supabase.rpc("reassign_candidates", { p_auction_id: deal.auction_id });
    return { kind: "pick" as const, until, bids: (bids ?? []) as TopBid[] };
  }

  // 판매 결과 공유 카드에 넣을 경쟁 딜러 수
  const [bidders, refCode] =
    deal.status === "completed"
      ? await Promise.all([
          supabase
            .from("bids")
            .select("id", { count: "exact", head: true })
            .eq("auction_id", deal.auction_id)
            .then(({ count }) => count ?? 0),
          supabase
            .from("profiles")
            .select("referral_code")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data }) => (data?.referral_code as string | null) ?? null),
        ])
      : [0, null];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title={`${car.make} ${car.model} · ${car.year}`} backHref="/sell" backLabel={t("backToHome")}>
        <StatusBadge kind="deal" status={deal.status} />
      </PageHeader>
      {deal.status !== "cancelled" && (
        <SaleProgress
          current={deal.status !== "completed" ? "handover" : deal.transfer_submitted_at ? "done" : "transfer"}
        />
      )}

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
          </div>
          {dealer?.address && <p className="truncate text-caption text-ink/60">{dealer.address}</p>}
        </div>
      </section>

      <DealChat
        dealId={deal.id}
        myId={user.id}
        counterpartName={dealer?.business_name ?? ""}
        initialMessages={messages}
        open={deal.status !== "cancelled"}
        notificationUrl={`/sell/deals/${deal.id}`}
      />

      {active && (
        <ol className="flex flex-col gap-1 rounded-xl bg-white p-4 text-caption text-ink/70 shadow-sm">
          <li>1. {t("step1")}</li>
          <li>2. {t("step2")}</li>
          <li className="font-semibold text-danger">3. {t("step3")}</li>
          <li>4. {t("step4")}</li>
        </ol>
      )}

      <MeetingForm dealId={deal.id} meetingAt={deal.meeting_at} meetingPlace={deal.meeting_place} editable={active} />
      {inspection && <InspectionView inspection={inspection} />}
      {deal.status === "completed" && (
        <TransferStatus
          dealId={deal.id}
          userId={user.id}
          role="seller"
          dueAt={deal.transfer_due_at}
          submittedAt={deal.transfer_submitted_at}
          docUrls={transferDocUrls}
        />
      )}
      {deal.status !== "cancelled" && <TransferGuide dealId={deal.id} role="seller" />}

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

      {deal.status === "cancelled" && deal.cancel_reason && (
        <p className="rounded-xl bg-white p-4 text-caption text-ink/70 shadow-sm">
          {t("cancelledReason")}: {t(`reasons.${deal.cancel_reason}` as Parameters<typeof t>[0])}
        </p>
      )}
      {deal.status === "completed" && (
        <ShareSale
          dealId={deal.id}
          car={`${car.make} ${car.model} ${car.year}`}
          price={formatTenge(deal.final_price ?? deal.agreed_price)}
          bidders={bidders}
          refCode={refCode}
        />
      )}
      {reassign?.kind === "moved" && (
        <Link
          href={`/sell/deals/${reassign.nextDealId}`}
          className="flex h-12 items-center justify-center rounded-xl bg-navy font-bold text-white"
        >
          {t("goToNextDeal")} →
        </Link>
      )}
      {reassign?.kind === "pick" && <ReassignPicker auctionId={deal.auction_id} bids={reassign.bids} until={reassign.until} />}
      <DealActions dealId={deal.id} status={deal.status} />
      <ReportButton dealId={deal.id} />
      {deal.status === "completed" && deal.seller_rating === null && <RatingForm dealId={deal.id} />}
      {deal.seller_rating !== null && (
        <p className="text-center text-caption text-ink/60">
          {t("rated")} <span className="text-gold">{"★".repeat(deal.seller_rating)}</span>
        </p>
      )}
    </div>
  );
}
