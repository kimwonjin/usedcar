"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// 승인(경매 시작) / 반려(사유 필수)
export function ReviewActions({ carId, hasDocs }: { carId: string; hasDocs: boolean }) {
  const t = useTranslations("adminReview");
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const disabled = busy || refreshing;

  async function run(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      action === "approve"
        ? await supabase.rpc("approve_listing", { p_car_id: carId, p_owner_verified: verified })
        : await supabase.rpc("reject_listing", { p_car_id: carId, p_note: note.trim() });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("plate already listed")
          ? t("errors.plate")
          : error.message.includes("too many")
            ? t("errors.tooMany")
            : t("errors.failed"),
      );
      return;
    }
    startRefresh(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-3 md:flex-row md:items-end">
      <div className="flex flex-1 flex-col gap-2">
        {hasDocs && (
          <label className="flex items-center gap-2 text-body">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="size-4" />
            {t("ownerVerified")}
          </label>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("rejectPlaceholder")}
          maxLength={500}
          className="h-10 rounded-lg border border-ink/15 px-3 text-caption"
        />
      </div>
      <button
        type="button"
        disabled={disabled || note.trim().length < 2}
        onClick={() => run("reject")}
        className="h-10 rounded-lg border border-danger px-4 font-semibold text-danger disabled:opacity-40"
      >
        {t("reject")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => run("approve")}
        className="h-10 rounded-lg bg-success px-5 font-semibold text-white disabled:opacity-40"
      >
        {t("approve")}
      </button>
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}

export function VerifyOwnerButton({ carId }: { carId: string }) {
  const t = useTranslations("adminReview");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  return (
    <button
      type="button"
      disabled={busy || refreshing}
      onClick={async () => {
        setBusy(true);
        const { error } = await createClient().rpc("verify_owner", { p_car_id: carId });
        setBusy(false);
        if (!error) startRefresh(() => router.refresh());
      }}
      className="h-10 rounded-lg bg-success px-4 font-semibold text-white disabled:opacity-40"
    >
      ✓ {t("verifyOwner")}
    </button>
  );
}
