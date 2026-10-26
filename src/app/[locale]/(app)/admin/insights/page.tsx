import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin-only";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatTenge } from "@/lib/format";
import { currentDeal } from "@/lib/supabase/rows";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/time";

const PERIODS = ["7", "30", "90", "all"] as const;

type AuctionRow = {
  id: string;
  status: string;
  created_at: string;
  cars: { desired_price: number | null } | null;
  deals: InsightDeal | InsightDeal[] | null;
};
type InsightDeal = { status: string; agreed_price: number; final_price: number | null; dealer_id: string; created_at: string };
type BidRow = { auction_id: string; dealer_id: string; amount: number };

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);

// 운영 지표: 판매 퍼널, 경매 품질, 딜러 순위 (기간 선택)
export default async function AdminInsights({ params, searchParams }: PageProps<"/[locale]/admin/insights">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("insights");
  if (!(await requireAdmin(locale))) return <AdminOnly />;

  const query = await searchParams;
  const period = PERIODS.find((p) => p === query.period) ?? "30";
  const since = period === "all" ? null : daysAgoIso(Number(period));

  const supabase = await createClient();
  const withSince = <T extends { gte: (c: string, v: string) => T }>(q: T) => (since ? q.gte("created_at", since) : q);
  const [{ count: carCount }, { data: auctionData }, { data: dealerRows }] = await Promise.all([
    withSince(supabase.from("cars").select("*", { count: "exact", head: true })),
    withSince(
      supabase
        .from("auctions")
        .select("id, status, created_at, cars(desired_price), deals(status, agreed_price, final_price, dealer_id, created_at)"),
    )
      .limit(5000)
      .overrideTypes<AuctionRow[], { merge: false }>(),
    supabase.from("dealers").select("id, business_name").eq("status", "approved"),
  ]);
  // 차순위로 넘긴 경매는 거래가 여러 개라 지금 유효한 거래 하나로 본다
  const auctions = (auctionData ?? []).map((a) => ({ ...a, deals: currentDeal(a.deals) }));
  const ids = auctions.map((a) => a.id);
  const { data: bidData } = ids.length
    ? await supabase.from("bids").select("auction_id, dealer_id, amount").in("auction_id", ids).limit(20000)
    : { data: [] };
  const bids = (bidData ?? []) as BidRow[];

  // 퍼널
  const biddersBy = new Map<string, Set<string>>();
  for (const b of bids) (biddersBy.get(b.auction_id) ?? biddersBy.set(b.auction_id, new Set()).get(b.auction_id)!).add(b.dealer_id);
  // 판매자가 중간에 취소한 경매는 기간을 다 채우지 않아 품질 지표에서 뺀다
  const finished = auctions.filter((a) => a.status !== "live" && a.status !== "cancelled");
  const withBids = auctions.filter((a) => biddersBy.has(a.id));
  const deals = auctions.map((a) => a.deals).filter((d) => d !== null);
  const completed = deals.filter((d) => d.status === "completed");
  const funnel: [string, number][] = [
    [t("funnel.cars"), carCount ?? 0],
    [t("funnel.auctions"), auctions.length],
    [t("funnel.withBids"), withBids.length],
    [t("funnel.accepted"), deals.length],
    [t("funnel.completed"), completed.length],
  ];

  // 경매 품질
  const finishedWithBids = finished.filter((a) => biddersBy.has(a.id));
  const avgBidders = finished.length
    ? finished.reduce((sum, a) => sum + (biddersBy.get(a.id)?.size ?? 0), 0) / finished.length
    : null;
  const decided = finishedWithBids.filter((a) => a.status !== "ended");
  const vsDesired = auctions
    .filter((a) => a.deals && a.cars?.desired_price)
    .map((a) => ((a.deals!.agreed_price - a.cars!.desired_price!) / a.cars!.desired_price!) * 100);
  const gmv = completed.reduce((sum, d) => sum + (d.final_price ?? d.agreed_price), 0);
  const quality: [string, string][] = [
    [t("quality.avgBidders"), avgBidders === null ? "—" : avgBidders.toFixed(1)],
    [t("quality.noBidRate"), finished.length ? `${pct(finished.length - finishedWithBids.length, finished.length)}%` : "—"],
    [t("quality.acceptRate"), decided.length ? `${pct(deals.length, decided.length)}%` : "—"],
    [
      t("quality.vsDesired"),
      vsDesired.length ? `${vsDesired.reduce((s, v) => s + v, 0) / vsDesired.length >= 0 ? "+" : ""}${(vsDesired.reduce((s, v) => s + v, 0) / vsDesired.length).toFixed(1)}%` : "—",
    ],
    [t("quality.gmv"), formatTenge(gmv)],
    [t("quality.avgPrice"), completed.length ? formatTenge(gmv / completed.length) : "—"],
  ];

  // 딜러 순위: 입찰한 경매 수 순
  const names = new Map((dealerRows ?? []).map((d) => [d.id as string, d.business_name as string]));
  const stats = new Map<string, { auctions: number; won: number; completed: number }>();
  for (const [auctionId, dealers] of biddersBy) {
    for (const dealerId of dealers) {
      const s = stats.get(dealerId) ?? { auctions: 0, won: 0, completed: 0 };
      s.auctions += 1;
      const deal = auctions.find((a) => a.id === auctionId)?.deals;
      if (deal?.dealer_id === dealerId) {
        s.won += 1;
        if (deal.status === "completed") s.completed += 1;
      }
      stats.set(dealerId, s);
    }
  }
  const ranking = [...stats.entries()].sort(([, a], [, b]) => b.auctions - a.auctions || b.won - a.won).slice(0, 10);
  const maxFunnel = Math.max(1, ...funnel.map(([, v]) => v));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title font-bold text-navy">{t("title")}</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/insights?period=${p}`}
              className={`rounded-full border px-3 py-1.5 text-caption font-semibold ${
                p === period ? "border-navy bg-navy text-white" : "border-ink/15 bg-white"
              }`}
            >
              {t(`period.${p}`)}
            </Link>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-subtitle font-semibold">{t("funnelTitle")}</h2>
        <ol className="flex flex-col gap-2">
          {funnel.map(([label, value], i) => {
            const prev = i > 0 ? funnel[i - 1][1] : null;
            const rate = prev !== null ? pct(value, prev) : null;
            return (
              <li key={label} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-caption">
                <span className="text-ink/70">{label}</span>
                <span className="h-6 rounded bg-surface">
                  <span className="block h-full rounded bg-steppe" style={{ width: `${(value / maxFunnel) * 100}%` }} />
                </span>
                <span className="price text-right">
                  <b className="text-body">{value}</b>
                  {rate !== null && <span className="ml-1 text-ink/50">({rate}%)</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-ink/50">{t("funnelHint")}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quality.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-caption text-ink/60">{label}</p>
            <p className="price text-title font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-subtitle font-semibold">{t("rankingTitle")}</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-caption">
            <thead className="border-b border-ink/10 text-ink/60">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{t("ranking.dealer")}</th>
                <th className="p-3 text-right">{t("ranking.auctions")}</th>
                <th className="p-3 text-right">{t("ranking.won")}</th>
                <th className="p-3 text-right">{t("ranking.winRate")}</th>
                <th className="p-3 text-right">{t("ranking.completed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {ranking.map(([dealerId, s], i) => (
                <tr key={dealerId}>
                  <td className="price p-3">{i + 1}</td>
                  <td className="p-3 font-semibold">{names.get(dealerId) ?? "—"}</td>
                  <td className="price p-3 text-right">{s.auctions}</td>
                  <td className="price p-3 text-right">{s.won}</td>
                  <td className="price p-3 text-right">{pct(s.won, s.auctions)}%</td>
                  <td className="price p-3 text-right">{s.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranking.length === 0 && <p className="p-6 text-center text-ink/60">{t("empty")}</p>}
        </div>
      </section>
    </div>
  );
}
