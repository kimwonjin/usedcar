"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 관리자 수동 처리: 계좌이체·현금 등 결제 업체 밖에서 받은 경우 '입금 확인', 청구 취소
export function PaymentActions({ paymentId }: { paymentId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(status: "paid" | "cancelled") {
    if (!confirm(t(status === "paid" ? "confirmPaid" : "confirmCancelPayment"))) return;
    setBusy(true);
    await createClient()
      .from("payments")
      .update(status === "paid" ? { status, paid_at: new Date().toISOString(), provider: "manual" } : { status })
      .eq("id", paymentId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      <button type="button" disabled={busy} onClick={() => update("paid")} className="rounded-lg bg-success px-2 py-1 font-semibold text-white disabled:opacity-40">
        {t("markPaid")}
      </button>
      <button type="button" disabled={busy} onClick={() => update("cancelled")} className="rounded-lg border border-ink/20 px-2 py-1 disabled:opacity-40">
        {t("cancelPayment")}
      </button>
    </div>
  );
}
