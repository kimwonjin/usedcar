"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { PriceInput } from "@/components/price-input";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";

const MAX_PHOTOS = 6;

// 현장에서 판매자 정보와 다른 점을 발견하면 감가를 청구한다. 관리자가 사진을 비교해 심사.
export function ClaimForm({ dealId, userId, agreedPrice }: { dealId: string; userId: string; agreedPrice: number }) {
  const t = useTranslations("deal");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const value = Number(amount);
  const valid = value > 0 && value < agreedPrice && reason.trim().length >= 5 && paths.length > 0;

  async function addPhoto(file: File) {
    setUploading(true);
    try {
      const path = await uploadPhoto("claim-photos", `${userId}/${dealId}`, file);
      setPaths((prev) => [...prev, path]);
    } catch {
      setError(t("uploadFailed"));
    }
    setUploading(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().from("depreciation_claims").insert({
      deal_id: dealId,
      dealer_id: userId,
      amount: value,
      reason: reason.trim(),
      photo_paths: paths,
    });
    setBusy(false);
    if (error) {
      setError(t("claimFailed"));
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 rounded-xl border border-danger/40 text-body font-semibold text-danger"
      >
        {t("openClaim")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-white p-4">
      <p className="text-caption text-ink/70">{t("claimGuide")}</p>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("claimAmount")}</span>
        <PriceInput value={amount} onChange={setAmount} placeholder="300 000" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-caption text-ink/60">{t("claimReason")}</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t("claimReasonPlaceholder")}
          className="rounded-lg border border-ink/15 bg-white p-3"
        />
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) addPhoto(file);
        }}
      />
      <div className="flex items-center gap-2">
        <span className="text-caption text-ink/60">{t("claimPhotos", { count: paths.length })}</span>
        {paths.length < MAX_PHOTOS && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-caption font-semibold text-steppe disabled:opacity-40"
          >
            {uploading ? t("uploading") : `+ ${t("addPhoto")}`}
          </button>
        )}
      </div>
      {error && <p className="text-caption text-danger">{error}</p>}
      <button
        type="button"
        disabled={!valid || busy || uploading}
        onClick={submit}
        className="h-12 rounded-xl bg-danger text-body font-bold text-white disabled:opacity-40"
      >
        {t("submitClaim")}
      </button>
    </div>
  );
}
