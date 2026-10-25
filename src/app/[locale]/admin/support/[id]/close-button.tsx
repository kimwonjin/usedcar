"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 문의 종료 / 다시 열기
export function CloseTicketButton({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const t = useTranslations("support");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await createClient()
      .from("support_tickets")
      .update({ status: closed ? "answered" : "closed", updated_at: new Date().toISOString() })
      .eq("id", ticketId);
    setBusy(false);
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={toggle} className="rounded-lg border border-ink/15 px-3 py-2 text-caption font-semibold disabled:opacity-40">
      {closed ? t("reopen") : t("close")}
    </button>
  );
}
