"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DealerProfileButton } from "@/components/dealer-profile";
import { DealerGradeBadge, type DealerGrade } from "@/components/dealer-grade";
import { Stars } from "@/components/stars";
import { useRouter } from "@/i18n/navigation";
import { formatDate } from "@/lib/datetime";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { TopBid } from "../../auctions/[id]/result-picker";

// 낙찰 딜러가 노쇼·딜러 사정으로 취소한 거래: 경매를 다시 하지 않고 남은 입찰 딜러 중에서 다시 고른다
export function ReassignPicker({
  auctionId,
  bids,
  until,
  grades,
}: {
  auctionId: string;
  bids: TopBid[];
  until: string;
  grades: Record<string, DealerGrade>;
}) {
  const t = useTranslations("reassign");
  const ts = useTranslations("sellerAuction");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState(bids[0]?.bid_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function reassign() {
    const bid = bids.find((b) => b.bid_id === selected);
    if (!bid || !confirm(t("confirm", { name: bid.dealer_name, amount: formatTenge(bid.amount) }))) return;
    setBusy(true);
    setError(false);
    const { data, error } = await createClient().rpc("reassign_deal", { p_auction_id: auctionId, p_bid_id: bid.bid_id });
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    router.replace(`/sell/deals/${data}`);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-steppe/40 bg-white p-4">
      <div>
        <h2 className="text-subtitle font-semibold">🔁 {t("title")}</h2>
        <p className="text-caption text-ink/70">{t("hint", { date: formatDate(until, locale) })}</p>
      </div>
      {bids.length === 0 ? (
        <p className="text-body text-ink/70">{t("none")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {bids.map((bid) => (
              <li key={bid.bid_id}>
                <button
                  type="button"
                  onClick={() => setSelected(bid.bid_id)}
                  aria-pressed={selected === bid.bid_id}
                  className={`flex w-full flex-col rounded-xl border-2 p-3 text-left ${
                    selected === bid.bid_id ? "border-navy" : "border-ink/10"
                  }`}
                >
                  <span className="price text-subtitle font-bold">{formatTenge(bid.amount)}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-caption text-ink/60">
                    <span className="font-semibold text-ink">{bid.dealer_name}</span>
                    <DealerGradeBadge grade={grades[bid.dealer_id]} />
                    <Stars rating={bid.dealer_rating} />
                    <span>{ts("dealerDeals", { count: bid.completed_deals })}</span>
                  </span>
                </button>
                <div className="flex justify-end px-2 pt-1">
                  <DealerProfileButton dealerId={bid.dealer_id} dealerName={bid.dealer_name} />
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="text-caption text-danger">{t("failed")}</p>}
          <button
            type="button"
            disabled={!selected || busy}
            onClick={reassign}
            className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40"
          >
            {t("button")}
          </button>
        </>
      )}
    </section>
  );
}
