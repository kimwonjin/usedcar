"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { DealerStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export function DealerActions({
  dealerId,
  status,
  warningCount,
  blocked,
}: {
  dealerId: string;
  status: DealerStatus;
  warningCount: number;
  blocked: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  async function review(next: DealerStatus) {
    setBusy(true);
    setError(false);
    const { error } = await createClient().rpc("review_dealer", {
      p_dealer_id: dealerId,
      p_status: next,
      p_reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  async function warn() {
    setBusy(true);
    const { error } = await createClient()
      .from("dealers")
      .update({ warning_count: warningCount + 1 })
      .eq("id", dealerId);
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  // 입찰 제한 해제와 경고 초기화 (관리자 판단으로 패널티를 되돌릴 때)
  async function clearPenalty() {
    setBusy(true);
    const { error } = await createClient()
      .from("dealers")
      .update({ bid_blocked_until: null, warning_count: 0 })
      .eq("id", dealerId);
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  const button = "h-10 rounded-lg px-4 text-body font-semibold disabled:opacity-40";
  return (
    <div className="flex min-w-48 flex-col gap-2">
      {(status === "pending" || status === "rejected" || status === "suspended") && (
        <button type="button" disabled={busy} onClick={() => review("approved")} className={`${button} bg-success text-white`}>
          {status === "suspended" ? t("unsuspend") : t("approve")}
        </button>
      )}
      {(status === "pending" || status === "approved") && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            className="h-10 rounded-lg border border-ink/15 px-3 text-caption"
          />
          {status === "pending" && (
            <button type="button" disabled={busy || !reason.trim()} onClick={() => review("rejected")} className={`${button} border border-danger text-danger`}>
              {t("reject")}
            </button>
          )}
          {status === "approved" && (
            <>
              <button type="button" disabled={busy} onClick={warn} className={`${button} border border-ink/20`}>
                {t("warn")}
              </button>
              <button type="button" disabled={busy} onClick={() => review("suspended")} className={`${button} bg-danger text-white`}>
                {t("suspend")}
              </button>
            </>
          )}
        </>
      )}
      {(blocked || warningCount > 0) && status === "approved" && (
        <button type="button" disabled={busy} onClick={clearPenalty} className={`${button} border border-ink/20 text-ink/70`}>
          {t("clearPenalty")}
        </button>
      )}
      {error && <p className="text-caption text-danger">{t("actionFailed")}</p>}
    </div>
  );
}
