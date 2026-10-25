"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClaimReview({ claimId }: { claimId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(false);
    const { error } = await createClient().rpc("review_claim", {
      p_claim_id: claimId,
      p_approve: approve,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) setError(true);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-3 md:flex-row">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("notePlaceholder")}
        className="h-10 flex-1 rounded-lg border border-ink/15 px-3 text-body"
      />
      <button type="button" disabled={busy} onClick={() => decide(true)} className="h-10 rounded-lg bg-success px-4 font-semibold text-white disabled:opacity-40">
        {t("approveClaim")}
      </button>
      <button type="button" disabled={busy} onClick={() => decide(false)} className="h-10 rounded-lg border border-danger px-4 font-semibold text-danger disabled:opacity-40">
        {t("rejectClaim")}
      </button>
      {error && <p className="text-caption text-danger">{t("actionFailed")}</p>}
    </div>
  );
}
