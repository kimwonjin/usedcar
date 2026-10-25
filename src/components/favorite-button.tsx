"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 관심 차량(찜) 토글. 찜한 차량은 마감 1시간 전·정보 보강 시 알림을 받는다.
export function FavoriteButton({
  auctionId,
  dealerId,
  initial,
  className = "",
}: {
  auctionId: string;
  dealerId: string;
  initial: boolean;
  className?: string;
}) {
  const t = useTranslations("favorites");
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !on;
    setOn(next);
    const table = createClient().from("dealer_favorites");
    const { error } = next
      ? await table.insert({ dealer_id: dealerId, auction_id: auctionId })
      : await table.delete().eq("dealer_id", dealerId).eq("auction_id", auctionId);
    if (error) setOn(!next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? t("remove") : t("add")}
      title={on ? t("remove") : t("add")}
      className={`flex size-9 items-center justify-center rounded-full bg-white/90 text-[20px] leading-none shadow-sm ${
        on ? "text-gold" : "text-ink/30"
      } ${className}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
