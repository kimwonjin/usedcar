import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { AuctionQa } from "@/components/auction-qa";
import { BidBlockNotice } from "@/components/bid-block-notice";
import { ConditionSummary, type CarCondition } from "@/components/condition-summary";
import { Countdown } from "@/components/countdown";
import { FavoriteButton } from "@/components/favorite-button";
import { PageHeader } from "@/components/page-header";
import { PhotoGallery } from "@/components/photo-gallery";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { getDealer, getUserId } from "@/lib/auth";
import { PHOTO_SLOTS } from "@/lib/car-catalog";
import { formatKm, formatTenge } from "@/lib/format";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { BidPanel } from "./bid-panel";

type AuctionDetail = {
  id: string;
  seller_id: string;
  status: string;
  ends_at: string;
  winning_bid_id: string | null;
  cars: CarCondition & {
    make: string;
    model: string;
    year: number;
    mileage_km: number;
    fuel: string | null;
    transmission: string | null;
    steering: string;
    customs_cleared: boolean;
    body_type: string | null;
    color: string | null;
    engine_volume: number | null;
    vin: string | null;
    owner_verified_at: string | null;
    defects: string | null;
    car_photos: { slot: string; storage_path: string; sort_order: number }[];
  };
};

// D3 차량 상세 + D4 입찰하기
export default async function DealerAuctionDetail({ params }: PageProps<"/[locale]/dealer/auctions/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("auctionDetail");
  const tf = await getTranslations("carForm");
  const tb = await getTranslations("bid");

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login?next=/dealer", locale });

  // 서로 관계없는 조회는 한 번에 보낸다
  const supabase = await createClient();
  const [{ data: auction }, { data: stats }, { data: rank }, { data: myBid }, { data: deal }, dealer, { data: fav }] =
    await Promise.all([
      supabase
        .from("auctions")
        .select(
          "id, seller_id, status, ends_at, winning_bid_id, cars(make, model, year, mileage_km, fuel, transmission, steering, customs_cleared, body_type, color, engine_volume, vin, owner_verified_at, defects, options, accident, owners, damage, frame_damage, spare_key, tire_state, wheel_scratches, panel_scratches, repair_needed, pros, car_photos(slot, storage_path, sort_order))",
        )
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<AuctionDetail, { merge: false }>(),
      supabase.rpc("auction_stats", { p_auction_id: id }),
      supabase.rpc("my_bid_rank", { p_auction_id: id }),
      supabase.from("bids").select("id, amount").eq("auction_id", id).eq("dealer_id", userId).maybeSingle(),
      supabase.from("deals").select("id").eq("auction_id", id).eq("dealer_id", userId).maybeSingle(),
      getDealer(userId),
      supabase.from("dealer_favorites").select("auction_id").eq("dealer_id", userId).eq("auction_id", id).maybeSingle(),
      // 판매자에게 보여줄 "본 딜러 수" 기록 (진행 중 경매·승인 딜러만 DB에서 반영)
      supabase.rpc("record_auction_view", { p_auction_id: id }),
    ]);
  if (!auction) notFound();

  const car = auction.cars;
  const photos = [...car.car_photos].sort(
    (a, b) =>
      PHOTO_SLOTS.indexOf(a.slot as (typeof PHOTO_SLOTS)[number]) -
        PHOTO_SLOTS.indexOf(b.slot as (typeof PHOTO_SLOTS)[number]) || a.sort_order - b.sort_order,
  );

  const urls = await signedUrlMap(supabase, "car-photos", photos.map((p) => p.storage_path));
  const blockedUntil =
    dealer?.bid_blocked_until && new Date(dealer.bid_blocked_until) > new Date() ? dealer.bid_blocked_until : null;
  const bidCount = (stats?.[0]?.bid_count as number | undefined) ?? 0;
  const isLive = auction.status === "live";
  const own = auction.seller_id === userId; // 딜러가 판매자로 올린 자기 차
  const approved = dealer?.status === "approved";
  // 다른 딜러에게 팔린 경매: 낙찰가와 내 순위 (다음 입찰 참고용)
  const result =
    auction.status === "accepted" && myBid && !deal
      ? ((await supabase.rpc("auction_result", { p_auction_id: id })).data?.[0] as
          | { winning_amount: number; my_amount: number; my_rank: number; bidders: number }
          | undefined)
      : undefined;

  const specs: [string, string][] = [
    [t("year"), String(car.year)],
    [t("mileage"), formatKm(car.mileage_km)],
    [tf("details.fuel"), car.fuel ? tf(`fuel.${car.fuel}` as Parameters<typeof tf>[0]) : "—"],
    [
      tf("details.transmission"),
      car.transmission ? tf(`transmission.${car.transmission}` as Parameters<typeof tf>[0]) : "—",
    ],
    [tf("details.steering"), tf(`steering.${car.steering}` as Parameters<typeof tf>[0])],
    [tf("details.customs"), tf(car.customs_cleared ? "customs.yes" : "customs.no")],
    [tf("specs.bodyType"), car.body_type ? tf(`bodyType.${car.body_type}` as Parameters<typeof tf>[0]) : "—"],
    [tf("specs.color"), car.color ? tf(`color.${car.color}` as Parameters<typeof tf>[0]) : "—"],
    [tf("specs.engineShort"), car.engine_volume ? `${Number(car.engine_volume).toFixed(1)} L` : "—"],
    ["VIN", car.vin ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader title={`${car.make} ${car.model}`} backHref="/dealer" backLabel={t("backToList")}>
        <div className="flex items-center gap-2">
          {car.owner_verified_at && <Badge tone="verified">✓ {t("ownerVerified")}</Badge>}
          {isLive && !own && <FavoriteButton auctionId={id} dealerId={userId} initial={Boolean(fav)} className="border border-ink/10" />}
          <StatusBadge kind="auction" status={auction.status} />
        </div>
      </PageHeader>

      <PhotoGallery
        photos={photos
          .filter((p) => urls[p.storage_path])
          .map((p) => ({
            url: urls[p.storage_path],
            label: tf(`slots.${p.slot}.label` as Parameters<typeof tf>[0]),
          }))}
      />

      <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-caption text-ink/60">{t("timeLeft")}</p>
          <p className="text-title font-bold">
            {isLive ? <Countdown endsAt={auction.ends_at} /> : t("closed")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-caption text-ink/60">{t("bidders")}</p>
          <p className="price text-title font-bold">{bidCount}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-ink/10">
        {specs.map(([label, value]) => (
          <div key={label} className="bg-white p-3">
            <dt className="text-caption text-ink/60">{label}</dt>
            <dd className="text-body font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <ConditionSummary condition={car} />

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-subtitle font-semibold">{t("sellerDefects")}</h2>
        <p className="text-body whitespace-pre-line">{car.defects || tf("defects.none")}</p>
      </section>

      <AuctionQa auctionId={id} role="dealer" canAsk={isLive && !own && dealer?.status === "approved"} />

      {isLive && own && <p className="rounded-xl bg-white p-4 text-body text-ink/70 shadow-sm">{tb("ownAuction")}</p>}
      {/* 판매자·관리자·심사 중인 딜러로 들어온 경우: 입찰 칸 대신 이유를 알려 준다 */}
      {isLive && !own && !approved && (
        <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-body font-semibold">{tb(dealer ? "notApproved" : "notDealer")}</p>
          {!dealer && (
            <Link href="/dealer/apply" className="text-body font-semibold text-steppe">
              {tb("applyLink")} →
            </Link>
          )}
        </section>
      )}
      {isLive && !own && approved && blockedUntil && <BidBlockNotice until={blockedUntil} />}
      {isLive && !own && approved && !blockedUntil && (
        <BidPanel
          auctionId={id}
          myAmount={(myBid?.amount as number | undefined) ?? null}
          rank={(rank as number | null) ?? null}
        />
      )}

      {!isLive && myBid && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-caption text-ink/60">{t("myFinalBid")}</p>
          <p className="price text-title font-bold">{formatTenge(myBid.amount as number)}</p>
          {deal ? (
            <Link href={`/dealer/deals/${deal.id}`} className="mt-3 block">
              <Badge tone="gold">{t("won")}</Badge>
              <span className="ml-2 text-body font-semibold text-steppe">{t("goToDeal")} →</span>
            </Link>
          ) : result ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-body font-semibold">{t("soldToOther")}</p>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface p-2">
                  <dt className="text-caption text-ink/60">{t("soldPrice")}</dt>
                  <dd className="price text-body font-bold">{formatTenge(result.winning_amount)}</dd>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <dt className="text-caption text-ink/60">{t("myRank")}</dt>
                  <dd className="price text-body font-bold">{t("rankOf", { rank: result.my_rank, count: result.bidders })}</dd>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <dt className="text-caption text-ink/60">{t("gap")}</dt>
                  <dd className={`price text-body font-bold ${result.my_amount < result.winning_amount ? "text-danger" : "text-steppe"}`}>
                    {result.my_amount < result.winning_amount ? "−" : "+"}
                    {formatTenge(Math.abs(result.winning_amount - result.my_amount))}
                  </dd>
                </div>
              </dl>
              <p className="text-caption text-ink/60">
                {result.my_amount >= result.winning_amount ? t("pickedOther") : t("gapHint")}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-body text-ink/70">
              {auction.status === "ended" ? t("waitingSeller") : t("notWon")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
