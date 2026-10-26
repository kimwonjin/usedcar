"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function MarkPaidButton({ rewardId }: { rewardId: string }) {
  const t = useTranslations("adminReferrals");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  return (
    <button
      type="button"
      disabled={busy || refreshing}
      onClick={async () => {
        if (!confirm(t("markPaidConfirm"))) return;
        setBusy(true);
        const { error } = await createClient()
          .from("referral_rewards")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", rewardId);
        setBusy(false);
        if (!error) startRefresh(() => router.refresh());
      }}
      className="h-8 rounded-lg border border-success px-3 font-semibold text-success disabled:opacity-40"
    >
      {t("markPaid")}
    </button>
  );
}
