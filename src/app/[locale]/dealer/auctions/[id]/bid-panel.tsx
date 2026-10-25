"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PriceInput } from "@/components/price-input";
import { useRouter } from "@/i18n/navigation";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const STEPS = [100_000, 300_000, 1_000_000];
const REFRESH_MS = 15_000;

// D4 입찰하기: 금액 입력 → 내 순위. 다른 딜러의 금액은 보이지 않는다(블라인드).
export function BidPanel({
  auctionId,
  myAmount,
  rank,
}: {
  auctionId: string;
  myAmount: number | null;
  rank: number | null;
}) {
  const t = useTranslations("bid");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 방금 넣은 입찰은 서버 새로 고침을 기다리지 않고 바로 보여준다
  const [justPlaced, setJustPlaced] = useState<{ amount: number; rank: number } | null>(null);

  // 다른 딜러가 입찰하면 내 순위가 바뀌므로 주기적으로 새로 고친다
  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const fresh = justPlaced && justPlaced.amount > (myAmount ?? 0) ? justPlaced : null;
  const shownAmount = fresh?.amount ?? myAmount;
  const shownRank = fresh?.rank ?? rank;

  const value = Number(amount);
  const tooLow = shownAmount !== null && value > 0 && value <= shownAmount;

  async function submit() {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("place_bid", { p_auction_id: auctionId, p_amount: value });
    if (error) {
      setError(
        error.message.includes("raised")
          ? t("mustRaise")
          : error.message.includes("not live")
            ? t("closed")
            : t("failed"),
      );
    } else {
      setJustPlaced({ amount: value, rank: data as number });
      setAmount("");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-navy bg-white p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-caption text-ink/60">{t("myBid")}</p>
          <p className="price text-title font-bold">{shownAmount ? formatTenge(shownAmount) : "—"}</p>
        </div>
        {shownRank !== null && (
          <div className="text-right">
            <p className="text-caption text-ink/60">{t("myRank")}</p>
            <p className={`price text-title font-bold ${shownRank === 1 ? "text-gold" : "text-navy"}`}>
              {t("rankValue", { rank: shownRank })}
            </p>
          </div>
        )}
      </div>

      <PriceInput value={amount} onChange={setAmount} placeholder={shownAmount ? formatTenge(shownAmount + 100_000).replace(" ₸", "") : undefined} />
      <div className="flex gap-2">
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => setAmount(String((Number(amount) || shownAmount || 0) + step))}
            className="price flex-1 rounded-lg border border-ink/15 py-2 text-caption font-semibold"
          >
            +{formatTenge(step).replace(" ₸", "")}
          </button>
        ))}
      </div>

      {tooLow && <p className="text-caption text-danger">{t("mustRaise")}</p>}
      {error && <p className="text-caption text-danger">{error}</p>}

      <button
        type="button"
        disabled={!value || tooLow || busy}
        onClick={submit}
        className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-40"
      >
        {shownAmount ? t("raise") : t("submit")}
      </button>
      <ul className="list-disc pl-4 text-caption text-ink/60">
        <li>{t("ruleBlind")}</li>
        <li>{t("ruleRaiseOnly")}</li>
        <li>{t("ruleTop3")}</li>
      </ul>
    </section>
  );
}
