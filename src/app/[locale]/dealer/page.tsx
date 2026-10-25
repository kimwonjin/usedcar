import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/badge";
import { Countdown } from "@/components/countdown";
import { DealerTabs } from "@/components/dealer-tabs";
import { SetupNotice } from "@/components/setup-notice";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser, getDealer } from "@/lib/auth";
import { formatKm, formatTenge } from "@/lib/format";
import { signedUrlMap } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type LiveAuction = {
  id: string;
  ends_at: string;
  created_at: string;
  cars: {
    make: string;
    model: string;
    year: number;
    mileage_km: number;
    steering: string;
    car_photos: { slot: string; storage_path: string }[];
  };
};

const SORTS = ["ending", "newest"] as const;

// D2 딜러 경매 목록: 카드마다 사진·차량명·연식·주행거리·남은 시간·내 입찰을 같은 자리에
export default async function DealerAuctions({ params, searchParams }: PageProps<"/[locale]/dealer">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("dealer");
  if (!isSupabaseConfigured) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/dealer", locale });

  if (user.role !== "admin") {
    const dealer = await getDealer(user.id);
    if (!dealer) return redirect({ href: "/dealer/apply", locale });
    if (dealer.status !== "approved") return <DealerStatusCard status={dealer.status} reason={dealer.rejection_reason} />;
  }

  const query = await searchParams;
  const make = typeof query.make === "string" ? query.make : null;
  const sort = SORTS.find((s) => s === query.sort) ?? "ending";

  const supabase = await createClient();
  const { data } = await supabase
    .from("auctions")
    .select("id, ends_at, created_at, cars(make, model, year, mileage_km, steering, car_photos(slot, storage_path))")
    .eq("status", "live")
    .gt("ends_at", new Date().toISOString())
    .order(sort === "ending" ? "ends_at" : "created_at", { ascending: sort === "ending" })
    .overrideTypes<LiveAuction[], { merge: false }>();
  const all = data ?? [];
  const auctions = make ? all.filter((a) => a.cars.make === make) : all;
  const makes = [...new Set(all.map((a) => a.cars.make))].sort();
  const ids = auctions.map((a) => a.id);

  const [{ data: myBids }, { data: counts }, thumbs] = await Promise.all([
    supabase.from("bids").select("auction_id, amount").eq("dealer_id", user.id).in("auction_id", ids),
    supabase.rpc("auction_bid_counts", { p_auction_ids: ids }),
    signedUrlMap(
      supabase,
      "car-photos",
      auctions.flatMap((a) => a.cars.car_photos.filter((p) => p.slot === "front").map((p) => p.storage_path)),
    ),
  ]);
  const myBid = new Map((myBids ?? []).map((b) => [b.auction_id as string, b.amount as number]));
  const bidCount = new Map(
    ((counts ?? []) as { auction_id: string; bid_count: number }[]).map((c) => [c.auction_id, c.bid_count]),
  );

  const filterHref = (next: { make?: string | null; sort?: string }) => {
    const params = new URLSearchParams();
    const m = next.make === undefined ? make : next.make;
    if (m) params.set("make", m);
    params.set("sort", next.sort ?? sort);
    return `/dealer?${params}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <DealerTabs />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip href={filterHref({ make: null })} active={!make}>
          {t("allMakes")} {all.length}
        </FilterChip>
        {makes.map((m) => (
          <FilterChip key={m} href={filterHref({ make: m })} active={make === m}>
            {m}
          </FilterChip>
        ))}
      </div>
      <div className="flex gap-3 text-caption">
        {SORTS.map((s) => (
          <Link key={s} href={filterHref({ sort: s })} className={s === sort ? "font-bold text-navy" : "text-ink/50"}>
            {t(`sort.${s}`)}
          </Link>
        ))}
      </div>

      {auctions.length === 0 && <p className="py-8 text-center text-ink/60">{t("empty")}</p>}
      <ul className="flex flex-col gap-2">
        {auctions.map((auction) => {
          const front = auction.cars.car_photos.find((p) => p.slot === "front");
          const thumb = front ? thumbs[front.storage_path] : undefined;
          const mine = myBid.get(auction.id);
          return (
            <li key={auction.id}>
              <Link href={`/dealer/auctions/${auction.id}`} className="flex gap-3 rounded-xl bg-white p-2 shadow-sm">
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-ink/5">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] content-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-subtitle font-semibold">
                    {auction.cars.make} {auction.cars.model}
                  </span>
                  <Countdown endsAt={auction.ends_at} />
                  <span className="truncate text-caption text-ink/60">
                    {t("year", { year: auction.cars.year })} · {formatKm(auction.cars.mileage_km)}
                    {auction.cars.steering === "right" && " · RHD"}
                  </span>
                  <span className="text-caption text-ink/60">
                    {t("bidders", { count: bidCount.get(auction.id) ?? 0 })}
                  </span>
                  <span className="col-span-2 text-caption">
                    {mine ? (
                      <Badge tone="review">
                        {t("myBid")} <span className="price ml-1">{formatTenge(mine)}</span>
                      </Badge>
                    ) : (
                      <span className="text-ink/40">{t("notBidYet")}</span>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-caption font-semibold ${
        active ? "border-navy bg-navy text-white" : "border-ink/15 bg-white text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

async function DealerStatusCard({ status, reason }: { status: string; reason: string | null }) {
  const t = await getTranslations("dealer");
  return (
    <div className="flex flex-col gap-4 pt-4">
      <h1 className="text-title font-bold text-navy">{t("statusTitle")}</h1>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        {status === "pending" && (
          <>
            <Badge tone="warning">{t("statusPending")}</Badge>
            <p className="mt-3 text-body">{t("pending")}</p>
          </>
        )}
        {status === "rejected" && (
          <>
            <Badge tone="warning">{t("statusRejected")}</Badge>
            {reason && <p className="mt-3 text-body">{reason}</p>}
            <Link href="/dealer/apply" className="mt-4 block text-body font-semibold text-steppe">
              {t("editApplication")} →
            </Link>
          </>
        )}
        {status === "suspended" && (
          <>
            <Badge tone="warning">{t("statusSuspended")}</Badge>
            <p className="mt-3 text-body">{t("suspended")}</p>
          </>
        )}
      </div>
    </div>
  );
}
