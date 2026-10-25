import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/countdown";
import { InstallPrompt } from "@/components/install-prompt";
import { PushToggle } from "@/components/push-toggle";
import { SetupNotice } from "@/components/setup-notice";
import { StatusBadge } from "@/components/status-badge";
import { Link, redirect } from "@/i18n/navigation";
import { decisionDeadline } from "@/lib/auction-rules";
import { getUserId } from "@/lib/auth";
import { formatTenge } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { firstRow } from "@/lib/supabase/rows";
import { createClient } from "@/lib/supabase/server";
import { DeleteDraftButton } from "./delete-draft-button";

type DealSummary = { id: string; status: string; agreed_price: number; final_price: number | null };

type SellerAuction = {
  id: string;
  status: string;
  ends_at: string;
  cars: { make: string; model: string; year: number };
  deals: DealSummary | DealSummary[] | null;
};

// S2 판매자 홈: 진행 중 경매, 판매 결정 대기, 거래 진행, 지난 경매
export default async function SellerHome({ params }: PageProps<"/[locale]/sell">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("seller");
  if (!isSupabaseConfigured) return <SetupNotice />;

  const userId = await getUserId();
  if (!userId) return redirect({ href: "/login?next=/sell", locale });

  const supabase = await createClient();
  const [{ data }, { data: carRows }] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, status, ends_at, cars(make, model, year), deals(id, status, agreed_price, final_price)")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<SellerAuction[], { merge: false }>(),
    // 경매에 한 번도 올리지 않은 차량 = 등록하다 멈춘 차량
    supabase
      .from("cars")
      .select("id, make, model, year, auctions(id)")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<{ id: string; make: string; model: string; year: number; auctions: { id: string }[] }[], { merge: false }>(),
  ]);
  const auctions = data ?? [];
  const drafts = (carRows ?? []).filter((car) => car.auctions.length === 0);

  const live = auctions.filter((a) => a.status === "live");
  const ended = auctions.filter((a) => a.status === "ended");
  const dealing = auctions.filter((a) => a.status === "accepted");
  const past = auctions.filter((a) => !["live", "ended", "accepted"].includes(a.status));

  const stats = await Promise.all(
    live.map(async (auction) => {
      const { data } = await supabase.rpc("auction_stats", { p_auction_id: auction.id });
      return (data?.[0] ?? { bid_count: 0, top_amount: null }) as { bid_count: number; top_amount: number | null };
    }),
  );

  const carName = (a: SellerAuction) => `${a.cars.make} ${a.cars.model} · ${a.cars.year}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>
      {auctions.length > 0 && <InstallPrompt />}
      {auctions.length > 0 && <PushToggle compact />}

      {drafts.length > 0 && (
        <Section title={t("drafts")}>
          {drafts.map((car) => (
            <div key={car.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-steppe bg-white p-4">
              <span className="text-subtitle font-semibold">
                {car.make} {car.model} · {car.year}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <DeleteDraftButton carId={car.id} />
                <Link href={`/sell/new?car=${car.id}`} className="text-body font-semibold text-steppe">
                  {t("continueDraft")} →
                </Link>
              </div>
            </div>
          ))}
        </Section>
      )}

      {auctions.length === 0 && drafts.length === 0 && (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-ink/60">{t("empty")}</p>
        </div>
      )}

      {ended.length > 0 && (
        <Section title={t("needsDecision")}>
          {ended.map((auction) => (
            <Link
              key={auction.id}
              href={`/sell/auctions/${auction.id}`}
              className="flex items-center justify-between rounded-xl border-2 border-gold bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-subtitle font-semibold">{carName(auction)}</p>
                <p className="text-caption text-ink/60">
                  {t("decideWithin")} <Countdown endsAt={decisionDeadline(auction.ends_at)} />
                </p>
              </div>
              <span className="shrink-0 text-body font-semibold text-navy">{t("seeResult")} →</span>
            </Link>
          ))}
        </Section>
      )}

      {live.length > 0 && (
        <Section title={t("myAuctions")}>
          {live.map((auction, i) => (
            <Link
              key={auction.id}
              href={`/sell/auctions/${auction.id}`}
              className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-subtitle font-semibold">{carName(auction)}</span>
                <Countdown endsAt={auction.ends_at} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-caption text-ink/60">{t("topBid")}</p>
                  <p className="price text-price font-bold text-gold">
                    {stats[i].top_amount ? formatTenge(stats[i].top_amount) : "—"}
                  </p>
                </div>
                <p className="text-caption text-ink/60">{t("bidders", { count: stats[i].bid_count })}</p>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {dealing.length > 0 && (
        <Section title={t("deals")}>
          {dealing.map((auction) => {
            const deal = firstRow(auction.deals);
            return (
              <Link
                key={auction.id}
                href={deal ? `/sell/deals/${deal.id}` : `/sell/auctions/${auction.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-subtitle font-semibold">{carName(auction)}</p>
                  {deal && (
                    <p className="price text-body font-bold text-gold">{formatTenge(deal.final_price ?? deal.agreed_price)}</p>
                  )}
                </div>
                {deal && <StatusBadge kind="deal" status={deal.status} />}
              </Link>
            );
          })}
        </Section>
      )}

      {past.length > 0 && (
        <Section title={t("past")}>
          <ul className="divide-y divide-ink/10 rounded-xl bg-white">
            {past.map((auction) => (
              <li key={auction.id}>
                <Link href={`/sell/auctions/${auction.id}`} className="flex items-center justify-between p-3">
                  <span className="text-body">{carName(auction)}</span>
                  <StatusBadge kind="auction" status={auction.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="sticky bottom-0 mt-auto bg-surface pt-2 pb-4">
        <Link
          href="/sell/new"
          className="flex h-14 w-full items-center justify-center rounded-xl bg-navy text-subtitle font-bold text-white"
        >
          {t("start")}
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-subtitle font-semibold">{title}</h2>
      {children}
    </section>
  );
}
