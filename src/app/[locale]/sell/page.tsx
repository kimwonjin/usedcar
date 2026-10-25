import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Countdown } from "@/components/countdown";
import { SetupNotice } from "@/components/setup-notice";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatTenge } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type SellerAuction = {
  id: string;
  ends_at: string;
  cars: { make: string; model: string; year: number };
};

// S2 판매자 홈
export default async function SellerHome({ params }: PageProps<"/[locale]/sell">) {
  const locale = (await params).locale as Locale; // layout에서 검증됨
  setRequestLocale(locale);
  const t = await getTranslations("seller");
  if (!isSupabaseConfigured) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/login?next=/sell", locale });

  const supabase = await createClient();
  const { data } = await supabase
    .from("auctions")
    .select("id, ends_at, cars(make, model, year)")
    .eq("seller_id", user.id)
    .eq("status", "live")
    .order("ends_at")
    .overrideTypes<SellerAuction[], { merge: false }>();
  const auctions = data ?? [];

  const stats = await Promise.all(
    auctions.map(async (auction) => {
      const { data } = await supabase.rpc("auction_stats", { p_auction_id: auction.id });
      return (data?.[0] ?? { bid_count: 0, top_amount: null }) as {
        bid_count: number;
        top_amount: number | null;
      };
    }),
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-title font-bold text-navy">{t("title")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-subtitle font-semibold">{t("myAuctions")}</h2>
        {auctions.length === 0 && <p className="text-ink/60">{t("empty")}</p>}
        {auctions.map((auction, i) => (
          <article key={auction.id} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-subtitle font-semibold">
                {auction.cars.make} {auction.cars.model} · {auction.cars.year}
              </span>
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
          </article>
        ))}
      </section>

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
