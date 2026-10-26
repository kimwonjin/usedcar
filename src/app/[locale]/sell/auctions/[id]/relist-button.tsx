"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PriceInput } from "@/components/price-input";
import { useRouter } from "@/i18n/navigation";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

// 유찰·거절·기한 초과·취소된 차량을 다시 48시간 경매에 올린다.
// 지난 결과(최고 입찰가)와 시세를 보여 주고, 다시 올리기 전에 희망가를 고칠 수 있게 한다
export function RelistButton({
  carId,
  topBid,
  bidCount,
  desiredPrice,
  marketAvg,
}: {
  carId: string;
  topBid: number | null;
  bidCount: number;
  desiredPrice: number | null;
  marketAvg: number | null;
}) {
  const t = useTranslations("sellerAuction");
  const tf = useTranslations("carForm");
  const router = useRouter();
  const [price, setPrice] = useState(desiredPrice ? String(desiredPrice) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gap = topBid !== null && desiredPrice ? desiredPrice - topBid : null;
  // 추천 희망가 (만 단위 반올림): 최고 입찰가, 비슷한 차 평균 낙찰가.
  // 지난번에 팔리지 않았으니 희망가가 있으면 그보다 낮은 값만 권한다
  const round = (n: number) => Math.round(n / 10_000) * 10_000;
  const candidates: { key: "useTopBid" | "useMarket"; value: number }[] = [];
  if (topBid !== null) candidates.push({ key: "useTopBid", value: round(topBid) });
  if (marketAvg !== null) candidates.push({ key: "useMarket", value: round(marketAvg) });
  const suggestions = candidates.filter((c) => !desiredPrice || c.value < desiredPrice);

  async function relist() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const next = price ? Number(price) : null;
    if (next !== desiredPrice) {
      const { error } = await supabase.from("cars").update({ desired_price: next }).eq("id", carId);
      if (error) {
        setError(t("relistFailed"));
        setBusy(false);
        return;
      }
    }
    const { data, error } = await supabase.rpc("start_auction", { p_car_id: carId });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("plate already listed")
          ? tf("startBlocked.plate")
          : error.message.includes("too many active auctions")
            ? tf("startBlocked.tooMany")
            : t("relistFailed"),
      );
      return;
    }
    router.replace(`/sell/auctions/${data}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-caption text-ink/60">{t("lastTopBid")}</dt>
          <dd className="price text-body font-bold">{topBid !== null ? formatTenge(topBid) : t("noBidsShort")}</dd>
          {bidCount > 0 && <dd className="text-caption text-ink/50">{t("bidCount", { count: bidCount })}</dd>}
        </div>
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-caption text-ink/60">{t("desiredShort")}</dt>
          <dd className="price text-body font-bold">{desiredPrice ? formatTenge(desiredPrice) : "—"}</dd>
        </div>
        <div className="rounded-lg bg-surface p-2">
          <dt className="text-caption text-ink/60">{t("marketShort")}</dt>
          <dd className="price text-body font-bold">{marketAvg !== null ? formatTenge(marketAvg) : "—"}</dd>
        </div>
      </dl>
      {gap !== null && gap > 0 && (
        <p className="text-caption text-ink/70">{t("gapHint", { amount: formatTenge(gap), pct: Math.round((gap / desiredPrice!) * 100) })}</p>
      )}
      {topBid === null && <p className="text-caption text-ink/70">{t("noBidsHint")}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-caption font-semibold">{t("newDesired")}</span>
        <PriceInput value={price} onChange={setPrice} placeholder={t("desiredOptional")} />
      </label>
      {(suggestions.length > 0 || price) && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setPrice(String(s.value))}
              className="price rounded-full border border-ink/15 px-3 py-1.5 text-caption font-semibold"
            >
              {t(s.key, { amount: formatTenge(s.value) })}
            </button>
          ))}
          {price && (
            <button type="button" onClick={() => setPrice("")} className="rounded-full border border-ink/15 px-3 py-1.5 text-caption text-ink/60">
              {t("clearDesired")}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={relist}
        className="h-12 rounded-xl bg-navy text-body font-bold text-white disabled:opacity-40"
      >
        {t("relist")}
      </button>
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
