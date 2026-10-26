"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function ReportActions({ reportId }: { reportId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function close(status: "resolved" | "dismissed") {
    setBusy(true);
    await createClient()
      .from("reports")
      .update({ status, admin_note: note.trim() || null, resolved_at: new Date().toISOString() })
      .eq("id", reportId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-3 md:flex-row">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("reportNotePlaceholder")}
        className="h-10 flex-1 rounded-lg border border-ink/15 px-3 text-body"
      />
      <button type="button" disabled={busy} onClick={() => close("resolved")} className="h-10 rounded-lg bg-navy px-4 font-semibold text-white disabled:opacity-40">
        {t("resolve")}
      </button>
      <button type="button" disabled={busy} onClick={() => close("dismissed")} className="h-10 rounded-lg border border-ink/20 px-4 font-semibold disabled:opacity-40">
        {t("dismiss")}
      </button>
    </div>
  );
}
