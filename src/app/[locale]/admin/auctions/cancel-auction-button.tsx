"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function CancelAuctionButton({ auctionId }: { auctionId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm(t("forceEndConfirm"))) return;
    setBusy(true);
    await createClient().rpc("admin_cancel_auction", { p_auction_id: auctionId });
    setBusy(false);
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={cancel} className="rounded-lg border border-danger px-3 py-1 font-semibold text-danger disabled:opacity-40">
      {t("forceEnd")}
    </button>
  );
}
