"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { DealerProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";

const MAX_SHOP_PHOTOS = 3;

export function ApplyForm({ userId, dealer }: { userId: string; dealer: DealerProfile | null }) {
  const t = useTranslations("dealerApply");
  const router = useRouter();
  const [businessName, setBusinessName] = useState(dealer?.business_name ?? "");
  const [bin, setBin] = useState(dealer?.bin ?? "");
  const [address, setAddress] = useState(dealer?.address ?? "");
  const [photoPaths, setPhotoPaths] = useState<string[]>(dealer?.shop_photo_paths ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = businessName.trim() && /^\d{12}$/.test(bin) && address.trim() && photoPaths.length > 0;

  async function addPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = await uploadPhoto("dealer-docs", userId, file);
      setPhotoPaths((prev) => [...prev, path]);
    } catch {
      setError(t("uploadFailed"));
    }
    setUploading(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from("dealers")
      .upsert({
        id: userId,
        business_name: businessName.trim(),
        bin,
        address: address.trim(),
        shop_photo_paths: photoPaths,
      });
    if (error) {
      setError(t("failed"));
      setBusy(false);
      return;
    }
    router.replace("/dealer");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-navy">{t("title")}</h1>
        <p className="text-caption text-ink/70">{t("intro")}</p>
      </div>

      {dealer?.status === "rejected" && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-body">
          <p className="font-semibold text-danger">{t("rejected")}</p>
          {dealer.rejection_reason && <p className="mt-1">{dealer.rejection_reason}</p>}
          <p className="mt-1 text-caption text-ink/70">{t("fixAndResubmit")}</p>
        </div>
      )}

      <Field label={t("businessName")}>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder={t("businessNamePlaceholder")}
          className={inputClass}
        />
      </Field>
      <Field label={t("bin")} hint={t("binHint")}>
        <input
          inputMode="numeric"
          value={bin}
          onChange={(e) => setBin(e.target.value.replace(/\D/g, "").slice(0, 12))}
          placeholder="123456789012"
          className={`${inputClass} price tracking-wider`}
        />
      </Field>
      <Field label={t("address")}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("addressPlaceholder")}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-body font-semibold">{t("shopPhotos")}</span>
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
        <div className="flex flex-wrap gap-2">
          {photoPaths.map((path, i) => (
            <div
              key={path}
              className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-success bg-success/5 text-caption"
            >
              <span className="font-semibold text-success">✓ {i + 1}</span>
              <button
                type="button"
                onClick={() => setPhotoPaths((prev) => prev.filter((p) => p !== path))}
                className="text-ink/60 underline"
              >
                {t("remove")}
              </button>
            </div>
          ))}
          {photoPaths.length < MAX_SHOP_PHOTOS && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-24 items-center justify-center rounded-lg border border-dashed border-ink/30 text-caption font-semibold text-steppe disabled:opacity-40"
            >
              {uploading ? t("uploading") : `+ ${t("addPhoto")}`}
            </button>
          )}
        </div>
        <span className="text-caption text-ink/60">{t("shopPhotosHint")}</span>
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface pt-2 pb-4">
        {error && <p className="text-caption text-danger">{error}</p>}
        <button
          type="button"
          disabled={!valid || busy || uploading}
          onClick={submit}
          className="h-14 rounded-xl bg-navy text-subtitle font-bold text-white disabled:opacity-40"
        >
          {dealer ? t("resubmit") : t("submit")}
        </button>
      </div>
    </div>
  );
}

const inputClass = "h-14 w-full rounded-xl border border-ink/15 bg-white px-4 text-subtitle";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-body font-semibold">{label}</span>
      {children}
      {hint && <span className="text-caption text-ink/60">{hint}</span>}
    </label>
  );
}
