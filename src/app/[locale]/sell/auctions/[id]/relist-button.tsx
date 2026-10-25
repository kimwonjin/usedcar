"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 유찰·거절·취소된 차량을 같은 정보와 사진으로 다시 48시간 경매에 올린다
export function RelistButton({ carId }: { carId: string }) {
  const t = useTranslations("sellerAuction");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function relist() {
    setBusy(true);
    const { data, error } = await createClient().rpc("start_auction", { p_car_id: carId });
    setBusy(false);
    if (error) {
      setError(true);
      return;
    }
    router.replace(`/sell/auctions/${data}`);
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={relist}
        className="h-12 rounded-xl bg-navy text-body font-bold text-white disabled:opacity-40"
      >
        {t("relist")}
      </button>
      {error && <p className="text-caption text-danger">{t("relistFailed")}</p>}
    </>
  );
}
