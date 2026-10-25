import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { BidBlockNotice } from "@/components/bid-block-notice";
import { Countdown } from "@/components/countdown";
import { FavoriteButton } from "@/components/favorite-button";
import { PageHeader } from "@/components/page-header";
import { PhotoGallery } from "@/components/photo-gallery";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser, getDealer } from "@/lib/auth";
import { PHOTO_SLOTS } from "@/lib/car-catalog";
import { formatKm, formatTenge } from "@/lib/format";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { BidPanel } from "./bid-panel";

type AuctionDetail = {
  id: string;
  status: string;
  ends_at: string;
  winning_bid_id: string | null;
  cars: {
    make: string;
    model: string;
    year: number;
    mileage_km: number;
    fuel: string | null;
    transmission: string | null;
    steering: string;
    customs_cleared: boolean;
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

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dealer", locale });

  const supabase = await createClient();
  const { data: auction } = await supabase
    .from("auctions")
    .select(
      "id, status, ends_at, winning_bid_id, cars(make, model, year, mileage_km, fuel, transmission, steering, customs_cleared, defects, car_photos(slot, storage_path, sort_order))",
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AuctionDetail, { merge: false }>();
  if (!auction) notFound();

  const car = auction.cars;
  const photos = [...car.car_photos].sort(
    (a, b) =>
      PHOTO_SLOTS.indexOf(a.slot as (typeof PHOTO_SLOTS)[number]) -
        PHOTO_SLOTS.indexOf(b.slot as (typeof PHOTO_SLOTS)[number]) || a.sort_order - b.sort_order,
  );

  const [urls, { data: stats }, { data: rank }, { data: myBid }, { data: deal }, dealer] = await Promise.all([
    signedUrlMap(supabase, "car-photos", photos.map((p) => p.storage_path)),
    supabase.rpc("auction_stats", { p_auction_id: id }),
    supabase.rpc("my_bid_rank", { p_auction_id: id }),
    supabase.from("bids").select("id, amount").eq("auction_id", id).eq("dealer_id", user.id).maybeSingle(),
    supabase.from("deals").select("id").eq("auction_id", id).eq("dealer_id", user.id).maybeSingle(),
    getDealer(user.id),
  ]);
  const { data: fav } = await supabase
    .from("dealer_favorites")
    .select("auction_id")
    .eq("dealer_id", user.id)
    .eq("auction_id", id)
    .maybeSingle();
  const blockedUntil =
    dealer?.bid_blocked_until && new Date(dealer.bid_blocked_until) > new Date() ? dealer.bid_blocked_until : null;
  const bidCount = (stats?.[0]?.bid_count as number | undefined) ?? 0;
  const isLive = auction.status === "live";

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
  ];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader title={`${car.make} ${car.model}`} backHref="/dealer" backLabel={t("backToList")}>
        <div className="flex items-center gap-2">
          {isLive && <FavoriteButton auctionId={id} dealerId={user.id} initial={Boolean(fav)} className="border border-ink/10" />}
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

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-subtitle font-semibold">{t("sellerDefects")}</h2>
        <p className="text-body whitespace-pre-line">{car.defects || tf("defects.none")}</p>
      </section>

      {isLive && blockedUntil && <BidBlockNotice until={blockedUntil} />}
      {isLive && !blockedUntil && (
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
