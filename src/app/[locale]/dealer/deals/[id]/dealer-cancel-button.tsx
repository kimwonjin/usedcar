"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 딜러 사정으로 거래 취소: 패널티가 쌓인다는 것을 먼저 알린다
export function DealerCancelButton({ dealId }: { dealId: string }) {
  const t = useTranslations("deal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function cancel() {
    if (!confirm(t("dealerCancelConfirm"))) return;
    setBusy(true);
    const { error } = await createClient().rpc("cancel_deal", { p_deal_id: dealId, p_reason: "dealer_cancelled" });
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" disabled={busy} onClick={cancel} className="text-caption text-ink/50 underline disabled:opacity-40">
        {t("dealerCancel")}
      </button>
      <p className="text-caption text-ink/40">{t("dealerCancelHint")}</p>
      {error && <p className="text-caption text-danger">{t("actionFailed")}</p>}
    </div>
  );
}
