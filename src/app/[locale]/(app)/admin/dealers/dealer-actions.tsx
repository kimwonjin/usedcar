"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import type { DealerStatus } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export function DealerActions({
  dealerId,
  status,
}: {
  dealerId: string;
  status: DealerStatus;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [refreshing, startRefresh] = useTransition();

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
    else startRefresh(() => router.refresh());
  }

  // 관리자 경고: 노쇼·취소와 같은 단계로 쌓이고 이력에 남는다 (사유는 위 입력칸)
  async function warn() {
    setBusy(true);
    setError(false);
    const { error } = await createClient().rpc("admin_warn_dealer", { p_dealer_id: dealerId, p_note: reason.trim() });
    setBusy(false);
    if (error) setError(true);
    else {
      setReason("");
      startRefresh(() => router.refresh());
    }
  }

  const button = "h-10 rounded-lg px-4 text-body font-semibold disabled:opacity-40";
  return (
    <div className="flex min-w-48 flex-col gap-2">
      {(status === "pending" || status === "rejected" || status === "suspended") && (
        <button type="button" disabled={busy || refreshing} onClick={() => review("approved")} className={`${button} bg-success text-white`}>
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
            <button type="button" disabled={busy || refreshing || !reason.trim()} onClick={() => review("rejected")} className={`${button} border border-danger text-danger`}>
              {t("reject")}
            </button>
          )}
          {status === "approved" && (
            <>
              <button type="button" disabled={busy || refreshing || !reason.trim()} onClick={warn} className={`${button} border border-ink/20`}>
                {t("warn")}
              </button>
              <p className="max-w-56 text-caption text-ink/50">{t("warnHint")}</p>
              <button type="button" disabled={busy || refreshing} onClick={() => review("suspended")} className={`${button} bg-danger text-white`}>
                {t("suspend")}
              </button>
            </>
          )}
        </>
      )}
      {error && <p className="text-caption text-danger">{t("actionFailed")}</p>}
    </div>
  );
}
