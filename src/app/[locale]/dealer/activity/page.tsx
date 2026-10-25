import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { BidBlockNotice } from "@/components/bid-block-notice";
import { ReviewList, type DealerReview } from "@/components/dealer-profile";
import { DealerTabs } from "@/components/dealer-tabs";
import { Stars } from "@/components/stars";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { getDealer, getUserId } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { dealerFee, loadFeeBands } from "@/lib/fees";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type MyBid = {
  id: string;
  amount: number;
  auction_id: string;
  auctions: {
    status: string;
    ends_at: string;
    winning_bid_id: string | null;
    cars: { make: string; model: string; year: number };
  };
};

type MyDeal = {
  id: string;
  status: string;
  agreed_price: number;
  final_price: number | null;
  auctions: { cars: { make: string; model: string; year: number } };
};

// D6 내 활동: 입찰 내역, 낙찰·거래 내역, 수수료, 평판
export default async function DealerActivity({ params }: PageProps<"/[locale]/dealer/activity">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("activity");

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login?next=/dealer", locale });

  // 서로 관계없는 조회는 한 번에 보낸다
  const supabase = await createClient();
  const [dealer, feeBands, { data: penaltyRows }, { data: bidRows }, { data: dealRows }, tp, { data: reviewRows }, tr] = await Promise.all([
    getDealer(userId),
    loadFeeBands(supabase),
    supabase
      .from("dealer_penalties")
      .select("id, reason, action, created_at")
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bids")
      // auctions.winning_bid_id도 bids를 가리켜서 관계 이름을 지정해야 한다
      .select("id, amount, auction_id, auctions!bids_auction_id_fkey(status, ends_at, winning_bid_id, cars(make, model, year))")
      .eq("dealer_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50)
      .overrideTypes<MyBid[], { merge: false }>(),
    supabase
      .from("deals")
      .select("id, status, agreed_price, final_price, auctions(cars(make, model, year))")
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<MyDeal[], { merge: false }>(),
    getTranslations("penalty"),
    supabase.rpc("dealer_reviews", { p_dealer_id: userId, p_limit: 10 }),
    getTranslations("dealerProfile"),
  ]);
  if (!dealer) return redirect({ href: "/dealer/apply", locale });
  const penalties = (penaltyRows ?? []) as { id: string; reason: string; action: string; created_at: string }[];
  const blockedUntil =
    dealer.bid_blocked_until && new Date(dealer.bid_blocked_until) > new Date() ? dealer.bid_blocked_until : null;
  const bids = bidRows ?? [];
  const deals = dealRows ?? [];

  const liveBids = bids.filter((b) => b.auctions.status === "live");
  const ranks = await Promise.all(
    liveBids.map((b) => supabase.rpc("my_bid_rank", { p_auction_id: b.auction_id }).then(({ data }) => data as number)),
  );
  const rankOf = new Map(liveBids.map((b, i) => [b.id, ranks[i]]));

  const completed = deals.filter((d) => d.status === "completed");

  // 입찰 성과 (최근 입찰 50건 기준): 결과가 난 경매 중 낙찰 비율, 낙찰가 평균
  const decided = bids.filter((b) => !["live", "ended"].includes(b.auctions.status));
  const wonBids = decided.filter((b) => b.auctions.winning_bid_id === b.id);
  const winRate = decided.length ? Math.round((wonBids.length / decided.length) * 100) : null;
  const avgWon = wonBids.length ? wonBids.reduce((sum, b) => sum + b.amount, 0) / wonBids.length : null;
  const totalFees = completed.reduce((sum, d) => sum + dealerFee(d.final_price ?? d.agreed_price, feeBands), 0);

  const bidResult = (bid: MyBid) => {
    if (bid.auctions.status === "live") return <Badge tone="review">{t("rank", { rank: rankOf.get(bid.id) ?? "-" })}</Badge>;
    if (bid.auctions.winning_bid_id === bid.id) return <Badge tone="gold">{t("won")}</Badge>;
    if (bid.auctions.status === "ended") return <Badge tone="warning">{t("waiting")}</Badge>;
    return <Badge tone="neutral">{t("lost")}</Badge>;
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <DealerTabs />

      {blockedUntil && <BidBlockNotice until={blockedUntil} />}

      <section className="grid grid-cols-3 gap-2">
        <Stat label={t("rating")}>
          <Stars rating={dealer.rating} />
        </Stat>
        <Stat label={t("completedDeals")}>
          <span className="price text-title font-bold">{completed.length}</span>
        </Stat>
        <Stat label={t("warnings")}>
          <span className={`price text-title font-bold ${dealer.warning_count ? "text-danger" : ""}`}>
            {dealer.warning_count}
          </span>
        </Stat>
      </section>

      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-subtitle font-semibold">{t("performance")}</h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-caption text-ink/60">{t("bidCount")}</dt>
            <dd className="price text-title font-bold">{bids.length}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink/60">{t("winRate")}</dt>
            <dd className="price text-title font-bold">{winRate === null ? "—" : `${winRate}%`}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink/60">{t("avgWon")}</dt>
            <dd className="price text-body font-bold">{avgWon === null ? "—" : formatTenge(avgWon)}</dd>
          </div>
        </dl>
        <p className="text-caption text-ink/50">{t("performanceHint", { won: wonBids.length, decided: decided.length })}</p>
      </section>

      {penalties.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-subtitle font-semibold">{tp("historyTitle")}</h2>
          <p className="text-caption text-ink/60">{tp("ladder")}</p>
          <ul className="flex flex-col gap-1 text-caption">
            {penalties.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {tp(`reasons.${p.reason}` as Parameters<typeof tp>[0])} → <b>{tp(`actions.${p.action}` as Parameters<typeof tp>[0])}</b>
                </span>
                <span className="shrink-0 text-ink/50">{formatDateTime(p.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col rounded-xl bg-white px-4 pt-4 pb-1 shadow-sm">
        <h2 className="text-subtitle font-semibold">{tr("myReviews")}</h2>
        <ReviewList reviews={(reviewRows ?? []) as DealerReview[]} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-subtitle font-semibold">{t("deals")}</h2>
        {deals.length === 0 && <p className="text-caption text-ink/60">{t("noDeals")}</p>}
        {deals.map((deal) => {
          const price = deal.final_price ?? deal.agreed_price;
          return (
            <Link key={deal.id} href={`/dealer/deals/${deal.id}`} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">
                  {deal.auctions.cars.make} {deal.auctions.cars.model} · {deal.auctions.cars.year}
                </p>
                <p className="price text-caption text-ink/60">
                  {formatTenge(price)} · {t("fee")} {formatTenge(dealerFee(price, feeBands))}
                </p>
              </div>
              <StatusBadge kind="deal" status={deal.status} />
            </Link>
          );
        })}
        {completed.length > 0 && (
          <p className="text-right text-caption text-ink/60">
            {t("totalFees")} <span className="price font-semibold text-ink">{formatTenge(totalFees)}</span>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-subtitle font-semibold">{t("bids")}</h2>
        {bids.length === 0 && <p className="text-caption text-ink/60">{t("noBids")}</p>}
        <ul className="divide-y divide-ink/10 rounded-xl bg-white">
          {bids.map((bid) => (
            <li key={bid.id}>
              <Link href={`/dealer/auctions/${bid.auction_id}`} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-body">
                    {bid.auctions.cars.make} {bid.auctions.cars.model} · {bid.auctions.cars.year}
                  </p>
                  <p className="price text-caption text-ink/60">{formatTenge(bid.amount)}</p>
                </div>
                {bidResult(bid)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <p className="text-caption leading-tight hyphens-auto text-ink/60 [overflow-wrap:anywhere]">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
