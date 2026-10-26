"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

// 결제 시작: 서버가 결제 업체(개발 중에는 가짜 결제) 결제창 주소를 돌려주면 그쪽으로 이동
export function PayButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function pay() {
    setBusy(true);
    setError(false);
    const response = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, locale }),
    });
    const body = (await response.json().catch(() => ({}))) as { redirectUrl?: string };
    if (!response.ok || !body.redirectUrl) {
      setError(true);
      setBusy(false);
      return;
    }
    window.location.href = body.redirectUrl;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={pay} className="h-11 rounded-lg bg-navy px-5 font-semibold text-white disabled:opacity-40">
        {t("pay")}
      </button>
      {error && <p className="text-caption text-danger">{t("payFailed")}</p>}
    </div>
  );
}
