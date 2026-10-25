import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { decisionDeadline } from "@/lib/auction-rules";
import { getCurrentUser } from "@/lib/auth";
import { firstRow } from "@/lib/supabase/rows";
import { createClient } from "@/lib/supabase/server";
import { LiveAuction } from "./live-auction";
import { RelistButton } from "./relist-button";
import { ResultPicker, type TopBid } from "./result-picker";

type SellerAuctionDetail = {
  id: string;
  status: string;
  ends_at: string;
  car_id: string;
  seller_id: string;
  cars: { make: string; model: string; year: number; desired_price: number | null };
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
    .select("id, status, ends_at, car_id, seller_id, cars(make, model, year, desired_price), deals(id)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<SellerAuctionDetail, { merge: false }>();
  if (!auction || auction.seller_id !== user.id) notFound();
  const car = auction.cars;

  let body: React.ReactNode;
  if (auction.status === "live") {
    const { data: stats } = await supabase.rpc("auction_stats", { p_auction_id: id });
    const initial = (stats?.[0] ?? { bid_count: 0, top_amount: null }) as { bid_count: number; top_amount: number | null };
    body = <LiveAuction auctionId={id} endsAt={auction.ends_at} initial={initial} desiredPrice={car.desired_price} />;
  } else if (auction.status === "ended") {
    const { data: top } = await supabase.rpc("auction_top_bids", { p_auction_id: id });
    body = (
      <ResultPicker
        auctionId={id}
        bids={(top ?? []) as TopBid[]}
        desiredPrice={car.desired_price}
        deadline={decisionDeadline(auction.ends_at)}
      />
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
    body = (
      <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
        <p className="text-body">{t(`closedMessage.${auction.status}` as Parameters<typeof t>[0])}</p>
        <RelistButton carId={auction.car_id} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader title={`${car.make} ${car.model} · ${car.year}`} backHref="/sell" backLabel={t("back")}>
        <StatusBadge kind="auction" status={auction.status} />
      </PageHeader>
      {body}
    </div>
  );
}
