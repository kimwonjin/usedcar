"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Countdown } from "@/components/countdown";
import { PriceChart, type BidEvent } from "@/components/price-chart";
import { useRouter } from "@/i18n/navigation";
import { formatTenge } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime";

type Stats = { bid_count: number; top_amount: number | null };

function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, 5_000);
  return () => clearInterval(id);
}

// S6 경매 진행 중: 카운트다운, 실시간 최고가(금색), 입찰 딜러 수
export function LiveAuction({
  auctionId,
  startsAt,
  endsAt,
  initial,
  initialEvents,
  desiredPrice,
}: {
  auctionId: string;
  startsAt: string;
  endsAt: string;
  initial: Stats;
  initialEvents: BidEvent[];
  desiredPrice: number | null;
}) {
  const t = useTranslations("sellerAuction");
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(initial);
  const [events, setEvents] = useState<BidEvent[]>(initialEvents);
  const [flash, setFlash] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  // 5초 단위로 반올림해서 렌더마다 같은 값을 돌려준다
  const now = useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 5000) * 5000, () => 0);
  const closed = useSyncExternalStore(
    subscribeClock,
    () => Date.now() >= new Date(endsAt).getTime(),
    () => false,
  );

  // 새 입찰이 들어오면 Realtime으로 알림을 받아 최고가를 다시 읽는다
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    authorizeRealtime(supabase).then(() => {
      if (closed) return;
      channel = supabase
        .channel(`auction-${auctionId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` }, async () => {
          const [{ data }, { data: eventRows }] = await Promise.all([
            supabase.rpc("auction_stats", { p_auction_id: auctionId }),
            supabase.from("bid_events").select("amount, created_at").eq("auction_id", auctionId).order("created_at"),
          ]);
          if (eventRows) setEvents(eventRows as BidEvent[]);
          if (data?.[0]) {
            setStats(data[0] as Stats);
            setFlash(true);
            setTimeout(() => setFlash(false), 1500);
          }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` }, () =>
          router.refresh(),
        )
        .subscribe();
    });
    return () => {
      closed = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [auctionId, router]);

  // 마감 시각이 지나면 서버가 경매를 닫을 때까지(최대 1분) 주기적으로 새로 고친다
  useEffect(() => {
    if (!closed) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [closed, router]);

  async function cancel() {
    if (!confirm(t("cancelConfirm"))) return;
    const { error } = await createClient().rpc("cancel_my_auction", { p_auction_id: auctionId });
    if (error) setCancelError(true);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center gap-1 rounded-xl bg-navy p-6 text-white">
        <p className="text-caption text-white/70">{closed ? t("closing") : t("timeLeft")}</p>
        <p className="text-[36px] font-bold">
          {closed ? "00:00:00" : <Countdown endsAt={endsAt} inverse />}
        </p>
      </section>

      <section className={`flex flex-col items-center gap-1 rounded-xl bg-white p-6 shadow-sm transition ${flash ? "ring-4 ring-gold" : ""}`}>
        <p className="text-caption text-ink/60">{t("topBid")}</p>
        <p className="price text-[40px] leading-tight font-bold text-gold">
          {stats.top_amount ? formatTenge(stats.top_amount) : "—"}
        </p>
        <p className="text-body text-ink/70">{t("bidders", { count: stats.bid_count })}</p>
        {desiredPrice && (
          <p className="price mt-1 text-caption text-ink/60">
            {t("desired")} {formatTenge(desiredPrice)}
          </p>
        )}
      </section>

      {/* 지금까지 시간 기준으로 그린다 */}
      <PriceChart events={events} startAt={startsAt} endAt={new Date(Math.min(now || Date.parse(startsAt), Date.parse(endsAt))).toISOString()} />

      <ul className="flex flex-col gap-2 rounded-xl bg-white p-4 text-caption text-ink/70 shadow-sm">
        <li>• {t("guideLive1")}</li>
        <li>• {t("guideLive2")}</li>
        <li>• {t("guideLive3")}</li>
      </ul>

      {stats.bid_count === 0 && !closed && (
        <button type="button" onClick={cancel} className="text-caption text-ink/50 underline">
          {t("cancelAuction")}
        </button>
      )}
      {cancelError && <p className="text-center text-caption text-danger">{t("cancelFailed")}</p>}
    </div>
  );
}
