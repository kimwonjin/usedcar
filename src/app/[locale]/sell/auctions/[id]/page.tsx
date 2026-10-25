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
import type { DamageMap } from "@/lib/car-catalog";
import { firstRow } from "@/lib/supabase/rows";
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
  cars: { make: string; model: string; year: number; desired_price: number | null; defects: string | null; damage: DamageMap | null };
  deals: { id: string } | { id: string }[] | null;
};

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
    .select("id, status, starts_at, ends_at, car_id, seller_id, cars(make, model, year, desired_price, defects, damage), deals(id)")
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
        <LiveEdits carId={auction.car_id} userId={user.id} defects={car.defects} damage={car.damage ?? {}} />
      </>
    );
  } else if (auction.status === "ended") {
    const [{ data: top }, events, estimate] = await Promise.all([
      supabase.rpc("auction_top_bids", { p_auction_id: id }),
      loadEvents(),
      loadEstimate(),
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
        />
      </>
    );
  } else if (auction.status === "accepted") {
    body = (
      <Link
        href={`/sell/deals/${firstRow(auction.deals)?.id}`}
        className="flex h-14 items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white"
      >
        {t("goToDeal")}
      </Link>
    );
  } else {
    const interest = await loadInterest();
    body = (
      <>
        <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
          <p className="text-body">{t(`closedMessage.${auction.status}` as Parameters<typeof t>[0])}</p>
          <RelistButton carId={auction.car_id} />
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
