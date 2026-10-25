"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function MockPayActions({ paymentId, payable }: { paymentId: string; payable: boolean }) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function complete() {
    setBusy(true);
    const { error } = await createClient().rpc("mock_pay", { p_payment_id: paymentId });
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    router.replace("/dealer/billing");
    router.refresh();
  }

  return (
    <div className="mt-5 flex flex-col gap-2">
      {payable && (
        <button type="button" disabled={busy} onClick={complete} className="h-12 rounded-xl bg-navy font-bold text-white disabled:opacity-40">
          {t("mockComplete")}
        </button>
      )}
      <Link href="/dealer/billing" className="h-10 leading-10 text-caption text-ink/60">
        {t("mockCancel")}
      </Link>
      {error && <p className="text-caption text-danger">{t("mockFailed")}</p>}
    </div>
  );
}
