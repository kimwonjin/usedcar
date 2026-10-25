"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto } from "@/lib/upload";

// 경매 중 정보 보강: 하자 설명 수정과 사진 추가만 가능 (기본 정보·기존 사진은 잠김). 입찰·찜 딜러에게 알림이 간다.
export function LiveEdits({ carId, userId, defects }: { carId: string; userId: string; defects: string | null }) {
  const t = useTranslations("liveEdits");
  const router = useRouter();
  const [text, setText] = useState(defects ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveDefects() {
    setBusy(true);
    setError(false);
    const { error } = await createClient().from("cars").update({ defects: text.trim() || null }).eq("id", carId);
    setBusy(false);
    if (error) setError(true);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  async function addPhoto(file: File) {
    setBusy(true);
    setError(false);
    try {
      const path = await uploadPhoto("car-photos", `${userId}/${carId}`, file);
      const { error } = await createClient()
        .from("car_photos")
        .insert({ car_id: carId, slot: "defect", storage_path: path, sort_order: 100 + added });
      if (error) throw error;
      setAdded((n) => n + 1);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <details className="rounded-xl bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 text-body font-semibold">✏️ {t("title")}</summary>
      <div className="flex flex-col gap-3 border-t border-ink/10 p-4">
        <p className="text-caption text-ink/60">{t("hint")}</p>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink/60">{t("defects")}</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={500}
            className="rounded-lg border border-ink/15 bg-white p-3 text-body"
          />
        </label>
        <button
          type="button"
          disabled={busy || text.trim() === (defects ?? "").trim()}
          onClick={saveDefects}
          className="h-11 rounded-lg border border-navy font-semibold text-navy disabled:opacity-40"
        >
          {saved ? `✓ ${t("saved")}` : t("saveDefects")}
        </button>
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
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="h-11 rounded-lg border border-ink/15 font-semibold text-steppe disabled:opacity-40"
        >
          📷 {t("addPhoto")} {added > 0 && `(+${added})`}
        </button>
        {error && <p className="text-caption text-danger">{t("failed")}</p>}
      </div>
    </details>
  );
}
