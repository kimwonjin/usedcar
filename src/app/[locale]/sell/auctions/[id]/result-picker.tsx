"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/badge";
import { Stars } from "@/components/stars";
import { useRouter } from "@/i18n/navigation";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export type TopBid = {
  bid_id: string;
  amount: number;
  dealer_id: string;
  dealer_name: string;
  dealer_rating: number;
  completed_deals: number;
};

// S7 경매 결과: 상위 3곳 중 하나를 골라 판매하거나 모두 거절
export function ResultPicker({
  auctionId,
  bids,
  desiredPrice,
}: {
  auctionId: string;
  bids: TopBid[];
  desiredPrice: number | null;
}) {
  const t = useTranslations("sellerAuction");
  const router = useRouter();
  const [selected, setSelected] = useState(bids[0]?.bid_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function accept() {
    if (!selected) return;
    setBusy(true);
    setError(false);
    const { data, error } = await createClient().rpc("accept_bid", { p_auction_id: auctionId, p_bid_id: selected });
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    router.replace(`/sell/deals/${data}`);
    router.refresh();
  }

  async function reject() {
    if (!confirm(t("rejectConfirm"))) return;
    setBusy(true);
    const { error } = await createClient().rpc("reject_auction", { p_auction_id: auctionId });
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-subtitle font-semibold">{t("resultTitle")}</h2>
        <p className="text-caption text-ink/60">{t("resultHint")}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {bids.map((bid, i) => {
          const diff = desiredPrice ? bid.amount - desiredPrice : null;
          return (
            <li key={bid.bid_id}>
              <button
                type="button"
                onClick={() => setSelected(bid.bid_id)}
                aria-pressed={selected === bid.bid_id}
                className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white p-4 text-left ${
                  selected === bid.bid_id ? "border-navy" : "border-transparent shadow-sm"
                }`}
              >
                <span className={`price text-title font-bold ${i === 0 ? "text-gold" : "text-ink/40"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="price text-subtitle font-bold">{formatTenge(bid.amount)}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-caption text-ink/60">
                    <span className="font-semibold text-ink">{bid.dealer_name}</span>
                    <Stars rating={bid.dealer_rating} />
                    <span>{t("dealerDeals", { count: bid.completed_deals })}</span>
                  </p>
                  {diff !== null && (
                    <p className={`price text-caption ${diff >= 0 ? "text-success" : "text-danger"}`}>
                      {t("vsDesired")} {diff >= 0 ? "+" : "−"}
                      {formatTenge(Math.abs(diff))}
                    </p>
                  )}
                </div>
                {i === 0 && <Badge tone="gold">{t("best")}</Badge>}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-ink/70">{t("promise")}</p>
      {error && <p className="text-caption text-danger">{t("decisionFailed")}</p>}

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface pt-2 pb-4">
        <button
          type="button"
          disabled={!selected || busy}
          onClick={accept}
          className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-40"
        >
          {t("sell")}
        </button>
        <button type="button" disabled={busy} onClick={reject} className="h-11 text-body text-ink/60">
          {t("rejectAll")}
        </button>
      </div>
    </div>
  );
}
