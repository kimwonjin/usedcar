import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuctionInterest } from "@/components/auction-interest";
import { AuctionQa } from "@/components/auction-qa";
import { MarketReference, type MarketEstimate } from "@/components/market-reference";
import { PageHeader } from "@/components/page-header";
import { SaleProgress } from "@/components/sale-progress";
import { PriceChart, type BidEvent } from "@/components/price-chart";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { decisionDeadline } from "@/lib/auction-rules";
import { getCurrentUser } from "@/lib/auth";
import type { DamageMap, FrameDamage } from "@/lib/car-catalog";
import { currentDeal } from "@/lib/supabase/rows";
import { loadDealerDepreciation, loadDealerGrades } from "@/lib/dealer-grades";
import { createClient } from "@/lib/supabase/server";
import { LiveAuction } from "./live-auction";
import { LiveEdits } from "./live-edits";
import { RelistButton } from "./relist-button";
import { ResultPicker, type TopBid } from "./result-picker";

type SellerAuctionDetail = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  car_id: string;
  seller_id: string;
  cars: { make: string; model: string; year: number; desired_price: number | null; defects: string | null; damage: DamageMap | null; frame_damage: FrameDamage | null };
  deals: DealRef | DealRef[] | null;
};

type DealRef = { id: string; status: string; created_at: string };

// S6 경매 진행 중 / S7 경매 결과
export default async function SellerAuctionPage({ params }: PageProps<"/[locale]/sell/auctions/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("sellerAuction");

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/sell", locale });

  const supabase = await createClient();
  const { data: auction } = await supabase
    .from("auctions")
    .select("id, status, starts_at, ends_at, car_id, seller_id, cars(make, model, year, desired_price, defects, damage, frame_damage), deals(id, status, created_at)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<SellerAuctionDetail, { merge: false }>();
  if (!auction || auction.seller_id !== user.id) notFound();
  const car = auction.cars;

  // 최고가 그래프용 입찰 기록 (판매자만 읽을 수 있다)
  const loadEvents = async () => {
    const { data } = await supabase.from("bid_events").select("amount, created_at").eq("auction_id", id).order("created_at");
    return (data ?? []) as BidEvent[];
  };

  // 관심도 (판매자 본인만 읽힌다)
  const loadInterest = async () => {
    const { data } = await supabase.rpc("auction_interest", { p_auction_id: id });
    return ((data ?? [])[0] ?? { viewers: 0, favorites: 0 }) as { viewers: number; favorites: number };
  };

  // 비슷한 차 평균 낙찰가 (판매 결정 참고용)
  const loadEstimate = async () => {
    const { data } = await supabase.rpc("estimate_price", { p_make: car.make, p_model: car.model, p_year: car.year });
    return ((data ?? [])[0] ?? null) as MarketEstimate | null;
  };

  let body: React.ReactNode;
  if (auction.status === "live") {
    const [{ data: stats }, events, interest, estimate] = await Promise.all([
      supabase.rpc("auction_stats", { p_auction_id: id }),
      loadEvents(),
      loadInterest(),
      loadEstimate(),
    ]);
    const initial = (stats?.[0] ?? { bid_count: 0, top_amount: null }) as { bid_count: number; top_amount: number | null };
    body = (
      <>
        <LiveAuction
          auctionId={id}
          startsAt={auction.starts_at}
          endsAt={auction.ends_at}
          initial={initial}
          initialEvents={events}
          desiredPrice={car.desired_price}
        />
        <MarketReference estimate={estimate} />
        <AuctionInterest viewers={interest.viewers} favorites={interest.favorites} />
        <AuctionQa auctionId={id} role="seller" canAnswer />
        <LiveEdits carId={auction.car_id} userId={user.id} defects={car.defects} damage={car.damage ?? {}} frameDamage={car.frame_damage ?? {}} />
      </>
    );
  } else if (auction.status === "ended") {
    const [{ data: top }, events, estimate] = await Promise.all([
      supabase.rpc("auction_top_bids", { p_auction_id: id }),
      loadEvents(),
      loadEstimate(),
    ]);
    const topIds = ((top ?? []) as TopBid[]).map((b) => b.dealer_id);
    const [grades, depreciation] = await Promise.all([
      loadDealerGrades(supabase, topIds),
      loadDealerDepreciation(supabase, topIds),
    ]);
    body = (
      <>
        <PriceChart events={events} startAt={auction.starts_at} endAt={auction.ends_at} />
        <ResultPicker
        auctionId={id}
        bids={(top ?? []) as TopBid[]}
        desiredPrice={car.desired_price}
        estimate={estimate}
        deadline={decisionDeadline(auction.ends_at)}
        grades={grades}
        depreciation={depreciation}
        />
      </>
    );
  } else if (auction.status === "accepted") {
    body = (
      <Link
        href={`/sell/deals/${currentDeal(auction.deals)?.id}`}
        className="flex h-14 items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white"
      >
        {t("goToDeal")}
      </Link>
    );
  } else {
    // 다시 올리기 전 참고: 지난 경매 최고 입찰가·입찰 수, 비슷한 차 시세
    const [interest, estimate, { data: bidRows }, { data: reviewSetting }, { data: carReview }] = await Promise.all([
      loadInterest(),
      loadEstimate(),
      supabase.from("bids").select("amount").eq("auction_id", id),
      supabase.from("app_settings").select("value").eq("key", "auction_review").maybeSingle(),
      supabase.from("cars").select("review_status").eq("id", auction.car_id).maybeSingle(),
    ]);
    const amounts = ((bidRows ?? []) as { amount: number }[]).map((b) => b.amount);
    body = (
      <>
        <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <p className="text-body">{t(`closedMessage.${auction.status}` as Parameters<typeof t>[0])}</p>
          {/* 다시 신청해서 검수 중이면 버튼 대신 안내 */}
          {carReview?.review_status === "pending" ? (
            <p className="rounded-lg bg-steppe/10 p-3 text-body text-navy">⏳ {t("relistPending")}</p>
          ) : (
            <RelistButton
              carId={auction.car_id}
              topBid={amounts.length ? Math.max(...amounts) : null}
              bidCount={amounts.length}
              desiredPrice={car.desired_price}
              marketAvg={estimate && estimate.sample > 0 ? estimate.avg_price : null}
              reviewOn={(reviewSetting?.value ?? "on") === "on"}
            />
          )}
        </div>
        <AuctionInterest
          viewers={interest.viewers}
          favorites={interest.favorites}
          tip={auction.status === "no_bids" ? "noBids" : null}
        />
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader title={`${car.make} ${car.model} · ${car.year}`} backHref="/sell" backLabel={t("back")}>
        <StatusBadge kind="auction" status={auction.status} />
      </PageHeader>
      {(auction.status === "live" || auction.status === "ended") && (
        <SaleProgress current={auction.status === "live" ? "auction" : "decision"} />
      )}
      {body}
    </div>
  );
}
